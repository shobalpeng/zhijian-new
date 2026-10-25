#!/usr/bin/env python3
"""
给所有 file 字段开启 PocketBase 原生缩略图（thumbs）。

不依赖 src/modules/*/migrations/*.json，直接读数据库里现有的集合定义，
在 file 字段上补上 thumbs 后原样 PATCH 回去（其余字段一律不动）。

用法（在能访问 PocketBase 的机器上跑）：
    python3 scripts/enable_thumbs.py http://127.0.0.1:8090

账号密码：默认 admin@zhijian.app / Zhijian#2026!
可用环境变量覆盖：ZJ_ADMIN_EMAIL / ZJ_ADMIN_PASSWORD

在 NAS 容器里跑（镜像里已带 scripts/）：
    docker compose exec zhijian python3 /app/scripts/enable_thumbs.py http://127.0.0.1:8090
"""
import json
import os
import sys
import urllib.request
import urllib.error

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090").rstrip("/")
ADMIN_EMAIL = os.environ.get("ZJ_ADMIN_EMAIL", "admin@zhijian.app")
ADMIN_PASSWORD = os.environ.get("ZJ_ADMIN_PASSWORD", "Zhijian#2026!")
THUMBS = ["300x0", "600x0"]

# 集合名 → 其中的 file 字段名
FILE_FIELDS = {
    "dines": ["images"],
    "wanders": ["images"],
    "items": ["image"],
    "recipes": ["cover_image"],
    "tasks": ["image"],
    "wishes": ["image"],
    "destinations": ["cover_image"],
}


def api(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        return e.code, {}


def main():
    print(f"== 目标 {BASE}")
    st, resp = api("POST", "/api/collections/_superusers/auth-with-password",
                   body={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if st != 200:
        print(f"  [FAIL] 登录失败 ({st})：{json.dumps(resp, ensure_ascii=False)[:200]}")
        print("        如果改过超级管理员密码，用环境变量指定：")
        print("        ZJ_ADMIN_EMAIL=... ZJ_ADMIN_PASSWORD=... python3 enable_thumbs.py " + BASE)
        return 1
    token = resp["token"]
    print("== 登录成功 ==")

    ok = failed = 0
    for collection, field_names in FILE_FIELDS.items():
        st, coll = api("GET", f"/api/collections/{collection}", token)
        if st != 200:
            print(f"  [FAIL] 读取集合 {collection} 失败 ({st})")
            failed += 1
            continue

        fields = coll.get("fields") or []
        changed = False
        for fl in fields:
            if fl.get("type") == "file" and fl.get("name") in field_names:
                if fl.get("thumbs") == THUMBS:
                    print(f"  [SKIP] {collection}.{fl['name']} 已是 {THUMBS}")
                else:
                    fl["thumbs"] = list(THUMBS)
                    changed = True
                    print(f"  [设置] {collection}.{fl['name']} → thumbs={THUMBS}")
        if not changed:
            ok += 1
            continue

        st, resp = api("PATCH", f"/api/collections/{collection}", token, coll)
        if st in (200, 204):
            print(f"  [OK] {collection} 已保存")
            ok += 1
        else:
            print(f"  [FAIL] {collection} 保存失败 ({st})：{json.dumps(resp, ensure_ascii=False)[:200]}")
            failed += 1

    print(f"\n== 完成：成功 {ok}, 失败 {failed} ==")
    print("提示：缩略图是「首次访问才生成」，想避免第一次打开列表页卡顿，")
    print("      再跑一次 python3 scripts/warm_thumbs.py " + BASE)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
