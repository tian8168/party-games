#!/usr/bin/env python3
import paramiko
import json

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"

def update():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    ssh.connect(HOST, port=PORT, username=USER, pkey=key, timeout=10)

    sftp = ssh.open_sftp()
    with sftp.open("/usr/local/etc/xray/config.json", "r") as f:
        cfg = json.loads(f.read().decode('utf-8'))
    
    cfg["log"] = {
        "access": "/var/log/xray/access.log",
        "loglevel": "info"
    }

    with sftp.open("/usr/local/etc/xray/config.json", "w") as f:
        f.write(json.dumps(cfg, indent=2))
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command("chown -R nobody:nogroup /var/log/xray && systemctl restart xray.service && sleep 1 && systemctl status xray.service | head -n 8")
    print(stdout.read().decode('utf-8'))
    ssh.close()

if __name__ == '__main__':
    update()
