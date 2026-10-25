"""Phase 2 端到端验证：邀请码自动生成 + 情侣配对 + 积分余额 + 幂等。

用法: python scripts/verify_phase2.py http://127.0.0.1:8100
验证完自动清理测试用户。
"""
import json
import sys
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8100"
SUFFIX = "p2"


def api(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def create_user(username, name):
    st, resp = api("POST", "/api/collections/users/records", body={
        "username": username,
        "email": username + "@zhijian.local",
        "emailVisibility": False,
        "name": name,
        "password": "ZhijianTest#2026",
        "passwordConfirm": "ZhijianTest#2026",
    })
    if st not in (200, 204):
        print("  [FAIL] 创建用户 %s -> %s %s" % (username, st, json.dumps(resp, ensure_ascii=False)))
        return None
    print("  [OK] 创建用户 %s，invite_code=%s" % (username, resp.get("invite_code")))
    return resp


def login(username):
    # 与前端一致：用户名 -> 占位邮箱（v0.40 的 identityFields 只开了 email）
    st, resp = api("POST", "/api/collections/users/auth-with-password", body={
        "identity": username + "@zhijian.local", "password": "ZhijianTest#2026",
    })
    if st != 200:
        print("  [FAIL] 登录 %s -> %s" % (username, st))
        return None, None
    return resp["token"], resp["record"]


def check(label, cond, extra=""):
    print("  [%s] %s %s" % ("OK" if cond else "FAIL", label, extra))
    return cond


def cleanup_users():
    """清空 users（当前库只有测试账号），保证脚本可重复运行"""
    st, su = api("POST", "/api/collections/_superusers/auth-with-password", body={
        "identity": "admin@zhijian.app", "password": "Zhijian#2026!",
    })
    admin = su.get("token")
    if not admin:
        print("  [WARN] superuser 登录失败，跳过清理")
        return
    st, lst = api("GET", "/api/collections/users/records?perPage=100", admin)
    for u in lst.get("items", []):
        api("DELETE", "/api/collections/users/records/" + u["id"], token=admin)
    print("  清理历史用户：%d 条" % len(lst.get("items", [])))


def main():
    ok = True
    ua = "alice_" + SUFFIX
    ub = "bob_" + SUFFIX

    print("== 0. 清理历史测试用户 ==")
    cleanup_users()

    print("== 1. 注册（钩子应自动生成 invite_code） ==")
    a = create_user(ua, "Alice")
    b = create_user(ub, "Bob")
    if not a or not b:
        sys.exit(1)
    ok &= check("Alice 有邀请码", bool(a.get("invite_code")), a.get("invite_code"))
    ok &= check("Bob 有邀请码", bool(b.get("invite_code")), b.get("invite_code"))
    ok &= check("邀请码互不相同", a.get("invite_code") != b.get("invite_code"))

    print("== 2. 用户名登录 ==")
    ta, ra = login(ua)
    tb, rb = login(ub)
    ok &= check("Alice 登录成功", bool(ta))
    ok &= check("Bob 登录成功", bool(tb))

    print("== 3. 配对（Alice 用 Bob 的邀请码） ==")
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": b["invite_code"]})
    ok &= check("配对返回 200", st == 200, json.dumps(resp, ensure_ascii=False))

    st, after_a = api("GET", "/api/collections/users/records/" + a["id"], token=ta)
    st2, after_b = api("GET", "/api/collections/users/records/" + b["id"], token=tb)
    ok &= check("Alice.paired_user = Bob", after_a.get("paired_user") == b["id"])
    ok &= check("Bob.paired_user = Alice", after_b.get("paired_user") == a["id"])

    print("== 4. 幂等：重复配对 ==")
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": b["invite_code"]})
    ok &= check("重复配对仍成功且标记 already", st == 200 and resp.get("already") is True, json.dumps(resp, ensure_ascii=False))

    print("== 5. 非法输入 ==")
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": "ZZZZZZZZ"})
    ok &= check("无效邀请码 -> 404", st == 404, str(st))
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": a["invite_code"]})
    ok &= check("自己配对自己 -> 400", st == 400, str(st))
    st, resp = api("POST", "/api/zhijian/pair", body={"code": b["invite_code"]})
    ok &= check("未登录配对 -> 401", st == 401, str(st))

    print("== 6. 伴侣资料可见（users.viewRule） ==")
    st, resp = api("GET", "/api/collections/users/records/" + b["id"], token=ta)
    ok &= check("Alice 可读取 Bob 资料", st == 200 and resp.get("username") == ub, str(st))

    print("== 7. 积分余额（sum point_transactions） ==")
    st, resp = api("GET", "/api/zhijian/balance", token=ta)
    ok &= check("余额接口 200", st == 200, json.dumps(resp, ensure_ascii=False))

    print("== 8. 解除配对 ==")
    st, resp = api("POST", "/api/zhijian/unpair", token=ta)
    st, after_a = api("GET", "/api/collections/users/records/" + a["id"], token=ta)
    ok &= check("解除后 paired_user 为空", st == 200 and not after_a.get("paired_user"), json.dumps(resp, ensure_ascii=False))

    print("== 清理测试用户 ==")
    st, su = api("POST", "/api/collections/_superusers/auth-with-password", body={
        "identity": "admin@zhijian.app", "password": "Zhijian#2026!",
    })
    admin = su.get("token")
    # 清空 users（当前库内只有测试账号，含 Phase 0 遗留的 phase0test）
    st, lst = api("GET", "/api/collections/users/records?perPage=100", admin)
    for u in lst.get("items", []):
        st, _ = api("DELETE", "/api/collections/users/records/" + u["id"], token=admin)
        print("  delete %s (%s) -> %s" % (u["id"], u.get("username") or u.get("email"), st))

    print("\n== 结果：%s ==" % ("全部通过" if ok else "存在失败项"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
