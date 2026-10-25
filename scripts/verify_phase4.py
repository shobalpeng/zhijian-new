"""Phase 4 端到端验证：内容模块（recipes/anniversaries/travel/wanders/dines/items/todos）
的集合可用性、情侣对共享与 personal 隔离、以及菜谱统计钩子。

用法: python scripts/verify_phase4.py http://127.0.0.1:8111
脚本自带清理，可重复运行。
"""
import json
import sys
import urllib.parse
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8111"
PWD = "ZhijianTest#2026"
SUFFIX = "p4"

# 内容模块集合（清理顺序：被引用者先删）
CONTENT_COLLECTIONS = [
    "recipes", "cook_history", "anniversaries", "destinations",
    "expenses", "wanders", "dines", "items", "todos",
]


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
    return su.get("token") if st == 200 else None


def cleanup():
    tok = admin_token()
    if not tok:
        print("  [WARN] superuser 登录失败，跳过清理")
        return
    # 先清被引用的子表，避免必填关系阻止删除
    for name in ["point_transactions", "cook_history", "expenses", "destinations",
                 "recipes", "anniversaries", "wanders", "dines", "items", "todos"]:
        st, lst = api("GET", "/api/collections/%s/records?perPage=200" % name, tok)
        for r in lst.get("items", []):
            api("DELETE", "/api/collections/%s/records/%s" % (name, r["id"]), token=tok)
    st, lst = api("GET", "/api/collections/users/records?perPage=100", tok)
    for u in lst.get("items", []):
        api("DELETE", "/api/collections/users/records/" + u["id"], token=tok)
    print("  清理完成（users=%d）" % len(lst.get("items", [])))


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


def lst(token, collection, filt=None):
    q = "/api/collections/%s/records?perPage=200" % collection
    if filt:
        q += "&filter=" + urllib.parse.quote(filt)
    st, resp = api("GET", q, token=token)
    if st != 200:
        print("     [warn] list %s -> %s %s" % (collection, st, json.dumps(resp, ensure_ascii=False)[:200]))
        return []
    return resp.get("items", [])


