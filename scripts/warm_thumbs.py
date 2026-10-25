#!/usr/bin/env python3
"""
预热缩略图：PocketBase 的 ?thumb= 缩略图是「首次访问才生成」，
不预热的话，第一次打开列表页会现场给所有图片生成小图，服务端会卡一下。

用法:
    python scripts/warm_thumbs.py [base_url]

会遍历所有带 file 字段的集合，把每个文件的 300x0 / 600x0 两档缩略图都请求一遍，
生成后 PocketBase 会缓存到 storage 的 thumbs_* 目录，之后就是秒开。
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
ADMIN_EMAIL = "admin@zhijian.app"
ADMIN_PASSWORD = "Zhijian#2026!"
THUMBS = ["300x0", "600x0", "900x0"]

# 集合 id → file 字段名
FILE_FIELDS = {
    "zj_dines": ["images"],
    "zj_wanders": ["images"],
    "zj_items": ["image"],
    "zj_recipes": ["cover_image"],
    "zj_tasks": ["image"],
    "zj_wishes": ["image"],
    "zj_destinations": ["cover_image"],
}


def api(path, tok=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method="POST" if body is not None else "GET")
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def main():
    tok = api("/api/collections/_superusers/auth-with-password",
              body={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD})["token"]
    print(f"已连接 {BASE}")

    total_files = 0
    total_bytes = 0
    t0 = time.time()

    for collection, fields in FILE_FIELDS.items():
        try:
            page = api(f"/api/collections/{collection}/records?perPage=500", tok)
        except urllib.error.HTTPError as e:
            print(f"  ! {collection} 读取失败: {e.code}")
            continue

        for rec in page.get("items", []):
            for field in fields:
                value = rec.get(field)
                if not value:
                    continue
                names = value if isinstance(value, list) else [value]
                for name in names:
                    url = f"{BASE}/api/files/{collection}/{rec['id']}/{name}"
                    for size in THUMBS:
                        try:
                            with urllib.request.urlopen(f"{url}?thumb={size}", timeout=120) as resp:
                                total_bytes += len(resp.read())
                        except urllib.error.HTTPError as e:
                            print(f"  ! {collection}/{name} {size}: HTTP {e.code}")
                            continue
                    total_files += 1

    print(f"\n完成：{total_files} 张图片 × {len(THUMBS)} 档，"
          f"生成 {total_bytes / 1048576:.1f} MB 缩略图，耗时 {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
