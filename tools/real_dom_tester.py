import http.server
import socketserver
import threading
import subprocess
import os
import json
import urllib.parse

PORT = 8999
results = {}

class TestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/report':
            params = urllib.parse.parse_qs(parsed.query)
            data_str = params.get('data', ['{}'])[0]
            data = json.loads(data_str)
            label = params.get('label', ['default'])[0]
            results[label] = data
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        return super().do_GET()

    def log_message(self, format, *args):
        pass  # suppress logs

server = socketserver.TCPServer(('127.0.0.1', PORT), TestHandler)
server_thread = threading.Thread(target=server.serve_forever, daemon=True)
server_thread.start()

print(f"Server started on http://127.0.0.1:{PORT}")

# Now let's inject a reporter into index.html or create a test page that loads index.html in an iframe
test_wrapper = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;overflow:hidden;">
<iframe id="app-frame" src="/index.html" style="width:100vw;height:100vh;border:none;"></iframe>
<script>
const frame = document.getElementById('app-frame');
frame.onload = () => {{
  setTimeout(() => {{
    try {{
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      const vh = win.innerHeight;
      const vw = win.innerWidth;
      const body = doc.querySelector('.metro-group-body');
      const bRect = body.getBoundingClientRect();
      const panorama = doc.getElementById('metro-panorama');
      const pRect = panorama.getBoundingClientRect();
      const header = doc.getElementById('metro-header-banner');
      const hRect = header.getBoundingClientRect();
      const comp = win.getComputedStyle(doc.documentElement);
      const unit = comp.getPropertyValue('--tile-unit').trim();
      const gap = comp.getPropertyValue('--tile-gap').trim();
      const cards = doc.querySelectorAll('.game-card');
      const sampleCard = cards[0];
      const cRect = sampleCard ? sampleCard.getBoundingClientRect() : {{}};
      
      const payload = {{
        vw, vh,
        unit, gap,
        headerHeight: hRect.height,
        headerBottom: hRect.bottom,
        panoramaTop: pRect.top,
        panoramaBottom: pRect.bottom,
        bodyTop: bRect.top,
        bodyBottom: bRect.bottom,
        bodyHeight: bRect.height,
        sampleCardWidth: cRect.width,
        sampleCardHeight: cRect.height,
        bottomSpace: vh - bRect.bottom,
        panoramaBottomSpace: vh - pRect.bottom,
        scrollWidth: panorama.scrollWidth,
        clientWidth: panorama.clientWidth,
        scrollHeight: panorama.scrollHeight,
        clientHeight: panorama.clientHeight,
        hasVerticalScroll: panorama.scrollHeight > panorama.clientHeight
      }};
      
      const params = new URLSearchParams(window.location.search);
      const label = params.get('label') || 'unknown';
      fetch(`/report?label=${{encodeURIComponent(label)}}&data=${{encodeURIComponent(JSON.stringify(payload))}}`);
    }} catch(e) {{
      console.error(e);
    }}
  }}, 250);
}};
</script>
</body>
</html>
"""

with open("test_wrapper.html", "w", encoding="utf-8") as f:
    f.write(test_wrapper)

test_cases = [
    ("1080p_100pct", 1920, 1080),
    ("1080p_80pct", 2400, 1350),
    ("1080p_125pct", 1536, 864),
    ("1080p_150pct", 1280, 720),
    ("laptop_768p", 1366, 768),
    ("2k_1440p", 2560, 1440),
    ("ultrawide", 3440, 1440),
    ("4k_2160p", 3840, 2160),
    ("phone_landscape", 844, 390),
    ("phone_portrait", 390, 844),
]

for label, w, h in test_cases:
    url = f"http://127.0.0.1:{PORT}/test_wrapper.html?label={label}"
    cmd = [
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        '--headless=new',
        '--disable-gpu',
        f'--window-size={w},{h}',
        '--virtual-time-budget=2000',
        url
    ]
    subprocess.run(cmd, capture_output=True)

server.shutdown()
if os.path.exists("test_wrapper.html"):
    os.remove("test_wrapper.html")

print("--- COLLECTED REAL DOM RESULTS ---")
for label, data in results.items():
    print(f"\n[{label}] ({data.get('vw')}x{data.get('vh')}):")
    print(f"  --tile-unit: {data.get('unit')}")
    print(f"  --tile-gap:  {data.get('gap')}")
    print(f"  Grid Body:   top={data.get('bodyTop')}, bottom={data.get('bodyBottom')}, height={data.get('bodyHeight')}")
    print(f"  Bottom Space from Grid: {data.get('bottomSpace')}px")
    print(f"  Vertical Scroll: {data.get('hasVerticalScroll')} (scrollHeight={data.get('scrollHeight')}, clientHeight={data.get('clientHeight')})")
    coverage = round((data.get('bodyHeight', 0) / data.get('vh', 1)) * 100, 1)
    print(f"  Coverage: {coverage}%")
