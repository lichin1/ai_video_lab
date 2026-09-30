# 品質檢查報告

- 檔案：`output/kianshan_intro.mp4`
- 解析度／幀率：1920×1080 @ 30/1，編碼 h264 / aac 48000 Hz
- 片長：245.23 秒（時間軸 245.23 秒），影格數：7357（時間軸 7357），逐格解碼 7357 格
- 響度：I:         -15.1 LUFS / LRA:         8.8 LU / Peak:       -1.4 dBFS
- 相鄰格差異中位數：0.74（線條每 3 格重新抖動，屬正常的手繪「沸騰」效果）
- 異常影格：87 個

| 影格 | 時間 | 場景 | 問題 |
|---|---|---|---|
| 740 | 24.67s | s02_title +0.40s | almost no line art (0.09% ink) |
| 741 | 24.70s | s02_title +0.43s | almost no line art (0.03% ink) |
| 742 | 24.73s | s02_title +0.47s | almost no line art (0.08% ink) |
| 743 | 24.77s | s02_title +0.50s | almost no line art (0.15% ink) |
| 1116 | 37.20s | s03_founding +0.43s | almost no line art (0.02% ink) |
| 1117 | 37.23s | s03_founding +0.47s | almost no line art (0.00% ink) |
| 1118 | 37.27s | s03_founding +0.50s | almost no line art (0.03% ink) |
| 1119 | 37.30s | s03_founding +0.53s | almost no line art (0.15% ink) |
| 1120 | 37.33s | s03_founding +0.57s | almost no line art (0.19% ink) |
| 2543 | 84.77s | s05_scholarship +0.40s | almost no line art (0.16% ink) |
| 2544 | 84.80s | s05_scholarship +0.43s | almost no line art (0.11% ink) |
| 2545 | 84.83s | s05_scholarship +0.47s | almost no line art (0.14% ink) |
| 5441 | 181.37s | s08_recent +0.43s | almost no line art (0.10% ink) |
| 5442 | 181.40s | s08_recent +0.47s | almost no line art (0.15% ink) |
| 6040 | 201.33s | s09_ending +0.43s | almost no line art (0.08% ink) |
| 6041 | 201.37s | s09_ending +0.47s | almost no line art (0.16% ink) |
| 6949 | 231.63s | s10_endcard +0.40s | almost no line art (0.18% ink) |
| 6950 | 231.67s | s10_endcard +0.43s | almost no line art (0.04% ink) |
| 6951 | 231.70s | s10_endcard +0.47s | almost no line art (0.07% ink) |
| 6952 | 231.73s | s10_endcard +0.50s | almost no line art (0.13% ink) |
| 6953 | 231.77s | s10_endcard +0.53s | almost no line art (0.20% ink) |
| 2061 | 68.70s | s04_chairs +11.40s | glitch spike (diff in 6.3, out 6.6, median 0.74) |
| 2062 | 68.73s | s04_chairs +11.43s | glitch spike (diff in 6.6, out 7.1, median 0.74) |
| 2063 | 68.77s | s04_chairs +11.47s | glitch spike (diff in 7.1, out 7.8, median 0.74) |
| 2064 | 68.80s | s04_chairs +11.50s | glitch spike (diff in 7.8, out 8.1, median 0.74) |
| 2065 | 68.83s | s04_chairs +11.53s | glitch spike (diff in 8.1, out 8.5, median 0.74) |
| 2066 | 68.87s | s04_chairs +11.57s | glitch spike (diff in 8.5, out 8.9, median 0.74) |
| 2067 | 68.90s | s04_chairs +11.60s | glitch spike (diff in 8.9, out 8.9, median 0.74) |
| 2068 | 68.93s | s04_chairs +11.63s | glitch spike (diff in 8.9, out 9.0, median 0.74) |
| 2069 | 68.97s | s04_chairs +11.67s | glitch spike (diff in 9.0, out 9.1, median 0.74) |
| 2070 | 69.00s | s04_chairs +11.70s | glitch spike (diff in 9.1, out 8.9, median 0.74) |
| 2071 | 69.03s | s04_chairs +11.73s | glitch spike (diff in 8.9, out 8.8, median 0.74) |
| 2072 | 69.07s | s04_chairs +11.77s | glitch spike (diff in 8.8, out 8.6, median 0.74) |
| 2073 | 69.10s | s04_chairs +11.80s | glitch spike (diff in 8.6, out 8.0, median 0.74) |
| 2074 | 69.13s | s04_chairs +11.83s | glitch spike (diff in 8.0, out 7.8, median 0.74) |
| 2075 | 69.17s | s04_chairs +11.87s | glitch spike (diff in 7.8, out 8.0, median 0.74) |
| 2076 | 69.20s | s04_chairs +11.90s | glitch spike (diff in 8.0, out 7.7, median 0.74) |
| 2077 | 69.23s | s04_chairs +11.93s | glitch spike (diff in 7.7, out 7.8, median 0.74) |
| 2078 | 69.27s | s04_chairs +11.97s | glitch spike (diff in 7.8, out 7.7, median 0.74) |
| 2079 | 69.30s | s04_chairs +12.00s | glitch spike (diff in 7.7, out 7.5, median 0.74) |
| 2080 | 69.33s | s04_chairs +12.03s | glitch spike (diff in 7.5, out 7.3, median 0.74) |
| 2081 | 69.37s | s04_chairs +12.07s | glitch spike (diff in 7.3, out 6.5, median 0.74) |
| 2888 | 96.27s | s05_scholarship +11.90s | glitch spike (diff in 6.5, out 6.9, median 0.74) |
| 2889 | 96.30s | s05_scholarship +11.93s | glitch spike (diff in 6.9, out 7.1, median 0.74) |
| 2890 | 96.33s | s05_scholarship +11.97s | glitch spike (diff in 7.1, out 7.2, median 0.74) |
| 2891 | 96.37s | s05_scholarship +12.00s | glitch spike (diff in 7.2, out 7.4, median 0.74) |
| 2892 | 96.40s | s05_scholarship +12.03s | glitch spike (diff in 7.4, out 6.9, median 0.74) |
| 2893 | 96.43s | s05_scholarship +12.07s | glitch spike (diff in 6.9, out 6.3, median 0.74) |
| 2894 | 96.47s | s05_scholarship +12.10s | glitch spike (diff in 6.3, out 6.3, median 0.74) |
| 3237 | 107.90s | s05_scholarship +23.53s | glitch spike (diff in 6.3, out 6.2, median 0.74) |
| 3238 | 107.93s | s05_scholarship +23.57s | glitch spike (diff in 6.2, out 6.6, median 0.74) |
| 3239 | 107.97s | s05_scholarship +23.60s | glitch spike (diff in 6.6, out 6.8, median 0.74) |
| 3240 | 108.00s | s05_scholarship +23.63s | glitch spike (diff in 6.8, out 6.1, median 0.74) |
| 4077 | 135.90s | s06_blood +17.20s | glitch spike (diff in 6.4, out 6.1, median 0.74) |
| 4078 | 135.93s | s06_blood +17.23s | glitch spike (diff in 6.1, out 6.0, median 0.74) |
| 4079 | 135.97s | s06_blood +17.27s | glitch spike (diff in 6.0, out 6.7, median 0.74) |
| 4080 | 136.00s | s06_blood +17.30s | glitch spike (diff in 6.7, out 6.7, median 0.74) |
| 4081 | 136.03s | s06_blood +17.33s | glitch spike (diff in 6.7, out 6.9, median 0.74) |
| 4082 | 136.07s | s06_blood +17.37s | glitch spike (diff in 6.9, out 7.2, median 0.74) |
| 4083 | 136.10s | s06_blood +17.40s | glitch spike (diff in 7.2, out 7.2, median 0.74) |
| 4084 | 136.13s | s06_blood +17.43s | glitch spike (diff in 7.2, out 7.4, median 0.74) |
| 4085 | 136.17s | s06_blood +17.47s | glitch spike (diff in 7.4, out 7.7, median 0.74) |
| 4086 | 136.20s | s06_blood +17.50s | glitch spike (diff in 7.7, out 7.7, median 0.74) |
| 4087 | 136.23s | s06_blood +17.53s | glitch spike (diff in 7.7, out 7.6, median 0.74) |
| 4088 | 136.27s | s06_blood +17.57s | glitch spike (diff in 7.6, out 7.6, median 0.74) |
| 4089 | 136.30s | s06_blood +17.60s | glitch spike (diff in 7.6, out 7.2, median 0.74) |
| 4090 | 136.33s | s06_blood +17.63s | glitch spike (diff in 7.2, out 7.1, median 0.74) |
| 4091 | 136.37s | s06_blood +17.67s | glitch spike (diff in 7.1, out 7.3, median 0.74) |
| 4092 | 136.40s | s06_blood +17.70s | glitch spike (diff in 7.3, out 6.9, median 0.74) |
| 4093 | 136.43s | s06_blood +17.73s | glitch spike (diff in 6.9, out 6.6, median 0.74) |
| 4094 | 136.47s | s06_blood +17.77s | glitch spike (diff in 6.6, out 6.5, median 0.74) |
| 5761 | 192.03s | s08_recent +11.10s | glitch spike (diff in 6.0, out 6.3, median 0.74) |
| 5762 | 192.07s | s08_recent +11.13s | glitch spike (diff in 6.3, out 6.7, median 0.74) |
| 5763 | 192.10s | s08_recent +11.17s | glitch spike (diff in 6.7, out 6.9, median 0.74) |
| 5764 | 192.13s | s08_recent +11.20s | glitch spike (diff in 6.9, out 7.2, median 0.74) |
| 5765 | 192.17s | s08_recent +11.23s | glitch spike (diff in 7.2, out 7.3, median 0.74) |
| 5766 | 192.20s | s08_recent +11.27s | glitch spike (diff in 7.3, out 7.3, median 0.74) |
| 5767 | 192.23s | s08_recent +11.30s | glitch spike (diff in 7.3, out 7.5, median 0.74) |
| 5768 | 192.27s | s08_recent +11.33s | glitch spike (diff in 7.5, out 7.3, median 0.74) |
| 5769 | 192.30s | s08_recent +11.37s | glitch spike (diff in 7.3, out 7.3, median 0.74) |
| 5770 | 192.33s | s08_recent +11.40s | glitch spike (diff in 7.3, out 7.3, median 0.74) |
| 5771 | 192.37s | s08_recent +11.43s | glitch spike (diff in 7.3, out 7.3, median 0.74) |
| 5772 | 192.40s | s08_recent +11.47s | glitch spike (diff in 7.3, out 7.2, median 0.74) |
| 5773 | 192.43s | s08_recent +11.50s | glitch spike (diff in 7.2, out 6.8, median 0.74) |
| 5774 | 192.47s | s08_recent +11.53s | glitch spike (diff in 6.8, out 6.5, median 0.74) |
| 5775 | 192.50s | s08_recent +11.57s | glitch spike (diff in 6.5, out 6.3, median 0.74) |
| 5776 | 192.53s | s08_recent +11.60s | glitch spike (diff in 6.3, out 6.2, median 0.74) |

