#!/usr/bin/env python3
import sys
import paramiko
import time
import json

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"

NEW_SERVER_CODE = r'''import os
import sys
import ssl
import time
import json
import threading
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 58443
AUTH_HOST = "127.0.0.1"
AUTH_PORT = 58444

TEMPLATE_PATH = "/opt/clash-sub/template.yaml"
USERS_PATH = "/opt/clash-sub/users.json"
CERT_FILE = "/opt/clash-sub/certs/server.crt"
KEY_FILE = "/opt/clash-sub/certs/server.key"
TARGET_PATH = "/api/v1/sub"
METRICS_PATH = "/api/v1/metrics"

RATE_LIMIT_WINDOW = 60
MAX_REQUESTS_PER_WINDOW = 60
MAX_TRACKED_IPS = 1000
ip_request_records = {}

last_net_sample = {"time": 0, "rx": 0, "tx": 0}
last_cpu_sample = {"time": 0, "total": 0, "idle": 0}

def get_users():
    if not os.path.exists(USERS_PATH):
        return {}
    try:
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def is_rate_limited(client_ip):
    now = time.time()
    if len(ip_request_records) > MAX_TRACKED_IPS:
        dead_ips = [ip for ip, recs in ip_request_records.items() if not recs or (now - recs[-1] > RATE_LIMIT_WINDOW)]
        for ip in dead_ips:
            del ip_request_records[ip]

    records = ip_request_records.get(client_ip, [])
    valid_records = [t for t in records if now - t < RATE_LIMIT_WINDOW]
    
    if len(valid_records) >= MAX_REQUESTS_PER_WINDOW:
        ip_request_records[client_ip] = valid_records
        return True
    
    valid_records.append(now)
    ip_request_records[client_ip] = valid_records
    return False

def collect_system_metrics():
    global last_net_sample, last_cpu_sample
    now = time.time()
    
    # 1. CPU & Load
    load1, load5, load15 = 0.0, 0.0, 0.0
    try:
        with open("/proc/loadavg", "r") as f:
            parts = f.read().split()
            load1, load5, load15 = float(parts[0]), float(parts[1]), float(parts[2])
    except Exception:
        pass

    cpu_usage_pct = 0.0
    try:
        with open("/proc/stat", "r") as f:
            line = f.readline()
            if line.startswith("cpu "):
                fields = [int(x) for x in line.split()[1:]]
                idle = fields[3] + (fields[4] if len(fields) > 4 else 0)
                total = sum(fields)
                if last_cpu_sample["time"] > 0:
                    dt = total - last_cpu_sample["total"]
                    di = idle - last_cpu_sample["idle"]
                    if dt > 0:
                        cpu_usage_pct = max(0.0, min(100.0, (1.0 - di / dt) * 100.0))
                last_cpu_sample = {"time": now, "total": total, "idle": idle}
    except Exception:
        pass

    # 2. Memory
    mem_total, mem_free, mem_avail = 0, 0, 0
    swap_total, swap_free = 0, 0
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split(":")
                key = parts[0].strip()
                val = int(parts[1].strip().split()[0]) # kB
                if key == "MemTotal": mem_total = val
                elif key == "MemFree": mem_free = val
                elif key == "MemAvailable": mem_avail = val
                elif key == "SwapTotal": swap_total = val
                elif key == "SwapFree": swap_free = val
    except Exception:
        pass

    mem_used = max(0, mem_total - mem_avail)
    mem_pct = (mem_used / mem_total * 100.0) if mem_total > 0 else 0.0
    swap_used = max(0, swap_total - swap_free)
    swap_pct = (swap_used / swap_total * 100.0) if swap_total > 0 else 0.0

    # 3. Network
    rx_bytes, tx_bytes = 0, 0
    rx_packets, tx_packets = 0, 0
    rx_drops, tx_drops = 0, 0
    rx_rate_kbps, tx_rate_kbps = 0.0, 0.0
    primary_if = "eth0"
    try:
        with open("/proc/net/dev", "r") as f:
            for line in f:
                if ":" in line:
                    iface, stats = line.split(":")
                    iface = iface.strip()
                    if iface in ["eth0", "ens3", "enp1s0"]:
                        primary_if = iface
                        cols = [int(x) for x in stats.split()]
                        rx_bytes = cols[0]
                        rx_packets = cols[1]
                        rx_drops = cols[3]
                        tx_bytes = cols[8]
                        tx_packets = cols[9]
                        tx_drops = cols[11]
                        break
        if last_net_sample["time"] > 0:
            dt = now - last_net_sample["time"]
            if dt > 0:
                rx_rate_kbps = max(0.0, (rx_bytes - last_net_sample["rx"]) / 1024.0 / dt)
                tx_rate_kbps = max(0.0, (tx_bytes - last_net_sample["tx"]) / 1024.0 / dt)
        last_net_sample = {"time": now, "rx": rx_bytes, "tx": tx_bytes}
    except Exception:
        pass

    # 4. TCP Socket States
    tcp_states = {
        "ESTABLISHED": 0, "SYN_SENT": 0, "SYN_RECV": 0,
        "FIN_WAIT1": 0, "FIN_WAIT2": 0, "TIME_WAIT": 0,
        "CLOSE": 0, "CLOSE_WAIT": 0, "LAST_ACK": 0,
        "LISTEN": 0, "CLOSING": 0, "TOTAL": 0
    }
    state_map = {
        "01": "ESTABLISHED", "02": "SYN_SENT", "03": "SYN_RECV",
        "04": "FIN_WAIT1", "05": "FIN_WAIT2", "06": "TIME_WAIT",
        "07": "CLOSE", "08": "CLOSE_WAIT", "09": "LAST_ACK",
        "0A": "LISTEN", "0B": "CLOSING"
    }
    for proc_tcp in ["/proc/net/tcp", "/proc/net/tcp6"]:
        try:
            with open(proc_tcp, "r") as f:
                f.readline()
                for line in f:
                    parts = line.split()
                    if len(parts) > 3:
                        st = parts[3].upper()
                        name = state_map.get(st)
                        if name:
                            tcp_states[name] += 1
                            tcp_states["TOTAL"] += 1
        except Exception:
            pass

    # 5. TCP Congestion Control
    tcp_cc = "bbr"
    try:
        with open("/proc/sys/net/ipv4/tcp_congestion_control", "r") as f:
            tcp_cc = f.read().strip()
    except Exception:
        pass

    # 6. Uptime
    uptime_sec = 0
    try:
        with open("/proc/uptime", "r") as f:
            uptime_sec = int(float(f.read().split()[0]))
    except Exception:
        pass

    # 7. Services
    services = {
        "sshd": False,
        "xray": False,
        "hysteria": False,
        "clash_sub": True,
        "fail2ban": False
    }
    try:
        pids = [p for p in os.listdir("/proc") if p.isdigit()]
        for pid in pids:
            try:
                with open(f"/proc/{pid}/cmdline", "r") as f:
                    cmd = f.read()
                    if "sshd" in cmd: services["sshd"] = True
                    if "xray" in cmd: services["xray"] = True
                    if "hysteria" in cmd: services["hysteria"] = True
                    if "fail2ban" in cmd: services["fail2ban"] = True
            except Exception:
                pass
    except Exception:
        pass

    # 8. Security / Fail2ban Banned IPs
    banned_ips = set()
    try:
        with open("/var/log/fail2ban.log", "r") as f:
            for line in f:
                if "Ban " in line:
                    parts = line.split("Ban ")
                    if len(parts) > 1:
                        ip = parts[1].strip().split()[0]
                        banned_ips.add(ip)
                elif "Unban " in line:
                    parts = line.split("Unban ")
                    if len(parts) > 1:
                        ip = parts[1].strip().split()[0]
                        banned_ips.discard(ip)
    except Exception:
        pass

    return {
        "status": "online",
        "timestamp": int(now),
        "uptime_seconds": uptime_sec,
        "cpu": {
            "cores": os.cpu_count() or 1,
            "load_1m": round(load1, 2),
            "load_5m": round(load5, 2),
            "load_15m": round(load15, 2),
            "usage_pct": round(cpu_usage_pct, 1)
        },
        "memory": {
            "total_mb": round(mem_total / 1024, 1),
            "used_mb": round(mem_used / 1024, 1),
            "available_mb": round(mem_avail / 1024, 1),
            "used_pct": round(mem_pct, 1),
            "swap_total_mb": round(swap_total / 1024, 1),
            "swap_used_mb": round(swap_used / 1024, 1),
            "swap_pct": round(swap_pct, 1)
        },
        "network": {
            "interface": primary_if,
            "rx_bytes": rx_bytes,
            "tx_bytes": tx_bytes,
            "rx_rate_kbps": round(rx_rate_kbps, 1),
            "tx_rate_kbps": round(tx_rate_kbps, 1),
            "rx_drops": rx_drops,
            "tx_drops": tx_drops
        },
        "tcp": tcp_states,
        "congestion_control": tcp_cc,
        "services": services,
        "security": {
            "fail2ban_active": services["fail2ban"],
            "banned_count": len(banned_ips),
            "banned_ips": list(banned_ips)
        }
    }

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

    def __init__(self, server_address, RequestHandlerClass, ssl_context=None):
        self.ssl_context = ssl_context
        super().__init__(server_address, RequestHandlerClass)

    def get_request(self):
        newsock, from_addr = self.socket.accept()
        if self.ssl_context:
            newsock.settimeout(5.0)
            try:
                connstream = self.ssl_context.wrap_socket(newsock, server_side=True, do_handshake_on_connect=True)
                connstream.settimeout(15.0)
                return connstream, from_addr
            except Exception:
                try:
                    newsock.close()
                except Exception:
                    pass
                raise
        else:
            newsock.settimeout(5.0)
            return newsock, from_addr

class SubscriptionHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_GET(self):
        client_ip = self.client_address[0]
        
        if is_rate_limited(client_ip):
            self.send_response(429)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            self.send_header("Retry-After", "60")
            body = b"Too Many Requests\n"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            return

        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        token = params.get("token", [""])[0]

        # 1. Metrics API Route
        if parsed.path == METRICS_PATH:
            users = get_users()
            target_user = None
            for uname, udata in users.items():
                if udata.get("token") == token:
                    target_user = (uname, udata)
                    break

            if not target_user:
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Connection", "close")
                body = b'{"error":"Forbidden: Invalid Telemetry Token"}\n'
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                self.wfile.flush()
                return

            metrics_data = collect_system_metrics()
            body = json.dumps(metrics_data).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
            return

        # 2. Subscription API Route
        elif parsed.path == TARGET_PATH:
            users = get_users()
            target_user = None
            for uname, udata in users.items():
                if udata.get("token") == token:
                    target_user = (uname, udata)
                    break

            if not target_user:
                self.send_response(404)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Connection", "close")
                body = b"Subscription Not Found\n"
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                self.wfile.flush()
                return

            uname, udata = target_user
            if not udata.get("enabled", False):
                self.send_response(403)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Connection", "close")
                body = f"Account [{uname}] is currently disabled\n".encode("utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                self.wfile.flush()
                return

            if not os.path.exists(TEMPLATE_PATH):
                self.send_response(500)
                body = b"Internal Server Error: Template Missing\n"
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                self.wfile.flush()
                return

            with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
                template_content = f.read()

            content = template_content.replace("{{VLESS_UUID}}", udata.get("vless_uuid", ""))
            content = content.replace("{{HY2_PASSWORD}}", udata.get("hy2_password", ""))
            content = content.replace("{{HY2_UP}}", udata.get("up", "30 Mbps"))
            content = content.replace("{{HY2_DOWN}}", udata.get("down", "100 Mbps"))
            body = content.encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "text/yaml; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Subscription-Userinfo", "upload=0; download=0; total=1073741824000; expire=2099999999")
            self.send_header("Profile-Update-Interval", "24")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()

        else:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Connection", "close")
            body = b"Not Found\n"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()

    def log_message(self, format, *args):
        sys.stderr.write(f"[{self.log_date_time_string()}] {self.client_address[0]} {format%args}\n")

class HysteriaAuthHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length)
            data = json.loads(raw_body)
            auth_str = data.get("auth", "")
            
            users = get_users()
            authenticated = False
            user_id = ""

            for uname, udata in users.items():
                if not udata.get("enabled", False):
                    continue
                pwd = udata.get("hy2_password", "")
                if auth_str == pwd or auth_str == f"{uname}:{pwd}":
                    authenticated = True
                    user_id = uname
                    break

            if authenticated:
                resp = {"ok": True, "id": user_id}
            else:
                resp = {"ok": False}

            resp_data = json.dumps(resp).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_data)))
            self.end_headers()
            self.wfile.write(resp_data)
            self.wfile.flush()
        except Exception as e:
            import traceback
            sys.stderr.write(f"AUTH ERROR: {e}\n{traceback.format_exc()}\n")
            sys.stderr.flush()
            self.send_response(500)
            self.end_headers()

    def log_message(self, format, *args):
        pass

def run_auth_server():
    auth_server = ThreadedHTTPServer((AUTH_HOST, AUTH_PORT), HysteriaAuthHandler)
    auth_server.serve_forever()

if __name__ == "__main__":
    t = threading.Thread(target=run_auth_server, daemon=True)
    t.start()

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=CERT_FILE, keyfile=KEY_FILE)
    sub_server = ThreadedHTTPServer((LISTEN_HOST, LISTEN_PORT), SubscriptionHandler, context)
    sub_server.serve_forever()
'''

