"""Phase 5：把 zhijianV1 的 SQLite 数据迁移到 zhijianV1.1 的 PocketBase。

用法:
    python scripts/migrate_v1.py <pb_url> [--apply] [--db 路径] [--uploads 路径]

默认 **dry-run**（只统计与告警，不写库）；加 --apply 才真正写入。

关键决策
1. **密码不迁移**（bcrypt 不可直迁）：为每个用户生成随机临时密码，写入
   `scripts/migration_report.json`，首次登录后请立即改密。
2. **通知 / 心愿议价不迁移**：按重构决策，这两块在新版中已移除。
3. **积分不重复发放**：point_transactions 先落库（admin 写），随后把 tasks/wishes
   补到原状态时触发的发分钩子会因 `source_id` 幂等而跳过。
4. **图片**：V1 的 `/api/uploads/...` 路径映射到 `data/uploads/` 磁盘文件，
   以 multipart 上传到 PocketBase 的文件字段。
"""
import argparse
import json
import os
import re
import secrets
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT.parent / "zhijianV1" / "data" / "zhijian.db"
DEFAULT_UPLOADS = ROOT.parent / "zhijianV1" / "data" / "uploads"

ADMIN_MAIL = "admin@zhijian.app"
ADMIN_PWD = "Zhijian#2026!"

# 不迁移的表（重构已移除 / 由钩子重新计算）
SKIP_TABLES = {"notifications", "wish_negotiations", "sqlite_sequence"}

ITEM_CATEGORIES = {"电子", "家居", "户外", "服饰", "其他"}

# V1 的 warm/minimal 是「配色风格」，新版统一为明暗主题 light/dark
THEME_MAP = {"warm": "light", "minimal": "light", "light": "light", "dark": "dark"}


def log(msg=""):
    print(msg, flush=True)


def warn(msg):
    print("  [warn] " + msg, flush=True)


class PB:
    """极简 PocketBase Admin API 客户端（仅 stdlib）"""

    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.token = None
        self.stats = {}
        self.warnings = []

    # ---------- 基础请求 ----------
    def _req(self, method, path, body=None, raw_body=None, content_type=None):
        url = self.base + path
        data = raw_body
        if data is None and body is not None:
            data = json.dumps(body).encode()
            content_type = "application/json"
        req = urllib.request.Request(url, data=data, method=method)
        if content_type:
            req.add_header("Content-Type", content_type)
        if self.token:
            req.add_header("Authorization", "Bearer " + self.token)
        try:
            with urllib.request.urlopen(req) as r:
                raw = r.read().decode()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read().decode()
            try:
                return e.code, json.loads(raw)
            except Exception:
                return e.code, {"raw": raw[:300]}

    def login(self):
        st, resp = self._req("POST", "/api/collections/_superusers/auth-with-password",
                             body={"identity": ADMIN_MAIL, "password": ADMIN_PWD})
        if st != 200:
            raise SystemExit("superuser 登录失败: %s %s" % (st, json.dumps(resp, ensure_ascii=False)[:200]))
        self.token = resp["token"]

    def create(self, collection, data, files=None):
        if not files:
            st, resp = self._req("POST", "/api/collections/%s/records" % collection, body=data)
        else:
            body, ctype = multipart(data, files)
            st, resp = self._req("POST", "/api/collections/%s/records" % collection,
                                 raw_body=body, content_type=ctype)
        self._count(collection, st)
        if st not in (200, 201):
            self.warnings.append("%s 创建失败(%s): %s" % (collection, st, json.dumps(resp, ensure_ascii=False)[:200]))
            return None
        return resp

    def patch(self, collection, record_id, data):
        st, resp = self._req("PATCH", "/api/collections/%s/records/%s" % (collection, record_id), body=data)
        if st != 200:
            self.warnings.append("%s 更新失败(%s): %s" % (collection, st, json.dumps(resp, ensure_ascii=False)[:200]))
            return None
        return resp

    def list_all(self, collection, filt=None):
        out = []
        page = 1
        while True:
            q = "/api/collections/%s/records?page=%d&perPage=200" % (collection, page)
            if filt:
                q += "&filter=" + urllib.parse.quote(filt)
            st, resp = self._req("GET", q)
            if st != 200:
                break
            items = resp.get("items", [])
            out.extend(items)
            if len(items) < resp.get("perPage", 0) or page >= resp.get("totalPages", 1):
                break
            page += 1
        return out

    def _count(self, collection, st):
        s = self.stats.setdefault(collection, {"ok": 0, "fail": 0})
        if st in (200, 201):
            s["ok"] += 1
        else:
            s["fail"] += 1


