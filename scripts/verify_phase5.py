"""Phase 5 验证：迁移后的数据在 PocketBase 中可用（登录 / 配对 / 内容 / 图片）。

用法: python scripts/verify_phase5.py http://127.0.0.1:8124
依赖 scripts/migration_report.json（迁移生成的临时密码）。
"""
import json
import sys
import urllib.parse
import urllib.request
import urllib.error
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
REPORT = Path(__file__).resolve().parent / "migration_report.json"


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
            return e.code, {"raw": raw[:200]}


def check(label, cond, extra=""):
    print("  [%s] %s %s" % ("OK" if cond else "FAIL", label, extra))
    return cond


def to_identity(username):
    return username if "@" in username else username + "@zhijian.local"


def main():
    ok = True

    if not REPORT.is_file():
        print("找不到 %s，请先执行迁移" % REPORT)
        sys.exit(1)
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    creds = report.get("credentials", [])
    print("== 0. 读取迁移报告 ==")
    ok &= check("报告含用户凭据", len(creds) >= 2, str(len(creds)))
    if len(creds) < 2:
        sys.exit(1)

    print("== 1. 用迁移后的账号登录（临时密码）==")
    tokens = []
    records = []
    for c in creds:
        st, resp = api("POST", "/api/collections/users/auth-with-password", body={
            "identity": to_identity(c["username"]),
            "password": c["temp_password"],
        })
        ok &= check("%s 登录成功" % c["username"], st == 200,
                    json.dumps(resp, ensure_ascii=False)[:150])
        if st == 200:
            tokens.append(resp["token"])
            records.append(resp["record"])

    print("== 2. 配对关系已重建 ==")
    if len(records) == 2:
        a, b = records[0], records[1]
        ok &= check("A 的伴侣是 B", a.get("paired_user") == b.get("id"),
                    "%s / %s" % (a.get("paired_user"), b.get("id")))
        ok &= check("B 的伴侣是 A", b.get("paired_user") == a.get("id"))
        ok &= check("邀请码沿用 V1", bool(a.get("invite_code")) and bool(b.get("invite_code")),
                    "%s / %s" % (a.get("invite_code"), b.get("invite_code")))

    if len(tokens) < 2:
        print("\n== 结果：存在失败项 ==")
        sys.exit(1)
    ta, tb = tokens[0], tokens[1]

    print("== 3. 内容数据可见（情侣对共享）==")
    def count(token, collection, filt=None):
        q = "/api/collections/%s/records?perPage=1" % collection
        if filt:
            q += "&filter=" + urllib.parse.quote(filt)
        st, resp = api("GET", q, token=token)
        return resp.get("totalItems", 0) if st == 200 else -1

    ok &= check("聚餐 23 条可见（A）", count(ta, "dines") == 23, str(count(ta, "dines")))
    ok &= check("聚餐 23 条可见（B）", count(tb, "dines") == 23, str(count(tb, "dines")))
    ok &= check("物品 2 条", count(ta, "items") == 2, str(count(ta, "items")))
    ok &= check("纪念日 1 条", count(ta, "anniversaries") == 1, str(count(ta, "anniversaries")))

    print("== 4. 图片已上传（文件字段非空）==")
    st, resp = api("GET", "/api/collections/dines/records?perPage=5&sort=-date", token=ta)
    items = resp.get("items", [])
    with_img = [d for d in items if d.get("images")]
    ok &= check("聚餐照片字段非空", bool(items) and len(with_img) == len(items),
                "%d/%d" % (len(with_img), len(items)))
    if with_img:
        first = with_img[0]
        url = "%s/api/files/dines/%s/%s" % (BASE, first["id"], first["images"][0])
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("Authorization", "Bearer " + ta)
            with urllib.request.urlopen(req) as r:
                ok &= check("图片可访问 (%s)" % first["restaurant"][:12], r.status == 200, str(r.status))
        except urllib.error.HTTPError as e:
            ok &= check("图片可访问", False, str(e.code))

    print("== 5. 已移除模块确认不存在数据 ==")
    st, _ = api("GET", "/api/collections/notifications/records?perPage=1", token=ta)
    ok &= check("notifications 集合不存在（已移除）", st == 404, str(st))
    st, _ = api("GET", "/api/collections/wish_negotiations/records?perPage=1", token=ta)
    ok &= check("wish_negotiations 集合不存在（已移除）", st == 404, str(st))

    print("== 6. 用户设置沿用 ==")
    st, resp = api("GET", "/api/collections/user_settings/records?perPage=5", token=ta)
    settings = resp.get("items", [])
    ok &= check("每人一条 user_settings", len(settings) >= 2, str(len(settings)))
    ok &= check("theme 沿用 warm", all(s.get("theme") == "warm" for s in settings),
                str([s.get("theme") for s in settings]))

    print("== 7. 积分流水 ==")
    st, resp = api("GET", "/api/collections/point_transactions/records?perPage=1", token=ta)
    total = resp.get("totalItems", -1) if st == 200 else -1
    ok &= check("积分流水条数与源库一致（0）", total == 0, str(total))
    st, bal = api("GET", "/api/zhijian/balance", token=ta)
    ok &= check("余额接口可用", st == 200 and bal.get("me") == 0, json.dumps(bal, ensure_ascii=False)[:120])

    print("\n== 结果：%s ==" % ("全部通过" if ok else "存在失败项"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
