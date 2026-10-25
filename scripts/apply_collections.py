#!/usr/bin/env python3
"""
Phase 1: 将 src/modules/*/migrations/*.json 中 id 以 "zj_" 开头的集合创建/同步到 PocketBase，
并扩展内置 users(auth) 集合：新增 username / invite_code / paired_user / is_admin 字段 + 唯一索引。
用法: python scripts/apply_collections.py [base_url]
"""
import json
import os
import sys
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8096"
ADMIN_EMAIL = "admin@zhijian.app"
ADMIN_PASSWORD = "Zhijian#2026!"

USERS_ID = "_pb_users_auth_"

USERS_NEW_FIELDS = [
    {
        # 用户名允许中文昵称（V1 的用户名就是中文，如「怦怦」），因此放宽：
        #   min 3 -> 1（两个汉字也合法）、去掉仅 ASCII 的 pattern
        "hidden": False, "id": "text_username", "autogeneratePattern": "",
        "max": 50, "min": 1, "name": "username", "pattern": "",
        "presentable": False, "primaryKey": False, "required": True, "system": False, "type": "text",
    },
    {
        "hidden": False, "id": "text_invite_code", "autogeneratePattern": "",
        "max": 20, "min": 0, "name": "invite_code", "pattern": "",
        "presentable": False, "primaryKey": False, "required": False, "system": False, "type": "text",
    },
    {
        "cascadeDelete": False, "collectionId": USERS_ID, "hidden": False, "id": "rel_paired_user",
        "maxSelect": 1, "minSelect": 0, "name": "paired_user", "presentable": False,
        "required": False, "system": False, "type": "relation",
    },
    {
        "hidden": False, "id": "bool_is_admin", "name": "is_admin", "presentable": False,
        "required": False, "system": False, "type": "bool",
    },
]
USERS_NEW_INDEXES = [
    "CREATE UNIQUE INDEX `idx_zj_users_username` ON `users` (`username`)",
    "CREATE UNIQUE INDEX `idx_zj_users_invite_code` ON `users` (`invite_code`)",
]

# 数据隔离：情侣对严格共享
#   - 可见：自己 + 伴侣（用于首页展示双方头像/昵称）
#   - 可改：仅自己（配对走 pb_hooks 的 /api/zhijian/pair，以服务端权限双向写）
#   - 注册：开放（createRule 为空）
# 认证选项：启用「用户名 + 密码」登录（V1 的登录方式），保留邮箱认证
USERS_OPTIONS_PATCH = {
    "allowUsernameAuth": True,
    "allowEmailAuth": True,
    "minPasswordLength": 8,
}

USERS_RULES = {
    "createRule": "",
    "listRule": "id = @request.auth.id || id = @request.auth.paired_user",
    "viewRule": "id = @request.auth.id || id = @request.auth.paired_user",
    "updateRule": "id = @request.auth.id",
    "deleteRule": "id = @request.auth.id",
}


def api(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode())
        except Exception:
            err = {"message": e.reason}
        return e.code, err


def login():
    st, resp = api("POST", "/api/collections/_superusers/auth-with-password", body={
        "identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    })
    if st != 200:
        raise SystemExit("登录失败: " + json.dumps(resp))
    return resp["token"]


def patch_users(token):
    st, users = api("GET", "/api/collections/" + USERS_ID, token)
    if st != 200:
        raise SystemExit("获取 users 失败: " + json.dumps(users))
    fields = list(users["fields"])
    for f in USERS_NEW_FIELDS:
        # 已存在则用脚本定义覆盖（幂等同步约束，例如把 username 的 min/pattern 放宽）
        idx = next((i for i, x in enumerate(fields) if x.get("name") == f["name"]), None)
        if idx is None:
            fields.append(f)
        else:
            fields[idx] = f
    indexes = list(users.get("indexes") or [])
    for idx in USERS_NEW_INDEXES:
        if idx not in indexes:
            indexes.append(idx)
    options = dict(users.get("options") or {})
    options.update(USERS_OPTIONS_PATCH)
    payload = {"fields": fields, "indexes": indexes, "options": options}
    payload.update(USERS_RULES)
    st, resp = api("PATCH", "/api/collections/" + USERS_ID, token, payload)
    if st != 200:
        print("  [WARN] users PATCH 返回", st, json.dumps(resp))
        return False
    print("  [OK] users 已扩展字段 + 唯一索引")
    return True


def apply_collection(token, coll):
    cid = coll["id"]
    st, existing = api("GET", "/api/collections/" + cid, token)
    if st == 200:
        st, resp = api("PATCH", "/api/collections/" + cid, token, coll)
        verb = "PATCH(同步)"
    else:
        st, resp = api("POST", "/api/collections", token, coll)
        verb = "POST(创建)"
    if st not in (200, 204):
        print("  [FAIL] %s %s -> %s %s" % (verb, cid, st, json.dumps(resp)))
        return False
    print("  [OK] %s %s" % (verb, cid))
    return True


def main():
    token = login()
    print("== 扩展 users ==")
    patch_users(token)
    print("== 应用 zj_ 集合 ==")
    ok = 0
    failed = 0
    # 依赖顺序：先建被引用的（recipes/destinations），其余随意
    order_hint = ["zj_recipes", "zj_destinations", "zj_cook_history", "zj_expenses"]
    collected = []
    for dirpath, _, files in os.walk(os.path.join(ROOT, "src", "modules")):
        for fn in files:
            if fn.endswith(".json"):
                p = os.path.join(dirpath, fn)
                try:
                    data = json.load(open(p, encoding="utf-8"))
                except Exception:
                    continue
                if isinstance(data, list):
                    for c in data:
                        if isinstance(c, dict) and c.get("id", "").startswith("zj_"):
                            collected.append(c)
    collected.sort(key=lambda c: (order_hint.index(c["id"]) if c["id"] in order_hint else 99, c["id"]))
    for c in collected:
        if apply_collection(token, c):
            ok += 1
        else:
            failed += 1
    print("== 完成：成功 %d, 失败 %d ==" % (ok, failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
