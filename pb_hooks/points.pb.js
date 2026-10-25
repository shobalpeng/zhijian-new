// 织间 zhijian —— 积分查询
// GET /api/zhijian/balance 返回我与伴侣的积分余额。
// 余额 = point_transactions.amount 的 SUM（无独立余额列，与 V1 一致）。

routerAdd("GET", "/api/zhijian/balance", function (e) {
    // sumPoints 必须内联在 handler 内部（v0.40 顶层函数在 handler 内不可见）
    function sumPoints(userId) {
        if (!userId) return 0;
        // 排序用自建的 created_at（本集合的 created 系统排序字段不可用）
        var records = $app.findRecordsByFilter(
            "point_transactions",
            "user = {:uid}",
            "-created_at",
            0,
            0,
            { uid: userId }
        );
        var total = 0;
        for (var i = 0; i < records.length; i++) {
            var amount = Number(records[i].get("amount"));
            if (!isNaN(amount)) total += amount;
        }
        return total;
    }

    try {
        var me = e.auth;
        if (!me) return e.json(401, { ok: false, error: "未登录" });

        var partnerId = me.get("paired_user") || "";
        return e.json(200, {
            ok: true,
            me: sumPoints(me.id),
            partner: partnerId ? sumPoints(partnerId) : null,
            partnerId: partnerId || null,
        });
    } catch (err) {
        console.log("[zhijian] balance 接口异常:", err);
        return e.json(500, { ok: false, error: String(err) });
    }
}, $apis.requireAuth());
