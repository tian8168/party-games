#!/usr/bin/env python3
import paramiko

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"

def run():
    print("Reading vps_monitor.html...")
    with open(r"C:\Users\admin\Desktop\partygame\netops\vps_monitor.html", "r", encoding="utf-8") as f:
        content = f.read()

    # Convert paths to absolute root for standalone VPS origin
    content = content.replace('href="../common/common.css"', 'href="/common/common.css"')
    content = content.replace('href="../common/metro.css"', 'href="/common/metro.css"')
    content = content.replace(
        '<a href="../index.html" class="nav-back">🔙 返回大厅</a>',
        '<a href="https://party-games-ckf.pages.dev" target="_blank" class="nav-back" title="访问托管在 Cloudflare 边缘节点的聚会游戏大厅">🎮 聚会游戏大厅 (Cloudflare 边缘)</a>'
    )

    print("Connecting to Tokyo VPS...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    ssh.connect(HOST, port=PORT, username=USER, pkey=key, timeout=10)

    sftp = ssh.open_sftp()
    print("Uploading standalone index.html to /opt/clash-sub/web/index.html...")
    with sftp.open("/opt/clash-sub/web/index.html", "w") as f:
        f.write(content)
    sftp.close()

    print("Configuring symlink and permissions...")
    cmd = (
        "mkdir -p /opt/clash-sub/web/netops && "
        "ln -sf /opt/clash-sub/web/index.html /opt/clash-sub/web/netops/vps_monitor.html && "
        "chmod -R a+rX /opt/clash-sub/web && "
        "ls -la /opt/clash-sub/web && "
        "du -sh /opt/clash-sub/web"
    )
    stdin, stdout, stderr = ssh.exec_command(cmd)
    res = stdout.read().decode("utf-8")
    print(res)

    print("\nVerifying HTTP response...")
    stdin, stdout, stderr = ssh.exec_command("curl -k -s 'https://127.0.0.1:58443/' | head -n 10")
    print(stdout.read().decode("utf-8"))

    ssh.close()
    print("\n=== STANDALONE CONSOLE DEPLOYMENT COMPLETE ===")

if __name__ == '__main__':
    run()
