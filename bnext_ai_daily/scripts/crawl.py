#!/usr/bin/env python3
"""爬取《數位時代》「一天一AI」標籤下的公開文章，存成個人離線封存。

用法：
    python3 -I scripts/crawl.py --out archive            # 全部頁
    python3 -I scripts/crawl.py --out archive --max-pages 2

輸出（archive/ 已在 .gitignore，只留在本機，不推上 GitHub）：
    archive/index.json                  文章清單與中繼資料
    archive/articles/<id>-<slug>.md     一篇一檔：front matter + 原文 Markdown
    archive/articles/img/<id>/...       該篇圖片

只抓不登入就看得到的內容；付費牆（一天一AI PRO 等）後的內容不處理。
"""
import argparse, hashlib, json, re, sys, time, urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

BASE = "https://www.bnext.com.tw"
TAG_URL = BASE + "/tags/%E4%B8%80%E5%A4%A9%E4%B8%80AI?page={page}"
ARTICLE_RE = re.compile(r"^(?:https://www\.bnext\.com\.tw)?/article/(\d+)/([^/?#]+)")
HEADERS = {"User-Agent": "Mozilla/5.0 (personal archive; contact owner)"}
DELAY = 1.5  # 秒；對來源站保持禮貌


def get(session, url, **kw):
    for attempt in range(4):
        try:
            r = session.get(url, headers=HEADERS, timeout=30, **kw)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            if attempt == 3:
                print(f"  ! {url}: {e}", file=sys.stderr)
                return None
            time.sleep(2 ** (attempt + 1))


def list_articles(session, max_pages):
    seen, found = set(), []
    for page in range(1, max_pages + 1):
        r = get(session, TAG_URL.format(page=page))
        if r is None:
            break
        soup = BeautifulSoup(r.text, "html.parser")
        new = 0
        for a in soup.find_all("a", href=True):
            m = ARTICLE_RE.match(a["href"])
            if not m or m.group(1) in seen:
                continue
            seen.add(m.group(1))
            found.append({"id": m.group(1), "slug": m.group(2),
                          "url": f"{BASE}/article/{m.group(1)}/{m.group(2)}",
                          "list_page": page})
            new += 1
        print(f"page {page}: +{new}")
        if new == 0:
            break
        time.sleep(DELAY)
    return found


def meta(soup, *names):
    for n in names:
        t = soup.find("meta", attrs={"property": n}) or soup.find("meta", attrs={"name": n})
        if t and t.get("content"):
            return t["content"].strip()
    return ""


def json_ld(soup):
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except ValueError:
            continue
        for d in data if isinstance(data, list) else [data]:
            if isinstance(d, dict) and "Article" in str(d.get("@type", "")):
                return d
    return {}


def pick_body(soup):
    """找出內文容器：優先常見 selector，否則取 <p> 最多的區塊。"""
    for sel in ["article .htmlview", ".htmlview", "article .content", "div.article-content",
                "div[itemprop=articleBody]", "article"]:
        node = soup.select_one(sel)
        if node and len(node.find_all("p")) >= 3:
            return node
    best, score = None, 0
    for div in soup.find_all(["div", "section"]):
        n = len(div.find_all("p", recursive=False))
        if n > score:
            best, score = div, n
    return best


SKIP = {"script", "style", "noscript", "iframe", "form", "button", "svg"}


