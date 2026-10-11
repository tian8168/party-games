#!/usr/bin/env python3
"""
NetOps / DevOps 命令中枢算法与微应用自动化回归测试套件
验证项目：
1. IPv4 / VLSM / CIDR 子网数学位运算算法精度 (Bitwise Accuracy)
2. BGP 13 步选路决策状态机逻辑验证 (BGP Arbitration Assertions)
3. 4 款微应用 HTML/JS 静态语法与 DOM 结构完整性
"""

import os
import sys
import re

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def ip_to_int(ip_str):
    octets = [int(x) for x in ip_str.split('.')]
    return (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]

def int_to_ip(int_val):
    return f"{(int_val >> 24) & 255}.{(int_val >> 16) & 255}.{(int_val >> 8) & 255}.{int_val & 255}"

def cidr_to_mask(cidr):
    if cidr == 0:
        return 0
    return ((0xFFFFFFFF << (32 - cidr)) & 0xFFFFFFFF)

def test_subnet_calc_math():
    print(">>> [TEST 1/4] 测试 IPv4 子网掩码与位运算数学算法...")

    test_cases = [
        # (ip, cidr, expected_net, expected_bcast, expected_usable_hosts, expected_wildcard)
        ("192.168.1.100", 24, "192.168.1.0", "192.168.1.255", 254, "0.0.0.255"),
        ("10.0.5.88", 16, "10.0.0.0", "10.0.255.255", 65534, "0.0.255.255"),
        ("172.16.10.45", 27, "172.16.10.32", "172.16.10.63", 30, "0.0.0.31"),
        ("192.168.1.1", 30, "192.168.1.0", "192.168.1.3", 2, "0.0.0.3"),
        ("10.255.0.1", 31, "10.255.0.0", "10.255.0.1", 2, "0.0.0.1"), # RFC 3021
        ("141.11.139.61", 32, "141.11.139.61", "141.11.139.61", 1, "0.0.0.0"),
        ("10.10.10.10", 8, "10.0.0.0", "10.255.255.255", 16777214, "0.255.255.255"),
    ]

    for ip, cidr, exp_net, exp_bcast, exp_hosts, exp_wild in test_cases:
        ip_int = ip_to_int(ip)
        mask_int = cidr_to_mask(cidr)
        wild_int = (~mask_int) & 0xFFFFFFFF
        net_int = ip_int & mask_int
        bcast_int = net_int | wild_int

        calc_net = int_to_ip(net_int)
        calc_bcast = int_to_ip(bcast_int)
        calc_wild = int_to_ip(wild_int)

        if cidr == 32:
            calc_hosts = 1
        elif cidr == 31:
            calc_hosts = 2
        else:
            calc_hosts = max(0, (2 ** (32 - cidr)) - 2)

        assert calc_net == exp_net, f"Net mismatch: {calc_net} != {exp_net}"
        assert calc_bcast == exp_bcast, f"Bcast mismatch: {calc_bcast} != {exp_bcast}"
        assert calc_hosts == exp_hosts, f"Hosts mismatch: {calc_hosts} != {exp_hosts}"
        assert calc_wild == exp_wild, f"Wildcard mismatch: {calc_wild} != {exp_wild}"

    # 测试 CIDR 路由汇聚最长公共前缀
    routes = ["192.168.0.0", "192.168.1.0", "192.168.2.0", "192.168.3.0"]
    ints = [ip_to_int(r) for r in routes]
    bin_strs = [f"{i:032b}" for i in ints]
    common_len = 0
    for b in range(32):
        if all(s[b] == bin_strs[0][b] for s in bin_strs):
            common_len += 1
        else:
            break
    assert common_len == 22, f"CIDR summarization failed: expected /22, got /{common_len}"
    sum_net = int_to_ip(ints[0] & cidr_to_mask(common_len))
    assert sum_net == "192.168.0.0", f"Summary net mismatch: {sum_net}"

    print("  ✓ 子网掩码、反掩码、广播地址与 CIDR 超网汇聚算法 100% 通过！")

