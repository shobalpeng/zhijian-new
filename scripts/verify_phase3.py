"""Phase 3 端到端验证：任务/心愿状态机 + 服务端积分发放（幂等 / 月度上限 / 余额下限 0）。

用法: python scripts/verify_phase3.py http://127.0.0.1:8100
脚本自带清理，可重复运行。
"""
import json
import sys
import urllib.parse
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8100"
PWD = "ZhijianTest#2026"
SUFFIX = "p3"


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


def check(label, cond, extra=""):
    print("  [%s] %s %s" % ("OK" if cond else "FAIL", label, extra))
    return cond


def admin_token():
    st, su = api("POST", "/api/collections/_superusers/auth-with-password", body={
        "identity": "admin@zhijian.app", "password": "Zhijian#2026!",
    })
    return su.get("token")


def cleanup():
    """清空 users（级联删除 user_settings / tasks / wishes / point_transactions）"""
    tok = admin_token()
    if not tok:
        print("  [WARN] superuser 登录失败，跳过清理")
        return
    st, lst = api("GET", "/api/collections/users/records?perPage=100", tok)
    for u in lst.get("items", []):
        api("DELETE", "/api/collections/users/records/" + u["id"], token=tok)
    st, pt = api("GET", "/api/collections/point_transactions/records?perPage=200", tok)
    for p in pt.get("items", []):
        api("DELETE", "/api/collections/point_transactions/records/" + p["id"], token=tok)
    print("  清理历史：users=%d, point_transactions=%d" % (
        len(lst.get("items", [])), len(pt.get("items", []))))


def create_user(username, name):
    st, resp = api("POST", "/api/collections/users/records", body={
        "username": username, "email": username + "@zhijian.local",
        "emailVisibility": False, "name": name,
        "password": PWD, "passwordConfirm": PWD,
    })
    if st != 200:
        print("  [FAIL] 创建用户 %s -> %s %s" % (username, st, json.dumps(resp, ensure_ascii=False)[:200]))
        return None
    return resp


def login(username):
    st, resp = api("POST", "/api/collections/users/auth-with-password", body={
        "identity": username + "@zhijian.local", "password": PWD,
    })
    return (resp.get("token"), resp.get("record")) if st == 200 else (None, None)


def balance(token):
    st, resp = api("GET", "/api/zhijian/balance", token=token)
    return resp.get("me", 0) if st == 200 else None


def my_earned_this_month(token, uid):
    st, resp = api("GET",
                   "/api/collections/point_transactions/records?perPage=200"
                   "&filter=" + urllib.parse.quote('user = "%s" && type = "earned"' % uid),
                   token=token)
    return sum(p.get("amount", 0) for p in resp.get("items", [])) if st == 200 else None


