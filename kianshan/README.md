# 高雄市堅山慈善會簡介：手繪線稿風格動畫

1920×1080、30fps、約 4 分 03 秒。中英雙語字幕燒進畫面，另附 `.srt`。
每一格畫面都用程式產生的 SVG 向量線稿繪製，沒有使用 AI 生成的圖像。

## 產出檔案

| 檔案 | 內容 |
|---|---|
| `output/kianshan_intro_web.mp4` | 成品影片，交付版（94 MB，H.264 + AAC，響度 -15 LUFS） |
| `output/kianshan_intro.mp4` | 高畫質母帶（193 MB，超過 GitHub 單檔上限，不放進 repo，執行 `qa/check.py` 會重新產生） |
| `output/kianshan_intro.srt` | 中英雙語字幕檔 |
| `output/script_and_sources.md` | 旁白稿與資料來源 |
| `qa/` | 逐格檢查報告、各場景截圖 |

## 製作流程（重建方式）

```bash
python3 tts/generate.py gemini Sulafat  # 1. 生成旁白並量測每句秒數（附 ASR 發音核對）
python3 tts/timeline.py           # 2. 依秒數排出場景時間軸並輸出 .srt
python3 render/render.py video 4  # 3. Chromium 逐格渲染 → render/video_noaudio.mp4
python3 audio/mix.py              # 4. 原創配樂、音效、自動壓低音樂，響度正規化到 -15 LUFS
python3 qa/check.py               # 5. 逐格檢查、合成成品、抽幀截圖
```

依賴套件：ffmpeg、Chromium（Playwright）、`fonts-noto-cjk`，以及 Python 套件
`numpy scipy pillow soundfile pyloudnorm playwright sherpa-onnx opencc-python-reimplemented jieba`。
語音模型（Kokoro 多語 v1.1、Paraformer 中文小模型）來自 k2-fsa/sherpa-onnx 的 GitHub releases。

## 旁白聲音

旁白由 Gemini TTS（`gemini-3.8-flash-lite-tts`）生成，聲音是 Sulafat 女聲，並在提示中要求台灣口音、溫暖的說故事語氣。
Gemini API 金鑰存在雲端環境的 credential 裡，以 `x-goog-api-key` 標頭自動帶上，不會寫進程式碼。

- 為了配合免費額度（每天每個模型 10 次請求），24 句分成 3 大段、一段一次請求，一口氣念完，再依句間停頓自動切成單句。每一句都用語音辨識核對，對不上的句子才單獨重念。
- 重新生成：`python3 tts/generate.py gemini Sulafat`。可以用環境變數 `GEMINI_TTS_MODEL` 換模型，例如額度重置後改回 `gemini-3.8-flash-tts`。
- 離線備援：`python3 tts/generate.py kokoro 60 0.86`，使用 Kokoro 中文男聲。
- 自備錄音：把音檔放到 `audio/narration_override/NN.wav`，會優先使用。

## 換上正式 Logo

片中的堅山慈善會徽章是依主題手繪的替代圖（山、太陽、愛心），各機關則以名稱標章呈現，
沒有自行仿製官方標誌。把 PNG 檔（建議透明背景、正方形）放進 `assets/logos/` 後重新渲染即可替換：

- `kianshan.png`：堅山慈善會
- `social.png`：高雄市政府社會局
- `blood.png`：台灣血液基金會 高雄捐血中心
- `volunteer.png`：高雄市志願服務資源中心

## 程式結構

- `engine/lib.js`：手繪工具組，包含會抖動的線條、邊畫邊出現的筆觸，以及可重複使用的元件（建築、人物、樹、雲、鳥、車、道具、Logo）。
- `engine/scenes.js`：10 個場景的腳本，每個場景都有與旁白同步的動態事件和緩慢運鏡。
- `engine/index.html`：場景合成、轉場、紙張紋理、線條抖動濾鏡（每 3 格換一次）、字幕層。
- 遮擋規則：每個物件的線稿下面都墊一層不透明底色，而且由遠到近依序繪製，所以前景一定會蓋住後景。雨只畫在天空和街面區塊，不會穿過人物或建築。
