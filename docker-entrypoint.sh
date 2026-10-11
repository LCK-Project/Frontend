#!/bin/sh
# 브라우저가 호출할 백엔드 주소로 config.js 를 생성한다
echo "window.API_BASE_URL = \"${API_BASE_URL:-http://localhost:8000}\";" > /usr/share/nginx/html/config.js
