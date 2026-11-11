#!/bin/bash
# يشغّل الموقع على جهازك (ماك). اضغط عليه مرتين.
cd "$(dirname "$0")"
( sleep 1; open "http://localhost:8765" ) &
python3 -m http.server 8765
