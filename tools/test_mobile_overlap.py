import http.server
import socketserver
import threading
import subprocess
import os
import json
import urllib.parse

res = {}

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if '/report' in self.path:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            res.update(json.loads(q['data'][0]))
            self.send_response(200)
            self.end_headers()
            return
        return super().do_GET()
    def log_message(self, *a): pass

s = socketserver.TCPServer(('127.0.0.1', 0), H)
PORT = s.server_address[1]
threading.Thread(target=s.serve_forever, daemon=True).start()

script = """
const groups = Array.from(document.querySelectorAll('.metro-group'));
const groupData = groups.map((g, idx) => {
    const rect = g.getBoundingClientRect();
    const body = g.querySelector('.metro-group-body').getBoundingClientRect();
    const cards = Array.from(g.querySelectorAll('.game-card'));
    const lastCard = cards[cards.length - 1].getBoundingClientRect();
    return {
        idx,
        g_bottom: rect.bottom,
        body_height: body.height,
        body_bottom: body.bottom,
        lastCard_bottom: lastCard.bottom,
        overflows_body: lastCard.bottom > body.bottom + 1
    };
});
fetch('/report?data=' + encodeURIComponent(JSON.stringify({ groups: groupData })));
"""

wrapper = """<!DOCTYPE html>
<html>
<body>
<iframe id="f" src="/index.html" style="width:390px;height:844px;border:none;"></iframe>
<script>
document.getElementById("f").onload = () => {
  setTimeout(() => {
    const win = document.getElementById("f").contentWindow;
    win.eval(`""" + script + """`);
  }, 400);
};
</script>
</body>
</html>"""

with open('tmp_mob.html', 'w', encoding='utf-8') as f:
    f.write(wrapper)

subprocess.run([r'C:\Program Files\Google\Chrome\Application\chrome.exe', '--headless=new', '--disable-gpu', '--virtual-time-budget=2000', '--window-size=450,900', f'http://127.0.0.1:{PORT}/tmp_mob.html'])
s.shutdown()
if os.path.exists('tmp_mob.html'):
    os.remove('tmp_mob.html')

print('ALL GROUPS RESULT:', json.dumps(res, indent=2))