def patch_and_restart():
    print("Connecting to Tokyo VPS via Ed25519 key...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    ssh.connect(HOST, port=PORT, username=USER, pkey=key, timeout=10)

    sftp = ssh.open_sftp()
    print("Uploading updated server.py with fail2ban security telemetry...")
    with sftp.open("/opt/clash-sub/server.py", "w") as f:
        f.write(NEW_SERVER_CODE)
    sftp.close()

    print("Restarting clash-sub.service...")
    stdin, stdout, stderr = ssh.exec_command("systemctl restart clash-sub.service && sleep 1 && systemctl status clash-sub.service | head -n 12")
    res = stdout.read().decode('utf-8')
    print("Service Status:\n", res)

    # Test the API endpoint directly via localhost curl
    test_token = "2ed5d9e3a9b258c8d6b33a5addfa43b9e590e6f3e4185679d8c7fc8c542f79f8"
    test_cmd = f"curl -k -s 'https://127.0.0.1:58443/api/v1/metrics?token={test_token}'"
    print("\nTesting /api/v1/metrics locally on VPS...")
    stdin, stdout, stderr = ssh.exec_command(test_cmd)
    metrics_json = stdout.read().decode('utf-8')
    parsed = json.loads(metrics_json)
    print("Security Telemetry Block:\n", json.dumps(parsed.get('security'), indent=2))

    ssh.close()

if __name__ == '__main__':
    patch_and_restart()