def main():
    ok = True
    ua = "alice_" + SUFFIX
    ub = "bob_" + SUFFIX
    uc = "carol_" + SUFFIX

    print("== 0. 清理历史数据 ==")
    cleanup()

    print("== 1. 集合是否齐全 ==")
    tok = admin_token()
    if not tok:
        print("  [FAIL] superuser 登录失败")
        sys.exit(1)
    st, cols = api("GET", "/api/collections?perPage=200", tok)
    names = {c["name"] for c in cols.get("items", [])}
    missing = [c for c in CONTENT_COLLECTIONS if c not in names]
    ok &= check("9 个内容集合全部存在", not missing, "缺失=%s" % missing)

    print("== 2. 注册两人并配对（第三人未配对，用于越权校验）==")
    a = create_user(ua, "Alice")
    b = create_user(ub, "Bob")
    c = create_user(uc, "Carol")
    if not a or not b or not c:
        sys.exit(1)
    ta, _ = login(ua)
    tb, _ = login(ub)
    tc, _ = login(uc)
    ok &= check("三人登录成功", bool(ta) and bool(tb) and bool(tc))
    st, resp = api("POST", "/api/zhijian/pair", token=ta, body={"code": b["invite_code"]})
    ok &= check("Alice 与 Bob 配对成功", st == 200, json.dumps(resp, ensure_ascii=False)[:120])

    print("== 3. 菜谱 + 做菜记录（钩子重算统计）==")
    st, recipe = api("POST", "/api/collections/recipes/records", token=ta, body={
        "title": "番茄牛腩", "creator": a["id"], "ingredients": "牛腩 500g\n番茄 3 个",
    })
    ok &= check("创建菜谱", st == 200, json.dumps(recipe, ensure_ascii=False)[:200])
    if st != 200:
        cleanup()
        sys.exit(1)

    st, resp = api("POST", "/api/collections/cook_history/records", token=tb, body={
        "recipe": recipe["id"], "user": b["id"], "rating": 5,
    })
    ok &= check("Bob 记录做菜（5 分）", st == 200, json.dumps(resp, ensure_ascii=False)[:200])
    st, r1 = api("GET", "/api/collections/recipes/records/" + recipe["id"], token=ta)
    ok &= check("钩子重算 cook_count=1", r1.get("cook_count") == 1, str(r1.get("cook_count")))
    ok &= check("avg_rating=5", r1.get("avg_rating") == 5, str(r1.get("avg_rating")))
    ok &= check("last_cooked_at 已写入", bool(r1.get("last_cooked_at")), str(r1.get("last_cooked_at")))

    st, resp = api("POST", "/api/collections/cook_history/records", token=ta, body={
        "recipe": recipe["id"], "user": a["id"], "rating": 3,
    })
    st, r2 = api("GET", "/api/collections/recipes/records/" + recipe["id"], token=ta)
    ok &= check("第二次记录后 cook_count=2", r2.get("cook_count") == 2, str(r2.get("cook_count")))
    ok &= check("avg_rating 更新为 4", r2.get("avg_rating") == 4, str(r2.get("avg_rating")))
    ok &= check("partner 可见该菜谱（情侣对共享）", len(lst(tb, "recipes")) == 1,
                str(len(lst(tb, "recipes"))))
    ok &= check("未配对的 Carol 看不到菜谱", len(lst(tc, "recipes")) == 0,
                str(len(lst(tc, "recipes"))))

    print("== 4. 纪念日（含农历标记）==")
    st, anniv = api("POST", "/api/collections/anniversaries/records", token=ta, body={
        "user": a["id"], "name": "奶奶生日", "date": "1955-05-05",
        "is_lunar": True, "is_together": False, "note": "农历五月初五",
    })
    ok &= check("创建农历纪念日", st == 200, json.dumps(anniv, ensure_ascii=False)[:200])
    ok &= check("is_lunar 落库为 true", anniv.get("is_lunar") is True, str(anniv.get("is_lunar")))
    ok &= check("Bob 可见纪念日", len(lst(tb, "anniversaries")) == 1)

    print("== 5. 旅游：目的地 + 花费 ==")
    st, dest = api("POST", "/api/collections/destinations/records", token=ta, body={
        "creator": a["id"], "name": "京都", "city": "京都", "status": "visited",
        "tagline": "秋天去看枫叶", "budget_estimate": 8000, "visited_at": "2026-11-20",
    })
    ok &= check("创建目的地", st == 200, json.dumps(dest, ensure_ascii=False)[:200])
    st, exp1 = api("POST", "/api/collections/expenses/records", token=ta, body={
        "destination": dest["id"], "category": "transport", "amount": 3000, "payer": "me",
    })
    ok &= check("记录花费（我付 3000）", st == 200, json.dumps(exp1, ensure_ascii=False)[:200])
    st, exp2 = api("POST", "/api/collections/expenses/records", token=tb, body={
        "destination": dest["id"], "category": "dining", "amount": 1000, "payer": "partner",
    })
    ok &= check("Bob 也能记花费（Ta 付 1000）", st == 200, json.dumps(exp2, ensure_ascii=False)[:200])
    exps = lst(ta, "expenses")
    ok &= check("双方共 2 笔花费可见", len(exps) == 2, str(len(exps)))
    ok &= check("未配对的 Carol 看不到花费", len(lst(tc, "expenses")) == 0)

    print("== 6. 漫游 / 聚餐 ==")
    st, wander = api("POST", "/api/collections/wanders/records", token=ta, body={
        "creator": a["id"], "location": "五道营胡同", "date": "2026-10-01", "mood": "风很舒服",
    })
    ok &= check("创建漫游", st == 200, json.dumps(wander, ensure_ascii=False)[:160])
    st, dine = api("POST", "/api/collections/dines/records", token=tb, body={
        "creator": b["id"], "restaurant": "巷子口小馆", "date": "2026-10-02",
        "people": "我、Ta", "people_count": 2, "cost": 168, "rating": 4, "comment": "好吃",
    })
    ok &= check("Bob 创建聚餐（含评分/花费）", st == 200, json.dumps(dine, ensure_ascii=False)[:160])
    ok &= check("Alice 可见 Bob 的聚餐", len(lst(ta, "dines")) == 1)

    print("== 7. 物品（日均成本）==")
    st, item = api("POST", "/api/collections/items/records", token=ta, body={
        "creator": a["id"], "name": "空气炸锅", "date": "2026-01-01",
        "price": 599, "category": "家居", "status": "active",
    })
    ok &= check("创建物品", st == 200, json.dumps(item, ensure_ascii=False)[:160])
    ok &= check("category 枚举生效", item.get("category") == "家居", str(item.get("category")))
    st, bad = api("POST", "/api/collections/items/records", token=ta, body={
        "creator": a["id"], "name": "无效分类", "date": "2026-01-01",
        "price": 1, "category": "不存在的分类", "status": "active",
    })
    ok &= check("非法分类 -> 400", st == 400, str(st))

    print("== 8. 待办：together 共享 / personal 隔离 ==")
    st, tg = api("POST", "/api/collections/todos/records", token=ta, body={
        "content": "一起买菜", "area": "together", "user": a["id"], "sort_order": 0,
    })
    ok &= check("创建 together 待办", st == 200, json.dumps(tg, ensure_ascii=False)[:160])
    st, ps = api("POST", "/api/collections/todos/records", token=ta, body={
        "content": "我的私事", "area": "personal", "user": a["id"], "sort_order": 0,
    })
    ok &= check("创建 personal 待办", st == 200, json.dumps(ps, ensure_ascii=False)[:160])
    bob_together = lst(tb, "todos", 'area = "together"')
    bob_personal = lst(tb, "todos", 'area = "personal"')
    ok &= check("Bob 能看到 together 待办", any(t["id"] == tg["id"] for t in bob_together))
    ok &= check("Bob 看不到 Alice 的 personal 待办", all(t["id"] != ps["id"] for t in bob_personal),
                str([t["content"] for t in bob_personal]))

    print("== 9. 越权：非本人/非伴侣不能改 ==")
    st, resp = api("PATCH", "/api/collections/recipes/records/" + recipe["id"], token=tc,
                   body={"title": "篡改"})
    ok &= check("Carol 改 Alice 的菜谱 -> 403/404", st in (403, 404), str(st))
    st, resp = api("PATCH", "/api/collections/recipes/records/" + recipe["id"], token=tb,
                   body={"title": "番茄牛腩（改）"})
    ok &= check("Bob（伴侣）可改菜谱 -> 200", st == 200, str(st))

    print("== 清理测试数据 ==")
    cleanup()

    print("\n== 结果：%s ==" % ("全部通过" if ok else "存在失败项"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