def multipart(fields, files):
    """fields: dict(值会被 str 化，None 跳过)；files: [(字段名, 文件名, bytes)]"""
    boundary = "----zjmigrate" + secrets.token_hex(12)
    body = b""
    for k, v in fields.items():
        if v is None:
            continue
        if isinstance(v, bool):
            v = "true" if v else "false"
        body += (
            '--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (boundary, k, v)
        ).encode()
    for field, filename, content in files:
        body += (
            '--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n' % (boundary, field, filename)
        ).encode()
        body += content + b"\r\n"
    body += ("--%s--\r\n" % boundary).encode()
    return body, "multipart/form-data; boundary=%s" % boundary


# ---------- 值转换 ----------
def to_identity(username: str) -> str:
    """用户名 → 占位邮箱（与前端 auth-provider 的 toIdentity 保持一致）"""
    value = (username or "").strip()
    if not value:
        value = "user"
    return value if "@" in value else value + "@zhijian.local"


def norm_dt(value):
    """ISO 时间戳 → PocketBase 存储格式 'YYYY-MM-DD HH:MM:SS.sssZ'"""
    if not value:
        return None
    v = str(value).replace("T", " ")
    if len(v) == 10:  # 纯日期
        return v
    return v


def b(v):
    return bool(v) if v is not None else False


def parse_images(raw, uploads: Path):
    """V1 的 image_url 可能是 JSON 数组字符串，也可能是单个路径"""
    if not raw:
        return []
    items = None
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            items = [str(x) for x in parsed if x]
        elif isinstance(parsed, str):
            items = [parsed]
    except Exception:
        items = [x for x in str(raw).split(",") if x.strip()]
    return [normalize_upload_path(x, uploads) for x in (items or [])]


def normalize_upload_path(path_str, uploads: Path):
    """'/api/uploads/dine/xx.jpg' -> 磁盘文件（不存在返回 None）"""
    if not path_str:
        return None
    p = str(path_str).strip()
    prefix = "/api/uploads/"
    if p.startswith(prefix):
        rel = p[len(prefix):]
    elif p.startswith("uploads/"):
        rel = p[len("uploads/"):]
    else:
        rel = p.lstrip("/")
    f = uploads / rel
    return f if f.is_file() else None


def read_file(path: Path):
    try:
        return path.read_bytes()
    except Exception:
        return None


