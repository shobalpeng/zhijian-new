// 织间 zhijian —— 心愿（wishes）状态机 + 积分扣减
//
// 与 tasks 同构，但方向相反：
//   creator 许愿（points = 愿意付出的积分），fulfiller 去实现
//   submit ：仅 fulfiller 可做（pending   -> submitted）
//   confirm：仅 creator  可做（submitted -> confirmed），确认后从 creator 扣除 -points
//   编辑/删除：仅 creator 且状态为 pending
//
// 与 tasks 一样，积分在 onRecordAfterUpdateSuccess（事务提交后）执行，
// 避免在 before 钩子的 e.next() 之后写库撞 SQLite 写锁（实测会静默失败）。
//
// v0.40 约束：辅助函数必须内联在 handler 内部；before 类钩子必须 e.next()。

// ---------- 创建 ----------
onRecordCreateRequest(function (e) {
    function deny(status, message) {
        e.json(status, { ok: false, error: message });
    }

    var auth = e.auth;
    if (!auth) return deny(401, "未登录");

    var rec = e.record;
    rec.set("status", "pending");

    var points = Number(rec.get("points"));
    if (isNaN(points) || points < 0) return deny(400, "积分不能为负数");
    rec.set("points", points);

    if (!e.hasSuperuserAuth()) {
        rec.set("creator", auth.id);

        var partnerId = auth.get("paired_user") || "";
        var fulfiller = rec.get("fulfiller") || "";
        if (!fulfiller) {
            if (!partnerId) return deny(400, "请先绑定伴侣");
            fulfiller = partnerId;
        }
        if (fulfiller !== auth.id && fulfiller !== partnerId) {
            return deny(400, "实现人只能是你或你的伴侣");
        }
        rec.set("fulfiller", fulfiller);
    }

    e.next();
}, "wishes");

// ---------- 更新（状态流转，不扣分） ----------
onRecordUpdateRequest(function (e) {
    function deny(status, message) {
        e.json(status, { ok: false, error: message });
    }
    function nowStr() {
        return new Date().toISOString().replace("T", " ");
    }

    var auth = e.auth;
    if (!auth) return deny(401, "未登录");
    if (e.hasSuperuserAuth()) return e.next();

    var rec = e.record;
    var old = rec.original();
    var oldStatus = old.get("status");
    var newStatus = rec.get("status") || oldStatus;

    var creatorId = old.get("creator") || "";
    var fulfillerId = old.get("fulfiller") || "";
    var meId = auth.id;

    rec.set("creator", creatorId);
    rec.set("fulfiller", fulfillerId);

    if (newStatus === oldStatus) {
        if (creatorId !== meId) return deny(403, "只有许愿的人可以编辑");
        if (oldStatus !== "pending") return deny(400, "当前状态不可编辑");
        var p = Number(rec.get("points"));
        if (isNaN(p) || p < 0) return deny(400, "积分不能为负数");
        return e.next();
    }

    if (oldStatus === "confirmed") {
        return deny(400, "已完成的心愿不可再变更");
    }

    if (oldStatus === "pending" && newStatus === "submitted") {
        if (fulfillerId !== meId) return deny(403, "只有实现的人可以提交");
        rec.set("submitted_at", nowStr());
        return e.next();
    }

    if (oldStatus === "submitted" && newStatus === "confirmed") {
        if (creatorId !== meId) return deny(403, "只有许愿的人可以确认");
        rec.set("confirmed_at", nowStr());
        return e.next();
    }

    return deny(400, "不允许的状态变更：" + oldStatus + " -> " + newStatus);
}, "wishes");

// ---------- 确认后扣除积分（事务提交后执行） ----------
onRecordAfterUpdateSuccess(function (e) {
    function sumPoints(userId) {
        var rows = [];
        try {
            rows = $app.findRecordsByFilter(
                "point_transactions", "user = {:uid}", "-created_at", 0, 0, { uid: userId }
            );
        } catch (err) {
            return 0;
        }
        var total = 0;
        for (var i = 0; i < rows.length; i++) {
            var v = Number(rows[i].get("amount"));
            if (!isNaN(v)) total += v;
        }
        return total;
    }
    function grantPoints(userId, amount, sourceType, sourceId) {
        try {
            var dup = $app.findFirstRecordByFilter(
                "point_transactions",
                "source_type = {:st} && source_id = {:sid}",
                { st: sourceType, sid: sourceId }
            );
            if (dup) return 0;
        } catch (err) {
            /* 未找到，继续 */
        }

        var finalAmount = amount;
        if (finalAmount < 0) {
            // 余额下限 0：不足部分不扣
            var balance = sumPoints(userId);
            if (balance + finalAmount < 0) finalAmount = -balance;
        }

        // 0 额不记流水：number 字段 required 会把 0 判定为 blank 导致保存失败
        if (finalAmount === 0) return 0;

        var coll = $app.findCollectionByNameOrId("point_transactions");
        var tx = new Record(coll);
        tx.set("user", userId);
        tx.set("amount", finalAmount);
        tx.set("type", finalAmount < 0 ? "spent" : "earned");
        tx.set("source_type", sourceType);
        tx.set("source_id", sourceId);

        try {
            $app.save(tx);
        } catch (err) {
            var again = null;
            try {
                again = $app.findFirstRecordByFilter(
                    "point_transactions",
                    "source_type = {:st} && source_id = {:sid}",
                    { st: sourceType, sid: sourceId }
                );
            } catch (err2) {
                again = null;
            }
            if (!again) {
                console.log("[zhijian] 心愿积分扣减失败:", String(err), "wish=", sourceId);
            }
            return 0;
        }
        return finalAmount;
    }

    try {
        var rec = e.record;
        if (!rec) return;
        if (rec.get("status") !== "confirmed") return;

        var creatorId = rec.get("creator") || "";
        if (!creatorId) return;

        var pts = Number(rec.get("points"));
        if (isNaN(pts) || pts <= 0) return;

        // 心愿由 creator 付出积分（负向），余额下限 0
        grantPoints(creatorId, -pts, "wish", rec.id);
    } catch (err) {
        console.log("[zhijian] wishes 发分钩子异常:", String(err));
    }
}, "wishes");

// ---------- 删除 ----------
onRecordDeleteRequest(function (e) {
    function deny(status, message) {
        e.json(status, { ok: false, error: message });
    }

    var auth = e.auth;
    if (!auth) return deny(401, "未登录");
    if (e.hasSuperuserAuth()) return e.next();

    var rec = e.record;
    if ((rec.get("creator") || "") !== auth.id) return deny(403, "只有许愿的人可以删除");
    if (rec.get("status") !== "pending") return deny(400, "只有待完成状态可以删除");

    e.next();
}, "wishes");