## 抽幀截圖

- `qa/final_stills/00_s01_opening_007.00s.jpg`
- `qa/final_stills/01_s01_opening_018.77s.jpg`
- `qa/final_stills/02_s02_title_030.77s.jpg`
- `qa/final_stills/03_s02_title_032.27s.jpg`
- `qa/final_stills/04_s03_founding_042.27s.jpg`
- `qa/final_stills/05_s03_founding_052.30s.jpg`
- `qa/final_stills/06_s04_chairs_062.80s.jpg`
- `qa/final_stills/07_s04_chairs_079.37s.jpg`
- `qa/final_stills/08_s05_scholarship_089.87s.jpg`
- `qa/final_stills/09_s05_scholarship_104.73s.jpg`
- `qa/final_stills/10_s05_scholarship_113.70s.jpg`
- `qa/final_stills/11_s06_blood_124.20s.jpg`
- `qa/final_stills/12_s06_blood_137.27s.jpg`
- `qa/final_stills/13_s06_blood_153.53s.jpg`
- `qa/final_stills/14_s07_rain_165.03s.jpg`
- `qa/final_stills/15_s07_rain_175.43s.jpg`
- `qa/final_stills/16_s08_recent_186.43s.jpg`
- `qa/final_stills/17_s08_recent_195.90s.jpg`
- `qa/final_stills/18_s09_ending_206.90s.jpg`
- `qa/final_stills/19_s09_ending_224.23s.jpg`
- `qa/final_stills/20_s10_endcard_235.23s.jpg`
- `qa/final_stills/21_s10_endcard_242.23s.jpg`
