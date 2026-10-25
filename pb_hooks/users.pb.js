// 织间 zhijian —— users 集合钩子
// 1) 新用户注册时自动生成唯一邀请码 invite_code
// 2) 新用户创建后自动补一条默认 user_settings
//
// PocketBase v0.40 钩子机制要点（本机实测）：
//   - 文件必须是 *.pb.js，用全局函数注册：onRecordCreate(handler, "users")
//   - before 类钩子**必须调用 e.next()**，否则原操作被静默回滚
//   - **顶层函数声明在 handler 内不可见**（var fn = ... / globalThis.fn 同样不行），
//     所有辅助逻辑必须内联或写成 handler 内的嵌套函数

onRecordCreate(function (e) {
    // ---- 内联辅助函数（必须定义在 handler 内部） ----
    function randomCode(len) {
        var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var out = "";
        for (var i = 0; i < len; i++) {
            out += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return out;
    }

    function codeExists(code) {
        try {
            $app.findFirstRecordByFilter("users", "invite_code = {:code}", { code: code });
            return true;
        } catch (err) {
            return false;
        }
    }

    try {
        var current = e.record.get("invite_code");
        if (!current) {
            var code = "";
            for (var i = 0; i < 20; i++) {
                var candidate = randomCode(8);
                if (!codeExists(candidate)) {
                    code = candidate;
                    break;
                }
            }
            if (code) {
                e.record.set("invite_code", code);
            } else {
                console.log("[zhijian] 邀请码生成失败：重试耗尽");
            }
        }
    } catch (err) {
        console.log("[zhijian] users.invite_code 生成异常:", err);
    }
    e.next();
}, "users");

onRecordAfterCreateSuccess(function (e) {
    try {
        var exists = false;
        try {
            $app.findFirstRecordByFilter("user_settings", "user = {:uid}", { uid: e.record.id });
            exists = true;
        } catch (err) {
            exists = false;
        }
        if (!exists) {
            var collection = $app.findCollectionByNameOrId("user_settings");
            var settings = new Record(collection);
            settings.set("user", e.record.id);
            // user_settings.theme 只允许 light/dark（旧代码写的 "warm" 会导致整条记录保存失败）
            settings.set("theme", "light");
            settings.set("color_theme", "blue");
            $app.save(settings);
        }
    } catch (err) {
        console.log("[zhijian] user_settings 初始化失败:", err);
    }
    e.next();
}, "users");
