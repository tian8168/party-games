#!/usr/bin/env python3
import sys
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

URL = "https://tian-proxy.duckdns.org:58443/api/v1/metrics?token=2ed5d9e3a9b258c8d6b33a5addfa43b9e590e6f3e4185679d8c7fc8c542f79f8"

options = Options()
options.add_argument('--headless=new')
options.add_argument('--ignore-certificate-errors')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

print("Launching headless Chrome to test browser fetch of metrics API...")
driver = webdriver.Chrome(options=options)
try:
    driver.get(URL)
    body_text = driver.find_element("tag name", "body").text
    print("\n--- BROWSER BODY OUTPUT ---")
    print(body_text[:400])
    parsed = json.loads(body_text)
    print("\n✓ Valid JSON successfully fetched by browser engine!")
    print(f"Status: {parsed.get('status')}")
    print(f"CPU Load: {parsed.get('cpu')}")
    print(f"Memory: {parsed.get('memory')}")
    print(f"Network: {parsed.get('network')}")
    print(f"TCP: {parsed.get('tcp')}")
    print(f"Services: {parsed.get('services')}")
except Exception as e:
    print("Browser fetch failed:", e)
finally:
    driver.quit()
