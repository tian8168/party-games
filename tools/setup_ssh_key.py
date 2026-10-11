#!/usr/bin/env python3
import os
import sys
import subprocess
import paramiko

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

KEY_PATH = r"C:\Users\admin\.ssh\id_ed25519_tian"
PUB_PATH = KEY_PATH + ".pub"
CONFIG_PATH = r"C:\Users\admin\.ssh\config"

HOST = "141.11.139.61"
PORT = 27324
USER = "root"
PASSWORD = "z.u9rQ_|}WH."

def setup_ssh():
    if not os.path.exists(KEY_PATH):
        print(f"Generating new Ed25519 key at {KEY_PATH}...")
        cmd = f'ssh-keygen -t ed25519 -N "" -f "{KEY_PATH}"'
        subprocess.run(cmd, shell=True, check=True)
        print("Key generated successfully.")
    else:
        print(f"Key already exists at {KEY_PATH}")

    with open(PUB_PATH, "r", encoding="utf-8") as f:
        pub_key = f.read().strip()
    print(f"Public key to inject:\n{pub_key}")

    # Connect to VPS and inject public key
    print(f"Connecting to {HOST}:{PORT} to inject authorized_key...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=10)

    # Append to /root/.ssh/authorized_keys if not present
    inject_cmd = f'''
mkdir -p /root/.ssh && chmod 700 /root/.ssh
if ! grep -q "{pub_key}" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "{pub_key}" >> /root/.ssh/authorized_keys
    echo "INJECTED_SUCCESSFULLY"
else
    echo "ALREADY_EXISTS"
fi
chmod 600 /root/.ssh/authorized_keys
'''
    stdin, stdout, stderr = ssh.exec_command(inject_cmd)
    res = stdout.read().decode('utf-8').strip()
    print("Remote injection result:", res)
    ssh.close()

    # Configure local ~/.ssh/config
    ssh_config_entry = f"""
Host tokyo
    HostName {HOST}
    Port {PORT}
    User {USER}
    IdentityFile {KEY_PATH}
    StrictHostKeyChecking no
"""
    config_content = ""
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config_content = f.read()

    if "Host tokyo" not in config_content:
        with open(CONFIG_PATH, "a", encoding="utf-8") as f:
            f.write(ssh_config_entry)
        print("Updated ~/.ssh/config with Host tokyo alias.")
    else:
        print("~/.ssh/config already contains Host tokyo.")

if __name__ == '__main__':
    setup_ssh()