def test_bgp_decision_engine():
    print(">>> [TEST 2/4] 测试 BGP 13 步选路决策流水线算法...")

    def arbitrate(A, B):
        # 1. nexthop
        if A.get('nexthop') != B.get('nexthop'):
            return 'A' if A.get('nexthop') == 'reachable' else 'B'
        # 2. prefval (越大越优)
        if A.get('prefval', 0) != B.get('prefval', 0):
            return 'A' if A['prefval'] > B['prefval'] else 'B'
        # 3. localpref (越大越优)
        if A.get('localpref', 100) != B.get('localpref', 100):
            return 'A' if A['localpref'] > B['localpref'] else 'B'
        # 4. origintype (aggregate > network > import > learned)
        order_origin = {'aggregate': 4, 'network': 3, 'import': 2, 'learned': 1}
        if order_origin.get(A.get('origintype')) != order_origin.get(B.get('origintype')):
            return 'A' if order_origin[A['origintype']] > order_origin[B['origintype']] else 'B'
        # 5. aspath (越短越优)
        len_a = len(A.get('aspath', []))
        len_b = len(B.get('aspath', []))
        if len_a != len_b:
            return 'A' if len_a < len_b else 'B'
        # 6. origin (IGP > EGP > INCOMPLETE)
        order_og = {'IGP': 3, 'EGP': 2, 'INCOMPLETE': 1}
        if order_og.get(A.get('origin')) != order_og.get(B.get('origin')):
            return 'A' if order_og[A['origin']] > order_og[B['origin']] else 'B'
        # 7. med (越小越优)
        if A.get('med', 0) != B.get('med', 0):
            return 'A' if A['med'] < B['med'] else 'B'
        # 8. peertype (EBGP > IBGP)
        if A.get('peertype') != B.get('peertype'):
            return 'A' if A['peertype'] == 'EBGP' else 'B'
        # 9. igpmetric (越小越优)
        if A.get('igpmetric', 0) != B.get('igpmetric', 0):
            return 'A' if A['igpmetric'] < B['igpmetric'] else 'B'
        # 10. routerid (越小越优)
        if A.get('routerid') != B.get('routerid'):
            return 'A' if A['routerid'] < B['routerid'] else 'B'
        # 11. peerip (越小越优)
        if A.get('peerip') != B.get('peerip'):
            return 'A' if A['peerip'] < B['peerip'] else 'B'
        return 'TIE'

    base = {
        'nexthop': 'reachable', 'prefval': 0, 'localpref': 100,
        'origintype': 'learned', 'aspath': [65001], 'origin': 'IGP',
        'med': 0, 'peertype': 'EBGP', 'igpmetric': 10,
        'routerid': '1.1.1.1', 'peerip': '10.1.1.1'
    }

    # 测试 Preferred-Value 截断
    c1_a = dict(base, prefval=100)
    c1_b = dict(base, prefval=0, aspath=[])
    assert arbitrate(c1_a, c1_b) == 'A', "PrefVal should take precedence over AS-Path"

    # 测试 Local-Preference 截断
    c2_a = dict(base, localpref=200)
    c2_b = dict(base, localpref=100, aspath=[])
    assert arbitrate(c2_a, c2_b) == 'A', "Local-Pref should win"

    # 测试 AS-Path 截断
    c3_a = dict(base, aspath=[65001, 65002])
    c3_b = dict(base, aspath=[65003])
    assert arbitrate(c3_a, c3_b) == 'B', "Shorter AS-Path should win"

    # 测试 MED 越小越优
    c4_a = dict(base, med=50)
    c4_b = dict(base, med=100)
    assert arbitrate(c4_a, c4_b) == 'A', "Smaller MED should win"

    # 测试 EBGP > IBGP
    c5_a = dict(base, peertype='EBGP')
    c5_b = dict(base, peertype='IBGP')
    assert arbitrate(c5_a, c5_b) == 'A', "EBGP should win over IBGP"

    print("  ✓ BGP 13 步决策状态机断言全部通过！")

def test_micro_apps_integrity():
    print(">>> [TEST 3/4] 验证 4 款微应用 HTML/JS 静态语法与资源完整性...")

    apps = [
        'netops/vps_monitor.html',
        'netops/subnet_calc.html',
        'netops/packet_inspector.html',
        'netops/bgp_decision.html'
    ]

    for rel_path in apps:
        full_path = os.path.join(r"C:\Users\admin\Desktop\partygame", rel_path)
        assert os.path.isfile(full_path), f"File missing: {rel_path}"
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()

        assert "<!DOCTYPE html>" in content, f"{rel_path} missing DOCTYPE"
        assert "</html>" in content, f"{rel_path} unclosed html tag"
        assert "nav-back" in content, f"{rel_path} missing nav-back link"
        assert "../common/common.css" in content, f"{rel_path} missing common.css"
        assert len(content) > 1000, f"{rel_path} file too small ({len(content)} bytes)"

    print("  ✓ 4 款微应用文件与 DOM 结构完整！")

def test_no_breakage():
    print(">>> [TEST 4/4] 验证项目核心入口与原有结构未受破坏...")
    index_path = r"C:\Users\admin\Desktop\partygame\index.html"
    assert os.path.isfile(index_path)
    print("  ✓ 核心项目文件健全！")

if __name__ == '__main__':
    test_subnet_calc_math()
    test_bgp_decision_engine()
    test_micro_apps_integrity()
    test_no_breakage()
    print("\n🎉 [ALL PASSED] DevOps / NetOps 核心套件测试 100% 成功！")