def main():
    ok = True
    ua = "alice_" + SUFFIX
    ub = "bob_" + SUFFIX

    print("== 0. 清理历史数据 ==")
    cleanup()

    print("== 1. 注册并配对 ==")
    a = create_user(ua, "Alice")
    b = create_user(ub, "Bob")
    if not a or not b:
        sys.exit(1)
    ta, _ = login(ua)
    tb, _ = login(ub)
    ok &= check("两人登录成功", bool(ta) and bool(tb))
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": b["invite_code"]})
    ok &= check("配对成功", st == 200, json.dumps(resp, ensure_ascii=False))

    print("== 2. Alice 创建任务（不传 creator，由钩子补齐） ==")
    st, task = api("POST", "/api/collections/tasks/records", token=ta, body={
        "title": "洗碗", "description": "晚饭后", "points": 10, "assignee": b["id"],
    })
    if st != 200:
        print("  [FAIL] 创建任务 -> %s %s" % (st, json.dumps(task, ensure_ascii=False)[:300]))
        sys.exit(1)
    ok &= check("创建成功且 creator=Alice", task.get("creator") == a["id"], task.get("creator"))
    ok &= check("状态强制为 pending", task.get("status") == "pending", task.get("status"))

    print("== 3. 状态机权限校验 ==")
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=ta,
                   body={"status": "submitted"})
    ok &= check("Alice(创建者)不能提交 -> 403", st == 403, str(st) + " " + json.dumps(resp, ensure_ascii=False)[:120])
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=tb,
                   body={"status": "confirmed"})
    ok &= check("Bob 跳级 confirmed -> 400", st == 400, str(st))

    print("== 4. Bob 提交 ==")
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=tb,
                   body={"status": "submitted"})
    ok &= check("提交成功", st == 200 and resp.get("status") == "submitted", json.dumps(resp, ensure_ascii=False)[:160])
    ok &= check("自动写入 submitted_at", bool(resp.get("submitted_at")), str(resp.get("submitted_at")))
    task = resp

    print("== 5. Bob(非创建者)不能确认 ==")
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=tb,
                   body={"status": "confirmed"})
    ok &= check("Bob 确认 -> 403", st == 403, str(st))
    ok &= check("Alice 余额仍为 0", balance(ta) == 0, str(balance(ta)))
    ok &= check("Bob 余额仍为 0", balance(tb) == 0, str(balance(tb)))

    print("== 6. Alice 确认 -> 发放积分给 Bob ==")
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=ta,
                   body={"status": "confirmed"})
    ok &= check("确认成功", st == 200 and resp.get("status") == "confirmed", json.dumps(resp, ensure_ascii=False)[:160])
    ok &= check("自动写入 confirmed_at", bool(resp.get("confirmed_at")), str(resp.get("confirmed_at")))
    ok &= check("Bob 积分 +10", balance(tb) == 10, str(balance(tb)))
    ok &= check("Alice 积分 0", balance(ta) == 0, str(balance(ta)))

    print("== 7. 幂等：已确认不可再变更，且不重复发分 ==")
    st, resp = api("PATCH", "/api/collections/tasks/records/" + task["id"], token=ta,
                   body={"status": "confirmed"})
    ok &= check("终态再确认 -> 400", st == 400, str(st))
    ok &= check("Bob 积分仍为 10（未重复发放）", balance(tb) == 10, str(balance(tb)))

    print("== 8. 删除权限 ==")
    st, t2 = api("POST", "/api/collections/tasks/records", token=ta, body={
        "title": "倒垃圾", "points": 5, "assignee": b["id"],
    })
    st, resp = api("DELETE", "/api/collections/tasks/records/" + t2["id"], token=tb)
    ok &= check("Bob(非创建者)删除 -> 403", st == 403, str(st))
    st, resp = api("DELETE", "/api/collections/tasks/records/" + t2["id"], token=ta)
    ok &= check("Alice 删除 pending 任务 -> 204/200", st in (200, 204), str(st))

    st, t3 = api("POST", "/api/collections/tasks/records", token=ta, body={
        "title": "扫地", "points": 7, "assignee": b["id"],
    })
    api("PATCH", "/api/collections/tasks/records/" + t3["id"], token=tb, body={"status": "submitted"})
    st, resp = api("DELETE", "/api/collections/tasks/records/" + t3["id"], token=ta)
    ok &= check("删除 submitted 任务 -> 400", st == 400, str(st))

    print("== 9. 心愿：Alice 许愿，Bob 实现，确认后 Alice 扣分 ==")
    # 先让 Alice 赚 5 分（Bob 发起、Alice 执行）
    st, ta_task = api("POST", "/api/collections/tasks/records", token=tb, body={
        "title": "浇花", "points": 5, "assignee": a["id"],
    })
    api("PATCH", "/api/collections/tasks/records/" + ta_task["id"], token=ta, body={"status": "submitted"})
    st, resp = api("PATCH", "/api/collections/tasks/records/" + ta_task["id"], token=tb,
                   body={"status": "confirmed"})
    ok &= check("Alice 赚到 5 分", balance(ta) == 5, str(balance(ta)))

    st, wish = api("POST", "/api/collections/wishes/records", token=ta, body={
        "title": "一起看电影", "points": 100, "fulfiller": b["id"],
    })
    ok &= check("许愿成功且 fulfiller=Bob", st == 200 and wish.get("fulfiller") == b["id"], json.dumps(wish, ensure_ascii=False)[:160])
    st, resp = api("PATCH", "/api/collections/wishes/records/" + wish["id"], token=ta, body={"status": "submitted"})
    ok &= check("Alice 不能提交心愿 -> 403", st == 403, str(st))
    st, resp = api("PATCH", "/api/collections/wishes/records/" + wish["id"], token=tb, body={"status": "submitted"})
    ok &= check("Bob 提交心愿成功", st == 200 and resp.get("status") == "submitted", str(st))
    st, resp = api("PATCH", "/api/collections/wishes/records/" + wish["id"], token=ta, body={"status": "confirmed"})
    ok &= check("Alice 确认心愿成功", st == 200 and resp.get("status") == "confirmed", str(st))
    ok &= check("余额下限 0：Alice 扣到 0 不为负", balance(ta) == 0, str(balance(ta)))
    # 心愿确认只扣 creator(Alice) 的分，Bob 不受影响，仍是任务所得的 10 分
    ok &= check("Bob 积分未受影响（10）", balance(tb) == 10, str(balance(tb)))

    print("== 10. 月度上限（earned 截断） ==")
    # 读取 Alice 的 user_settings，设置 cap = 本月已 earned + 3
    st, lst = api("GET", "/api/collections/user_settings/records?perPage=10"
                  "&filter=" + urllib.parse.quote('user = "%s"' % a["id"]), token=ta)
    if st == 200 and lst.get("items"):
        sid = lst["items"][0]["id"]
        earned_before = my_earned_this_month(ta, a["id"]) or 0
        cap = earned_before + 3
        st, resp = api("PATCH", "/api/collections/user_settings/records/" + sid, token=ta,
                       body={"monthly_point_cap": cap})
        ok &= check("设置月度上限成功", st == 200, str(st))
        # Bob 发起、Alice 执行，任务 10 分 -> 应只发 3 分
        st, t4 = api("POST", "/api/collections/tasks/records", token=tb, body={
            "title": "买菜", "points": 10, "assignee": a["id"],
        })
        api("PATCH", "/api/collections/tasks/records/" + t4["id"], token=ta, body={"status": "submitted"})
        st, resp = api("PATCH", "/api/collections/tasks/records/" + t4["id"], token=tb,
                       body={"status": "confirmed"})
        ok &= check("超出上限部分被截断（实发 3）", balance(ta) == 3, "实际=%s" % balance(ta))
    else:
        ok &= check("读取 user_settings", False, json.dumps(lst, ensure_ascii=False)[:160])

    print("== 11. 并发确认：积分只发放一次（V1 重复发分的根治点） ==")
    # 清掉 Alice 的月度上限（她是本任务的收款方），避免干扰
    st, lst = api("GET", "/api/collections/user_settings/records?perPage=10"
                  "&filter=" + urllib.parse.quote('user = "%s"' % a["id"]), token=ta)
    if st == 200 and lst.get("items"):
        stc, rc = api("PATCH", "/api/collections/user_settings/records/" + lst["items"][0]["id"],
                      token=ta, body={"monthly_point_cap": None})
        ok &= check("清除 Alice 月度上限", stc == 200, json.dumps(rc, ensure_ascii=False)[:120])
    before = balance(ta)
    st, t5 = api("POST", "/api/collections/tasks/records", token=tb, body={
        "title": "并发测试", "points": 20, "assignee": a["id"],
    })
    api("PATCH", "/api/collections/tasks/records/" + t5["id"], token=ta, body={"status": "submitted"})
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(
            api, "PATCH", "/api/collections/tasks/records/" + t5["id"], tb, {"status": "confirmed"}
        ) for _ in range(4)]
        for f in futs:
            results.append(f.result()[0])
    success = [s for s in results if s == 200]
    # 并发下多个请求都可能通过 before 校验而返回 200；关键是流水与余额只能变化一次
    ok &= check("并发 4 次确认至少 1 次成功", len(success) >= 1, "状态码=" + str(results))
    st, txs = api("GET", "/api/collections/point_transactions/records?perPage=50"
                  "&filter=" + urllib.parse.quote('source_id = "%s"' % t5["id"]), token=ta)
    ok &= check("只产生 1 条积分流水", len(txs.get("items", [])) == 1,
                "实际=%d raw=%s" % (len(txs.get("items", [])), json.dumps(txs, ensure_ascii=False)[:200]))
    if txs.get("items"):
        ok &= check("流水金额为 20", txs["items"][0].get("amount") == 20,
                    str(txs["items"][0].get("amount")))
    ok &= check("Alice 只增加 20 分", balance(ta) == before + 20,
                "before=%s after=%s" % (before, balance(ta)))

    print("== 清理测试数据 ==")
    cleanup()

    print("\n== 结果：%s ==" % ("全部通过" if ok else "存在失败项"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
