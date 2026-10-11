#!/usr/bin/env python3
import sys
import paramiko
import json

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"

REMOTE_SCRIPT = r'''import subprocess, json, re
from collections import Counter

# 1. Parse Hysteria logs for user sessions & destinations
out = subprocess.check_output(['journalctl', '-u', 'hysteria-server', '-n', '120', '--no-pager']).decode('utf-8', errors='ignore')
sessions = []
domains = []
recent_logs = []

for line in out.splitlines():
    if '"id":' in line and '"addr":' in line:
        try:
            m_id = re.search(r'"id":\s*"([^"]+)"', line)
            m_addr = re.search(r'"addr":\s*"([^"]+)"', line)
            m_req = re.search(r'"reqAddr":\s*"([^"]+)"', line)
            ts = line[:15] if len(line) >= 15 else ""
            if m_id and m_addr:
                uid = m_id.group(1)
                c_ip = m_addr.group(1).split(':')[0]
                req = m_req.group(1) if m_req else "unknown"
                sessions.append((uid, c_ip))
                if req != "unknown":
                    domains.append(req.split(':')[0])
                recent_logs.append({
                    "time": ts,
                    "proto": "Hysteria 2 (UDP/QUIC)",
                    "user": uid,
                    "client_ip": c_ip,
                    "target": req
                })
        except Exception:
            pass

# 2. Parse nf_conntrack for live active outbound proxy destinations
conns = []
try:
    with open('/proc/net/nf_conntrack', 'r') as f:
        for line in f:
            if 'ESTABLISHED' in line and 'src=141.11.139.61' in line:
                m_dst = re.search(r'dst=([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', line)
                m_dport = re.search(r'dport=([0-9]+)', line)
                if m_dst and m_dport:
                    dst = m_dst.group(1)
                    dport = m_dport.group(1)
                    if dport in ['443', '80', '5228', '853']:
                        conns.append(f"{dst}:{dport}")
except Exception:
    pass

# 3. Parse security events from fail2ban
sec_events = []
try:
    with open('/var/log/fail2ban.log', 'r') as f:
        for line in f.readlines()[-20:]:
            if 'Ban ' in line or 'Unban ' in line:
                sec_events.append(line.strip())
except Exception:
    pass

res = {
    "sessions": [{"user": u, "ip": ip, "count": c} for (u, ip), c in Counter(sessions).most_common(5)],
    "top_domains": [{"domain": d, "count": c} for d, c in Counter(domains).most_common(8)],
    "active_outbound_sockets": [{"dest": dst, "count": c} for dst, c in Counter(conns).most_common(8)],
    "recent_proxy_logs": recent_logs[-10:],
    "security_events": sec_events[-5:]
}
print(json.dumps(res, indent=2))
'''

def test():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    ssh.connect(HOST, port=PORT, username=USER, pkey=key, timeout=10)

    sftp = ssh.open_sftp()
    with sftp.open("/tmp/test_proxy.py", "w") as f:
        f.write(REMOTE_SCRIPT)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command("python3 /tmp/test_proxy.py")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("OUTPUT:\n", out)
    if err:
        print("ERR:\n", err)
    ssh.close()

if __name__ == '__main__':
    test()
