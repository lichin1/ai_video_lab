# 品質檢查報告

- 檔案：`output/kianshan_intro.mp4`
- 解析度／幀率：1920×1080 @ 30/1，編碼 h264 / aac 48000 Hz
- 片長：254.10 秒（時間軸 254.10 秒），影格數：7623（時間軸 7623），逐格解碼 7623 格
- 響度：I:         -15.0 LUFS / LRA:        10.4 LU / Peak:       -1.3 dBFS
- 相鄰格差異中位數：0.92（線條每 3 格重新抖動，屬正常的手繪「沸騰」效果）
- 異常影格：8 個

| 影格 | 時間 | 場景 | 問題 |
|---|---|---|---|
| 1053 | 35.10s | s03_founders +0.50s | almost no line art (0.06% ink) |
| 1054 | 35.13s | s03_founders +0.53s | almost no line art (0.06% ink) |
| 1055 | 35.17s | s03_founders +0.57s | almost no line art (0.06% ink) |
| 1056 | 35.20s | s03_founders +0.60s | almost no line art (0.06% ink) |
| 1057 | 35.23s | s03_founders +0.63s | almost no line art (0.08% ink) |
| 1058 | 35.27s | s03_founders +0.67s | almost no line art (0.09% ink) |
| 1059 | 35.30s | s03_founders +0.70s | almost no line art (0.12% ink) |
| 1060 | 35.33s | s03_founders +0.73s | almost no line art (0.16% ink) |

## 抽幀截圖

- `qa/final_stills/00_s01_opening_007.00s.jpg`
- `qa/final_stills/01_s01_opening_016.93s.jpg`
- `qa/final_stills/02_s02_title_028.93s.jpg`
- `qa/final_stills/03_s02_title_030.10s.jpg`
- `qa/final_stills/04_s03_founders_040.10s.jpg`
- `qa/final_stills/05_s03_founders_057.03s.jpg`
- `qa/final_stills/06_s04_growth_067.53s.jpg`
- `qa/final_stills/07_s04_growth_084.70s.jpg`
- `qa/final_stills/08_s05_heritage_095.20s.jpg`
- `qa/final_stills/09_s05_heritage_110.13s.jpg`
- `qa/final_stills/10_s05_heritage_120.80s.jpg`
- `qa/final_stills/11_s06_relief_131.30s.jpg`
- `qa/final_stills/12_s06_relief_147.30s.jpg`
- `qa/final_stills/13_s06_relief_159.07s.jpg`
- `qa/final_stills/14_s07_blood_169.57s.jpg`
- `qa/final_stills/15_s07_blood_174.43s.jpg`
- `qa/final_stills/16_s08_care_185.93s.jpg`
- `qa/final_stills/17_s08_care_198.40s.jpg`
- `qa/final_stills/18_s09_ending_209.40s.jpg`
- `qa/final_stills/19_s09_ending_224.53s.jpg`
- `qa/final_stills/20_s09_ending_233.10s.jpg`
- `qa/final_stills/21_s10_endcard_244.10s.jpg`
- `qa/final_stills/22_s10_endcard_251.10s.jpg`

## 人工複核

- 第 1053～1060 格（35.10～35.33 秒）被標記為「線稿很少」：這是片名卡溶接到場景 3 室內畫面的過渡，舊畫面淡出、新畫面同時淡入，所以線條顏色較淺。已逐格看過截圖，不是空白或破圖，維持原樣。
- 原本場景 3 開頭有 23 格近乎空白的牆面（牆面底色瞬間蓋上），已修正並重新渲染這一段。
