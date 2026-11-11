#!/bin/bash
# شينز: موقعك الخاص. اضغط عليه مرتين ويفتح في المتصفح.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  python3 server.py
else
  osascript -e 'display dialog "يحتاج الموقع Python 3. ثبّته من python.org ثم أعد المحاولة." buttons {"حسناً"}'
fi
