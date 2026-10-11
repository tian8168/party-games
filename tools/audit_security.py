#!/usr/bin/env python3
import sys
import paramiko
import json

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"

def run():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    key = paramiko.Ed25519Key.from_private_key_file(KEY_PATH)
    ssh.connect(HOST, port=PORT, username=USER, pkey=key, timeout=10)

    # 1. Investigate the 77.239.124.0/24 cluster & others
    ips = ["77.239.124.161", "77.239.124.105", "77.239.124.100", "77.239.124.116", "183.199.88.190", "143.20.185.204", "134.195.101.84"]
    print("=== WHOIS & GEO INTELLIGENCE ===")
    for ip in ips:
        stdin, stdout, stderr = ssh.exec_command(f"curl -s http://ip-api.com/json/{ip}")
        data = stdout.read().decode('utf-8')
        try:
            parsed = json.loads(data)
            print(f"{ip:18} | Country: {parsed.get('country')}, City: {parsed.get('city')}, ISP: {parsed.get('isp')}, AS: {parsed.get('as')}")
        except Exception:
            print(f"{ip:18} | {data[:80]}")

    # 2. Check current listening ports on Tokyo VPS
    print("\n=== LISTENING NETWORK SERVICES (ss -tunlp) ===")
    stdin, stdout, stderr = ssh.exec_command("ss -tunlp")
    print(stdout.read().decode('utf-8'))

    # 3. Check clash-sub web logs for any suspicious probes/HTTP 404/400
    print("\n=== CLASH-SUB ACCESS LOGS (Suspicious / Unauthorized requests) ===")
    stdin, stdout, stderr = ssh.exec_command("journalctl -u clash-sub.service --no-pager | grep -v '127.0.0.1' | grep -v '200' | tail -n 20")
    print(stdout.read().decode('utf-8') or "None found.")

    # 4. Check iptables current rules in f2b-sshd and INPUT
    print("\n=== CURRENT IPTABLES DEFENSE CHAINS ===")
    stdin, stdout, stderr = ssh.exec_command("iptables -L f2b-sshd -n -v --line-numbers")
    print(stdout.read().decode('utf-8'))

    # 5. Check fail2ban status
    print("\n=== FAIL2BAN JAIL STATUS ===")
    stdin, stdout, stderr = ssh.exec_command("fail2ban-client status sshd")
    print(stdout.read().decode('utf-8'))

    # 6. Check system load, active processes, and scheduled cron/timers
    print("\n=== SYSTEM HEALTH & PERSISTENCE CHECK ===")
    stdin, stdout, stderr = ssh.exec_command("crontab -l; ls -la /etc/cron.d; uptime")
    print(stdout.read().decode('utf-8'))

    ssh.close()

if __name__ == '__main__':
    run()
