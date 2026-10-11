#!/usr/bin/env python3
import sys
import paramiko

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
PASSWORD = "z.u9rQ_|}WH."

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=10)

stdin, stdout, stderr = ssh.exec_command("cat /opt/clash-sub/server.py | tail -n 90")
print(stdout.read().decode('utf-8', errors='ignore'))
ssh.close()
