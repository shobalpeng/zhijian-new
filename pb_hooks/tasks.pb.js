// 织间 zhijian —— 任务（tasks）状态机 + 积分发放
//
// 状态机：pending -> submitted -> confirmed（confirmed 为终态，不可回退）
//   submit ：仅 assignee 可做（pending   -> submitted），自动写 submitted_at
//   confirm：仅 creator  可做（submitted -> confirmed），自动写 confirmed_at
//   编辑   ：仅 creator 且旧状态为 pending
//   删除   ：仅 creator 且状态为 pending
//
// 积分发放：放在 onRecordAfterUpdateSuccess（事务提交后）执行。
//   ⚠️ 不要放在 onRecordUpdateRequest 的 e.next() 之后写库——外层事务仍持有 SQLite 写锁，
//      $app.save() 会失败且异常被静默吞掉（实测：状态更新成功但积分流水为 0）。
//   幂等由「查重 + (source_type, source_id) 唯一索引」双重保证，并发重复确认只发一次。
//   月度上限：user_settings.monthly_point_cap，仅作用于 earned 方向，超出部分截断。
//   余额下限 0：扣分最多扣到 0。
//
// v0.40 约束（实测）：
//   1. 辅助函数必须内联在 handler 内部，顶层函数 / var fn / globalThis 在运行时不可见
//   2. before 类钩子（onRecord*Request）必须调用 e.next()，否则操作被静默回滚

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
        var assignee = rec.get("assignee") || "";
        if (!assignee) {
            if (!partnerId) return deny(400, "请先绑定伴侣");
            assignee = partnerId;
        }
        if (assignee !== auth.id && assignee !== partnerId) {
            return deny(400, "执行人只能是你或你的伴侣");
        }
        rec.set("assignee", assignee);
    }

    e.next();
}, "tasks");

// ---------- 更新（状态流转，不发分） ----------
onRecordUpdateRequest(function (e) {
    function deny(status, message) {
        e.json(status, { ok: false, error: message });
    }
    function nowStr() {
        return new Date().toISOString().replace("T", " ");
    }

    var auth = e.auth;
    if (!auth) return deny(401, "未登录");

    // 管理后台（superuser）放行：不做角色约束，也不发分
    if (e.hasSuperuserAuth()) return e.next();

    var rec = e.record;
    var old = rec.original();
    var oldStatus = old.get("status");
    var newStatus = rec.get("status") || oldStatus;

    var creatorId = old.get("creator") || "";
    var assigneeId = old.get("assignee") || "";
    var meId = auth.id;

    // 归属字段锁定：不允许通过更新篡改
    rec.set("creator", creatorId);
    rec.set("assignee", assigneeId);

    if (newStatus === oldStatus) {
        // 编辑：仅 creator，且必须 pending
        if (creatorId !== meId) return deny(403, "只有创建者可以编辑");
        if (oldStatus !== "pending") return deny(400, "当前状态不可编辑");
        var p = Number(rec.get("points"));
        if (isNaN(p) || p < 0) return deny(400, "积分不能为负数");
        return e.next();
    }

    if (oldStatus === "confirmed") {
        return deny(400, "已完成的任务不可再变更");
    }

    if (oldStatus === "pending" && newStatus === "submitted") {
        if (assigneeId !== meId) return deny(403, "只有执行人可以提交");
        rec.set("submitted_at", nowStr());
        return e.next();
    }

    if (oldStatus === "submitted" && newStatus === "confirmed") {
        if (creatorId !== meId) return deny(403, "只有创建者可以确认");
        rec.set("confirmed_at", nowStr());
        return e.next();
    }

    return deny(400, "不允许的状态变更：" + oldStatus + " -> " + newStatus);
}, "tasks");

// ---------- 确认后发放积分（事务提交后执行，避免写锁冲突） ----------
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
    function monthEarned(userId) {
        var d = new Date();
        var start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
            .toISOString().replace("T", " ");
        var rows = [];
        try {
            rows = $app.findRecordsByFilter(
                "point_transactions",
                "user = {:uid} && type = {:t} && created_at >= {:start}",
                "-created_at", 0, 0,
                { uid: userId, t: "earned", start: start }
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
    function monthlyCap(userId) {
        try {
            var s = $app.findFirstRecordByFilter("user_settings", "user = {:uid}", { uid: userId });
            var raw = s.get("monthly_point_cap");
            if (raw === null || raw === undefined || raw === "") return null;
            var n = Number(raw);
            return (isNaN(n) || n <= 0) ? null : n;
        } catch (err) {
            return null;
        }
    }
    function grantPoints(userId, amount, sourceType, sourceId) {
        // 幂等：已发放过则跳过（并发下由唯一索引兜底）
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
            var balance = sumPoints(userId);
            if (balance + finalAmount < 0) finalAmount = -balance;
        } else {
            var cap = monthlyCap(userId);
            if (cap !== null) {
                var earned = monthEarned(userId);
                if (earned + finalAmount > cap) finalAmount = cap - earned;
                if (finalAmount < 0) finalAmount = 0;
            }
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
            // 唯一索引冲突 = 并发重复发放，视为已发放；其余错误记录日志
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
                console.log("[zhijian] 任务积分发放失败:", String(err), "task=", sourceId);
            }
            return 0;
        }
        return finalAmount;
    }

    try {
        var rec = e.record;
        if (!rec) return;
        if (rec.get("status") !== "confirmed") return;

        var assigneeId = rec.get("assignee") || "";
        if (!assigneeId) return;

        var pts = Number(rec.get("points"));
        if (isNaN(pts) || pts <= 0) return;

        grantPoints(assigneeId, pts, "task", rec.id);
    } catch (err) {
        console.log("[zhijian] tasks 发分钩子异常:", String(err));
    }
}, "tasks");

// ---------- 删除 ----------
onRecordDeleteRequest(function (e) {
    function deny(status, message) {
        e.json(status, { ok: false, error: message });
    }

    var auth = e.auth;
    if (!auth) return deny(401, "未登录");
    if (e.hasSuperuserAuth()) return e.next();

    var rec = e.record;
    if ((rec.get("creator") || "") !== auth.id) return deny(403, "只有创建者可以删除");
    if (rec.get("status") !== "pending") return deny(400, "只有待完成状态可以删除");

    e.next();
}, "tasks");
