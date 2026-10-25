"""修复 relation 字段的 cascadeDelete：让「被引用的记录」也能被删除。

背景：PocketBase 的 relation 字段若 cascadeDelete=false 且 required=true，
被它引用的记录就无法删除（API 返 400 "required relation reference"）。
迁移到 PocketBase 时漏配了这两个，导致：
  - 旅游：删不掉有花费记录的目的地
  - 菜谱：删不掉有烹饪记录的菜谱

本脚本只精准修改这两个字段的 cascadeDelete（幂等，可重复运行），
不触碰其它字段和规则。

用法: python scripts/fix_cascade_delete.py [base_url]
      默认 http://127.0.0.1:8090
      容器内: python3 /app/scripts/fix_cascade_delete.py http://127.0.0.1:8090

superuser 密码可用环境变量传入（推荐，避免把密码写死在代码里）：
      ZJ_ADMIN_PASSWORD='你的密码' python3 /app/scripts/fix_cascade_delete.py
      或 docker exec -e ZJ_ADMIN_PASSWORD='你的密码' <容器> python3 /app/scripts/fix_cascade_delete.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
ADMIN_IDENTITY = os.environ.get("ZJ_ADMIN_IDENTITY", "admin@zhijian.app")
ADMIN_PASSWORD = os.environ.get("ZJ_ADMIN_PASSWORD", "Zhijian#2026!")
SU = {"identity": ADMIN_IDENTITY, "password": ADMIN_PASSWORD}

# (集合 id, 集合名, 字段名) —— 需改成 cascadeDelete=true
TARGETS = [
    ("zj_expenses", "expenses", "destination"),
    ("zj_cook_history", "cook_history", "recipe"),
]


def api(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 method=method)
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


def main():
    st, resp = api("POST", "/api/collections/_superusers/auth-with-password", body=SU)
    if st != 200:
        print("超级管理员登录失败:", st, json.dumps(resp, ensure_ascii=False))
        return 1
    token = resp["token"]
    print("已连接 %s" % BASE)

    ok = True
    for cid, cname, fname in TARGETS:
        st, coll = api("GET", "/api/collections/" + cid, token)
        if st != 200:
            print("  [FAIL] 读取集合 %s -> %s" % (cname, st))
            ok = False
            continue

        fields = list(coll.get("fields") or [])
        idx = next((i for i, f in enumerate(fields) if f.get("name") == fname), None)
        if idx is None:
            print("  [FAIL] %s 里找不到字段 %s" % (cname, fname))
            ok = False
            continue

        if fields[idx].get("cascadeDelete") is True:
            print("  [OK] %s.%s 已是 cascadeDelete=true，无需修改" % (cname, fname))
            continue

        fields[idx] = dict(fields[idx], cascadeDelete=True)
        payload = {
            "fields": fields,
            "indexes": list(coll.get("indexes") or []),
            "options": dict(coll.get("options") or {}),
        }
        for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule"):
            payload[k] = coll.get(k)

        st, resp = api("PATCH", "/api/collections/" + cid, token, payload)
        if st != 200:
            print("  [FAIL] PATCH %s -> %s %s" % (cname, st, json.dumps(resp, ensure_ascii=False)[:200]))
            ok = False
            continue
        print("  [OK] %s.%s 已改为 cascadeDelete=true" % (cname, fname))

    # 复核
    print("复核:")
    for cid, cname, fname in TARGETS:
        st, coll = api("GET", "/api/collections/" + cid, token)
        if st != 200:
            print("  %s.%s -> 读取失败" % (cname, fname))
            ok = False
            continue
        f = next((x for x in coll.get("fields", []) if x.get("name") == fname), {})
        v = f.get("cascadeDelete")
        print("  %s.%s cascadeDelete=%s" % (cname, fname, v))
        if v is not True:
            ok = False

    print()
    print("结果: %s" % ("全部成功 ✅" if ok else "存在失败 ❌"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