# ---------- 迁移主体 ----------
class Migrator:
    def __init__(self, pb: PB, con: sqlite3.Connection, uploads: Path, apply: bool):
        self.pb = pb
        self.con = con
        self.uploads = uploads
        self.apply = apply
        self.user_map = {}      # V1 user id -> PB id
        self.recipe_map = {}
        self.dest_map = {}
        self.task_map = {}
        self.wish_map = {}
        self.credentials = []
        self.missing_files = []

    def rows(self, table):
        self.con.row_factory = sqlite3.Row
        return [dict(r) for r in self.con.execute('select * from "%s"' % table).fetchall()]

    def count(self, table):
        return self.con.execute('select count(*) from "%s"' % table).fetchone()[0]

    # ---- 各表 ----
    def migrate_users(self):
        for r in self.rows("users"):
            username = (r["username"] or "").strip() or ("user%d" % r["id"])
            temp_pwd = "Zhj#" + secrets.token_urlsafe(6)
            data = {
                "username": username,
                "email": to_identity(username),
                "emailVisibility": False,
                "password": temp_pwd,
                "passwordConfirm": temp_pwd,
                "name": username,
                "invite_code": r["invite_code"] or None,
                "is_admin": bool(r["is_admin"]),
            }
            rec = self.pb.create("users", data) if self.apply else {"id": "dryrun"}
            if rec:
                self.user_map[r["id"]] = rec["id"]
                self.credentials.append({
                    "old_id": r["id"], "username": username,
                    "temp_password": temp_pwd, "pb_id": rec["id"],
                })
            else:
                warn("用户 %s 创建失败，其名下数据将跳过" % username)

    def migrate_pairing(self):
        for r in self.rows("users"):
            old_paired = r["paired_user_id"]
            if not old_paired:
                continue
            me = self.user_map.get(r["id"])
            partner = self.user_map.get(old_paired)
            if not me or not partner:
                continue
            if self.apply:
                self.pb.patch("users", me, {"paired_user": partner})

    def migrate_user_settings(self):
        for r in self.rows("user_settings"):
            uid = self.user_map.get(r["user_id"])
            if not uid:
                continue
            existing = self.pb.list_all("user_settings", 'user = "%s"' % uid) if self.apply else []
            data = {"theme": THEME_MAP.get((r["theme"] or "warm").lower(), "light")}
            if r["monthly_point_cap"] is not None:
                data["monthly_point_cap"] = r["monthly_point_cap"]
            if self.apply:
                if existing:
                    self.pb.patch("user_settings", existing[0]["id"], data)
                else:
                    data["user"] = uid
                    self.pb.create("user_settings", data)

    def _interactive(self, table, collection, counterpart_field):
        """tasks / wishes：先建为 pending（钩子强制），后面再补状态"""
        rows = self.rows(table)
        for r in rows:
            files = []
            img = normalize_upload_path(r["image_url"], self.uploads)
            if img:
                content = read_file(img)
                if content:
                    files.append(("image", img.name, content))
                else:
                    self.missing_files.append(str(img))
            data = {
                "title": r["title"],
                "description": r["description"] or "",
                "points": int(r["points"] or 0),
                "creator": self.user_map.get(r["creator_id"]),
                counterpart_field: self.user_map.get(r["assignee_id"] if counterpart_field == "assignee" else r["fulfiller_id"]),
                "status": "pending",
            }
            if not data["creator"] or not data[counterpart_field]:
                warn("%s#%s 的创建者/对方缺失，跳过" % (table, r["id"]))
                continue
            rec = self.pb.create(collection, data, files) if self.apply else {"id": "dryrun"}
            if rec:
                (self.task_map if collection == "tasks" else self.wish_map)[r["id"]] = rec["id"]
                self.pending_status.append((collection, rec["id"], r))

    def migrate_interactive(self):
        """只创建（钩子强制 pending），状态在积分流水落库之后再补"""
        self.pending_status = []
        self._interactive("tasks", "tasks", "assignee")
        self._interactive("wishes", "wishes", "fulfiller")

    def apply_interactive_status(self):
        """补回原状态：superuser 更新放行；发分钩子因 source_id 已存在而幂等跳过"""
        for collection, new_id, r in getattr(self, "pending_status", []):
            if not self.apply or r["status"] == "pending":
                continue
            self.pb.patch(collection, new_id, {
                "status": r["status"],
                "submitted_at": norm_dt(r["submitted_at"]),
                "confirmed_at": norm_dt(r["confirmed_at"]),
            })

    def migrate_point_transactions(self):
        """必须在 tasks/wishes 之后、状态补回之前执行（见文件头决策 3）"""
        for r in self.rows("point_transactions"):
            source_type = r["source_type"]
            old_source = r["source_id"]
            new_source = None
            if source_type == "task":
                new_source = self.task_map.get(old_source)
            elif source_type == "wish":
                new_source = self.wish_map.get(old_source)
            if not new_source:
                warn("积分流水 %s 找不到对应的 %s#%s，跳过" % (r["id"], source_type, old_source))
                continue
            uid = self.user_map.get(r["user_id"])
            if not uid:
                continue
            data = {
                "user": uid,
                "amount": int(r["amount"]),
                "type": r["type"],
                "source_type": source_type,
                "source_id": new_source,
            }
            if self.apply:
                self.pb.create("point_transactions", data)

    def migrate_recipes(self):
        for r in self.rows("recipes"):
            files = []
            img = normalize_upload_path(r["image_url"], self.uploads)
            if img:
                content = read_file(img)
                if content:
                    files.append(("cover_image", img.name, content))
                else:
                    self.missing_files.append(str(img))
            data = {
                "title": r["title"],
                "ingredients": r["ingredients"] or "",
                "steps": r["steps"] or "",
                "creator": self.user_map.get(r["creator_id"]),
            }
            if not data["creator"]:
                continue
            rec = self.pb.create("recipes", data, files) if self.apply else {"id": "dryrun"}
            if rec:
                self.recipe_map[r["id"]] = rec["id"]

    def migrate_cook_history(self):
        """创建后由 pb_hooks/recipes.pb.js 重算 cook_count / avg_rating / last_cooked_at"""
        for r in self.rows("cook_history"):
            rid = self.recipe_map.get(r["recipe_id"])
            uid = self.user_map.get(r["user_id"])
            if not rid or not uid:
                continue
            data = {"recipe": rid, "user": uid}
            if r["rating"] is not None:
                data["rating"] = int(r["rating"])
            if self.apply:
                self.pb.create("cook_history", data)

    def migrate_anniversaries(self):
        for r in self.rows("anniversaries"):
            uid = self.user_map.get(r["user_id"])
            if not uid:
                continue
            data = {
                "user": uid,
                "name": r["name"],
                "date": norm_dt(r["date"]),
                "note": r["note"] or "",
                "is_lunar": b(r["is_lunar"]),
                "is_together": b(r["is_together"]),
            }
            if self.apply:
                self.pb.create("anniversaries", data)

    def migrate_destinations(self):
        for r in self.rows("destinations"):
            files = []
            img = normalize_upload_path(r["cover_image"], self.uploads)
            if img:
                content = read_file(img)
                if content:
                    files.append(("cover_image", img.name, content))
                else:
                    self.missing_files.append(str(img))
            data = {
                "name": r["name"],
                "tagline": r["tagline"] or "",
                "status": r["status"] or "wishlist",
                "city": r["city"] or "",
                "lat": r["lat"],
                "lng": r["lng"],
                "places_to_visit": r["places_to_visit"] or "",
                "itinerary_draft": r["itinerary_draft"] or "",
                "budget_estimate": r["budget_estimate"],
                "notes": r["notes"] or "",
                "visited_at": norm_dt(r["visited_at"]),
                "creator": self.user_map.get(r["creator_id"]),
            }
            if not data["creator"]:
                continue
            rec = self.pb.create("destinations", data, files) if self.apply else {"id": "dryrun"}
            if rec:
                self.dest_map[r["id"]] = rec["id"]

    def migrate_expenses(self):
        for r in self.rows("expenses"):
            did = self.dest_map.get(r["destination_id"])
            if not did:
                continue
            data = {
                "destination": did,
                "category": r["category"],
                "amount": int(r["amount"]),
                "payer": r["payer"],
                "note": r["note"] or "",
            }
            if self.apply:
                self.pb.create("expenses", data)

    def migrate_wanders(self):
        for r in self.rows("wanders"):
            files = []
            for p in parse_images(r["image_url"], self.uploads):
                content = read_file(p)
                if content:
                    files.append(("images", p.name, content))
                else:
                    self.missing_files.append(str(p))
            data = {
                "location": r["location"],
                "date": norm_dt(r["date"]),
                "mood": r["mood"] or "",
                "creator": self.user_map.get(r["creator_id"]),
            }
            if not data["creator"]:
                continue
            if self.apply:
                self.pb.create("wanders", data, files)

    def migrate_dines(self):
        for r in self.rows("dines"):
            files = []
            for p in parse_images(r["image_url"], self.uploads):
                content = read_file(p)
                if content:
                    files.append(("images", p.name, content))
                else:
                    self.missing_files.append(str(p))
            data = {
                "restaurant": r["restaurant"],
                "date": norm_dt(r["date"]),
                "people": r["people"] or "",
                "people_count": r["people_count"],
                "dishes": r["dishes"] or "",
                "cost": r["cost"],
                "rating": r["rating"],
                "comment": r["comment"] or "",
                "creator": self.user_map.get(r["creator_id"]),
            }
            if not data["creator"]:
                continue
            if self.apply:
                self.pb.create("dines", data, files)

    def migrate_items(self):
        for r in self.rows("items"):
            files = []
            img = normalize_upload_path(r["image_url"], self.uploads)
            if img:
                content = read_file(img)
                if content:
                    files.append(("image", img.name, content))
                else:
                    self.missing_files.append(str(img))
            category = r["category"] if r["category"] in ITEM_CATEGORIES else "其他"
            if r["category"] and r["category"] not in ITEM_CATEGORIES:
                warn("物品「%s」分类 %s 不在枚举内，归为其他" % (r["name"], r["category"]))
            data = {
                "name": r["name"],
                "date": norm_dt(r["date"]),
                "price": r["price"],
                "category": category,
                "status": r["status"] or "active",
                "retired_date": norm_dt(r["retired_date"]),
                "note": r["note"] or "",
                "creator": self.user_map.get(r["creator_id"]),
            }
            if not data["creator"]:
                continue
            if self.apply:
                self.pb.create("items", data, files)

    def migrate_todos(self):
        for r in self.rows("todos"):
            data = {
                "content": r["content"],
                "done": b(r["done"]),
                "archived": b(r["archived"]),
                "area": r["area"],
                "user": self.user_map.get(r["user_id"]) or None,
                "sort_order": r["sort_order"] or 0,
            }
            if self.apply:
                self.pb.create("todos", data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8090")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--uploads", default=str(DEFAULT_UPLOADS))
    ap.add_argument("--apply", action="store_true", help="真正写入（默认仅 dry-run）")
    args = ap.parse_args()

    db = Path(args.db)
    uploads = Path(args.uploads)
    if not db.is_file():
        raise SystemExit("找不到 SQLite: %s" % db)
    log("源库: %s" % db)
    log("图片: %s%s" % (uploads, "" if uploads.is_dir() else "（目录不存在）"))
    log("模式: %s\n" % ("写入(--apply)" if args.apply else "预演(dry-run)"))

    con = sqlite3.connect("file:%s?mode=ro" % db.as_posix(), uri=True)

    log("== 1. 源库统计 ==")
    tables = [r[0] for r in con.execute(
        "select name from sqlite_master where type='table' order by name").fetchall()]
    tables = [t for t in tables if t not in SKIP_TABLES and not t.startswith("sqlite")]
    total = 0
    for t in tables:
        n = con.execute('select count(*) from "%s"' % t).fetchone()[0]
        total += n
        log("  %-20s %d" % (t, n))
    log("  合计 %d 行（跳过：%s）\n" % (total, ", ".join(sorted(SKIP_TABLES))))

    pb = PB(args.base)
    pb.login()
    log("== 2. 连接 PocketBase %s（superuser 已登录）==" % args.base)

    if not args.apply:
        # dry-run：检查图片可解析性
        m = Migrator(pb, con, uploads, apply=False)
        missing = 0
        checked = 0
        for table, col in [("dines", "image_url"), ("items", "image_url"),
                           ("wanders", "image_url"), ("recipes", "image_url"),
                           ("destinations", "cover_image"), ("tasks", "image_url"),
                           ("wishes", "image_url")]:
            for r in m.rows(table):
                for p in parse_images(r[col], uploads) or [normalize_upload_path(r[col], uploads)]:
                    if p is None:
                        continue
                    checked += 1
                    if not p.is_file():
                        missing += 1
        log("  图片引用 %d 个，磁盘缺失 %d 个" % (checked, missing))
        if missing:
            warn("部分图片文件缺失（V1 上传目录可能不完整），迁移时会跳过")
        log("\n== dry-run 完成：未写入任何数据。加 --apply 执行迁移 ==")
        return

    m = Migrator(pb, con, uploads, apply=True)
    log("\n== 3. 开始迁移 ==")
    m.migrate_users()
    log("  用户 %d 个" % len(m.user_map))
    m.migrate_pairing()
    m.migrate_user_settings()
    m.migrate_recipes()
    m.migrate_cook_history()
    m.migrate_anniversaries()
    m.migrate_destinations()
    m.migrate_expenses()
    m.migrate_interactive()          # tasks/wishes（先 pending）
    m.migrate_point_transactions()   # 流水先落库，随后的状态补回因幂等不会重复发分
    m.apply_interactive_status()
    m.migrate_wanders()
    m.migrate_dines()
    m.migrate_items()
    m.migrate_todos()

    # ---- 报告 ----
    report = {
        "stats": pb.stats,
        "credentials": m.credentials,
        "warnings": pb.warnings + ["缺失图片: %s" % p for p in m.missing_files[:50]],
        "missing_files_count": len(m.missing_files),
    }
    out = ROOT / "scripts" / "migration_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    log("\n== 4. 结果 ==")
    for k in sorted(pb.stats):
        v = pb.stats[k]
        log("  %-20s 成功 %d，失败 %d" % (k, v["ok"], v["fail"]))
    log("\n  临时密码已写入 %s" % out)
    for c in m.credentials:
        log("    %s -> %s" % (c["username"], c["temp_password"]))
    if pb.warnings:
        log("\n  告警 %d 条（详见报告）" % len(pb.warnings))
        for w in pb.warnings[:10]:
            log("    - " + w)
    log("\n  ⚠️ 密码为随机临时密码，请登录后立即修改并删除 migration_report.json")


if __name__ == "__main__":
    main()
