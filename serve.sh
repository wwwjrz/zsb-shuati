#!/bin/bash
# 启动学习平台：电脑浏览器 + 手机（同一WiFi）
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo "----------------------------------------"
echo "  电脑访问:  http://localhost:8000"
echo "  手机访问:  http://${IP:-<局域网IP>}:8000"
echo "  手机打开后可『添加到主屏幕』当App用"
echo "  按 Ctrl+C 停止"
echo "----------------------------------------"
python3 -m http.server 8000