def to_md(node, img_cb):
    out = []

    def inline(el):
        if isinstance(el, NavigableString):
            return str(el)
        if not isinstance(el, Tag) or el.name in SKIP:
            return ""
        inner = "".join(inline(c) for c in el.children)
        if el.name in ("strong", "b"):
            return f"**{inner.strip()}**" if inner.strip() else ""
        if el.name in ("em", "i"):
            return f"*{inner.strip()}*" if inner.strip() else ""
        if el.name == "a" and el.get("href"):
            return f"[{inner.strip()}]({urllib.parse.urljoin(BASE, el['href'])})"
        if el.name == "br":
            return "\n"
        if el.name == "img":
            return img_cb(el)
        return inner

    def block(el):
        if isinstance(el, NavigableString):
            t = str(el).strip()
            if t:
                out.append(t)
            return
        if not isinstance(el, Tag) or el.name in SKIP:
            return
        n = el.name
        if n in ("h1", "h2", "h3", "h4", "h5"):
            out.append("#" * max(2, int(n[1])) + " " + inline(el).strip())
        elif n == "p":
            t = inline(el).strip()
            if t:
                out.append(t)
        elif n in ("ul", "ol"):
            items = [("1. " if n == "ol" else "- ") + inline(li).strip()
                     for li in el.find_all("li", recursive=False)]
            out.append("\n".join(items))
        elif n == "blockquote":
            out.append("\n".join("> " + l for l in inline(el).strip().splitlines()))
        elif n == "img":
            out.append(img_cb(el))
        elif n == "figure":
            img = el.find("img")
            cap = el.find("figcaption")
            if img:
                out.append(img_cb(img) + (f"\n*{cap.get_text(' ', strip=True)}*" if cap else ""))
        elif n == "table":
            rows = [[c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
                    for tr in el.find_all("tr")]
            if rows:
                w = max(len(r) for r in rows)
                rows = [r + [""] * (w - len(r)) for r in rows]
                out.append("\n".join(["| " + " | ".join(rows[0]) + " |",
                                      "|" + "---|" * w] +
                                     ["| " + " | ".join(r) + " |" for r in rows[1:]]))
        elif n == "pre":
            out.append("```\n" + el.get_text() + "\n```")
        else:
            for c in el.children:
                block(c)

    block(node)
    return "\n\n".join(x for x in out if x.strip())


def fetch_article(session, item, outdir):
    r = get(session, item["url"])
    if r is None:
        return None
    soup = BeautifulSoup(r.text, "html.parser")
    ld = json_ld(soup)
    title = meta(soup, "og:title") or (soup.title.string if soup.title else "")
    title = re.sub(r"\s*[|｜]\s*數位時代.*$", "", title).strip()
    info = {
        **item,
        "title": title,
        "description": meta(soup, "og:description", "description"),
        "published": ld.get("datePublished") or meta(soup, "article:published_time"),
        "author": (ld.get("author") or {}).get("name", "") if isinstance(ld.get("author"), dict)
                  else ", ".join(a.get("name", "") for a in ld.get("author", []) if isinstance(a, dict)),
        "cover": meta(soup, "og:image"),
        "keywords": meta(soup, "keywords", "news_keywords"),
    }
    body = pick_body(soup)
    img_dir = outdir / "articles" / "img" / item["id"]
    images = []

    def img_cb(img):
        src = img.get("data-src") or img.get("data-original") or img.get("src") or ""
        if not src or src.startswith("data:"):
            return ""
        src = urllib.parse.urljoin(BASE, src)
        ext = Path(urllib.parse.urlparse(src).path).suffix.lower()
        ext = ext if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg") else ".jpg"
        name = hashlib.sha1(src.encode()).hexdigest()[:12] + ext
        dest = img_dir / name
        if not dest.exists():
            ir = get(session, src)
            if ir is None:
                return f"![{img.get('alt', '')}]({src})"
            img_dir.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(ir.content)
        images.append({"src": src, "file": f"img/{item['id']}/{name}"})
        return f"![{img.get('alt', '').strip()}](img/{item['id']}/{name})"

    cover_md = img_cb(soup.new_tag("img", src=info["cover"])) if info["cover"] else ""
    body_md = to_md(body, img_cb) if body else "_（未能解析內文，請開原文）_"
    info["images"] = images
    info["paywalled"] = bool(soup.select_one(".paywall, .member-only, [class*=paywall]"))

    fm = "\n".join(["---"] + [f"{k}: {json.dumps(info[k], ensure_ascii=False)}"
                              for k in ("id", "title", "url", "published", "author",
                                        "description", "keywords", "paywalled")] + ["---"])
    md = f"{fm}\n\n# {title}\n\n> 原文：[{info['url']}]({info['url']})\n\n{cover_md}\n\n{body_md}\n"
    path = outdir / "articles" / f"{item['id']}-{item['slug'][:60]}.md"
    path.write_text(md, encoding="utf-8")
    info["file"] = str(path.relative_to(outdir))
    info["chars"] = len(body_md)
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="archive")
    ap.add_argument("--max-pages", type=int, default=50)
    ap.add_argument("--only", nargs="*", help="只抓指定 article id")
    a = ap.parse_args()
    out = Path(a.out)
    (out / "articles").mkdir(parents=True, exist_ok=True)
    s = requests.Session()
    idx_path = out / "index.json"
    done = {x["id"]: x for x in json.loads(idx_path.read_text())} if idx_path.exists() else {}

    items = list_articles(s, a.max_pages)
    if a.only:
        items = [i for i in items if i["id"] in a.only]
    print(f"{len(items)} articles listed")
    for i, it in enumerate(items, 1):
        if it["id"] in done and not a.only:
            continue
        print(f"[{i}/{len(items)}] {it['url']}")
        info = fetch_article(s, it, out)
        if info:
            done[it["id"]] = info
            idx_path.write_text(json.dumps(sorted(done.values(), key=lambda x: x["id"], reverse=True),
                                           ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(DELAY)
    print(f"done: {len(done)} in {idx_path}")


if __name__ == "__main__":
    main()
