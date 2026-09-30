"""Write output/script_and_sources.md from the script and the measured timeline."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(f"{ROOT}/script/script.json", encoding="utf8"))
tl = json.load(open(f"{ROOT}/render/timeline.json", encoding="utf8"))
o = ["# 高雄市堅山慈善會簡介：旁白稿與資料來源", "",
     f"片長 {tl['total']:.1f} 秒｜1920×1080｜30fps｜旁白 24 句，每句 30 字以內｜Gemini TTS（Sulafat 女聲，台灣口音、說故事語氣）", "",
     "## 旁白稿（依場景）", ""]
for s in tl["scenes"]:
    m, sec = divmod(s["start"], 60)
    o.append(f"### {s['name']}（{int(m)}:{sec:05.2f}，{s['dur']:.1f} 秒）")
    for ln in s["lines"]:
        t = s["start"] + ln["s"]
        o.append(f"{ln['n']:02d}. [{int(t // 60)}:{t % 60:05.2f}] {ln['zh']}  \n    *{ln['en']}*")
    o.append("")
o += ["## 查證事實與出處", "", "| 旁白內容 | 出處 |", "|---|---|",
      "| 會址：高雄市仁武區仁林路267巷1弄19號 | 堅山慈善會114年函（橋頭國中）、高雄市志願服務資源中心 |",
      "| 在高雄市政府社會局轄下立案 | 高雄市政府社會局福利地圖 |",
      "| 清寒優秀學生獎助學金，受惠學生來自仁武、大樹、鳥松、大社等地 | 堅山慈善會114年函、獎助學金發給要點 |",
      "| 高雄大專院校學生也可申請（學業85、操行80、體育75分以上） | 高雄餐旅大學、高雄醫學大學、樹德科大的公告 |",
      "| 每年至少辦一次捐血；2024年5月5日在大社觀音山風景區入口，兩台捐血車，募得372袋；理事長李國忠的談話；志工備冰涼茶水 | 中華捐血運動協會會刊 |",
      "| 登記在案的志工團隊 | 高雄市志願服務資源中心、衛福部志願服務資訊整合系統 |",
      "| 2025年（民國114年）獎助學金公文寄到各校 | 堅山慈善會114年函（橋頭國中） |",
      "| 陳國泰理事長與夫人吳惠豐女士 | **委託人提供，網路上查無公開資料，請會方確認職稱與先後屆次** |",
      "", "## 資料來源連結", ""]
o += [f"- [{s['label']}]({s['url']})" for s in d["sources"]]
o += ["", "## 說明",
      "- 「一群鄉親聚在一起成立」「風雨中送關懷」「受助孩子長大助人」屬於象徵性的敘事畫面，沒有對應特定的日期或事件。",
      "- 網路上查不到成立年份，所以旁白沒有提到年份。"]
open(f"{ROOT}/output/script_and_sources.md", "w", encoding="utf8").write("\n".join(o) + "\n")
