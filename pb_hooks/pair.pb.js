// 织间 zhijian —— 情侣配对
// 提供：
//   POST /api/zhijian/pair   body: { code }   通过邀请码双向绑定（幂等）
//   POST /api/zhijian/unpair                  解除绑定（双向清空）
// 两者均要求已登录（$apis.requireAuth）。
//
// 注意：辅助函数必须内联在 handler 内部（v0.40 顶层函数在 handler 内不可见）。

routerAdd("POST", "/api/zhijian/pair", function (e) {
    function fail(status, message) {
        e.json(status, { ok: false, error: message });
    }

    function findByInviteCode(code) {
        try {
            return $app.findFirstRecordByFilter("users", "invite_code = {:code}", { code: code });
        } catch (err) {
            return null;
        }
    }

    var me = e.auth;
    if (!me) return fail(401, "未登录");

    var info = e.requestInfo();
    var raw = (info && info.body && info.body.code) ? String(info.body.code) : "";
    var code = raw.trim().toUpperCase();
    if (!code) return fail(400, "请输入邀请码");

    var target = findByInviteCode(code);
    if (!target) return fail(404, "邀请码无效");
    if (target.id === me.id) return fail(400, "不能与自己配对");

    var myPaired = me.get("paired_user") || "";
    var theirPaired = target.get("paired_user") || "";

    // 幂等：已与对方绑定
    if (myPaired === target.id && theirPaired === me.id) {
        return e.json(200, { ok: true, already: true, partnerId: target.id });
    }

    // 任一方已有其他绑定
    if (myPaired || theirPaired) {
        return fail(409, "你或对方已绑定伴侣，请先解除");
    }

    me.set("paired_user", target.id);
    $app.save(me);
    target.set("paired_user", me.id);
    $app.save(target);

    return e.json(200, { ok: true, already: false, partnerId: target.id });
}, $apis.requireAuth());

routerAdd("POST", "/api/zhijian/unpair", function (e) {
    var me = e.auth;
    if (!me) return e.json(401, { ok: false, error: "未登录" });

    var partnerId = me.get("paired_user") || "";
    if (!partnerId) return e.json(200, { ok: true, changed: false });

    var partner = null;
    try {
        partner = $app.findRecordById("users", partnerId);
    } catch (err) {
        partner = null;
    }

    me.set("paired_user", "");
    $app.save(me);
    if (partner) {
        partner.set("paired_user", "");
        $app.save(partner);
    }

    return e.json(200, { ok: true, changed: true });
}, $apis.requireAuth());
