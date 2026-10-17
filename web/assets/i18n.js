// 界面文字：简体 / 繁體 / English
(function () {
  const zh = {
    'nav.home': '总览', 'nav.keys': '密钥', 'nav.topup': '充值', 'nav.billing': '账单', 'nav.me': '我的',
    'nav.pricing': '模型价格', 'nav.logout': '退出登录', 'nav.console': '进入控制台', 'nav.download': '下载 App',

    'land.title': '一个密钥，\n接通所有主流大模型',
    'land.sub': '兼容 OpenAI 与 Anthropic 接口格式。换掉 Base URL 和 Key，现有代码、Cursor、Claude Code、沉浸式翻译都能直接用。',
    'land.start': '免费注册', 'land.login': '登录', 'land.endpoint': '接口地址',
    'land.f1.t': '按量计费，用多少扣多少', 'land.f1.p': '没有月费和最低消费。每次调用的模型、Token 数和费用都能在账单里查到。',
    'land.f2.t': '支付宝、微信直接充值', 'land.f2.p': '充值秒到账，余额永久有效。也支持兑换码。',
    'land.f3.t': '一个 Key 切换任意模型', 'land.f3.p': '在请求里改 model 名称即可，不用为每家厂商单独开户。',
    'land.prices': '部分模型价格', 'land.allPrices': '查看全部模型价格',
    'nav.main': '主导航', 'land.web': '打开网页版', 'land.board': '多个模型汇聚到你的一个 Key', 'land.yourKey': '你的一个 Key',
    'land.dev.t': '现有代码，\n改两行就能用', 'land.dev.p': '把 Base URL 换成星枢的地址，填上你的 Key。OpenAI SDK、Anthropic SDK 和常见客户端都不用改别的。',
    'land.dev.keys': '管理我的 Key', 'land.dev.hello': '你好', 'land.apps': '在哪都能用',
    'land.app.apk': '下载 APK 安装包', 'land.app.exe': '下载安装程序', 'land.app.dmg': 'Intel 与 Apple 芯片通用',

    'auth.login': '登录', 'auth.register': '注册', 'auth.username': '用户名', 'auth.password': '密码',
    'auth.password2': '再次输入密码', 'auth.email': '邮箱', 'auth.code': '邮箱验证码', 'auth.sendCode': '发送验证码',
    'auth.resend': '{n} 秒后可重发', 'auth.codeSent': '验证码已发送，请查收邮箱', 'auth.aff': '邀请码（选填）',
    'auth.noAccount': '还没有账号？', 'auth.haveAccount': '已有账号？', 'auth.toRegister': '注册', 'auth.toLogin': '登录',
    'auth.2fa': '两步验证', 'auth.2faHint': '输入身份验证器 App 里的 6 位数字，或一个备用码。', 'auth.2faCode': '验证码',
    'auth.verify': '验证并登录', 'auth.welcome': '登录成功', 'auth.registered': '注册成功，请登录',
    'auth.pwdMismatch': '两次输入的密码不一样', 'auth.pwdShort': '密码至少 8 位',
    'auth.regClosed': '目前暂停新用户注册', 'auth.forgot': '忘记密码？', 'auth.forgotHint': '输入注册邮箱，我们会发送重置链接。',
    'auth.sendReset': '发送重置邮件', 'auth.resetSent': '重置邮件已发送，请查收', 'auth.back': '返回登录',
    'auth.humanCheck': '请先完成人机验证',

    'home.balance': '余额', 'home.used': '已用', 'home.requests': '请求次数', 'home.low': '余额不多了，充值后可继续使用。',
    'home.topup': '充值', 'home.connect': '接入信息', 'home.baseUrl': 'Base URL', 'home.key': 'API Key',
    'home.noKey': '还没有密钥', 'home.createKey': '创建密钥', 'home.quick': '快速开始', 'home.usage': '最近 7 天消费',
    'home.recent': '最近调用', 'home.viewAll': '全部账单', 'home.hello': '你好，{name}',
    'home.claudeCode': 'Claude Code 用法',

    'keys.title': 'API 密钥', 'keys.sub': '每个应用单独建一个密钥，泄露时只删这一个。',
    'keys.create': '创建密钥', 'keys.edit': '编辑密钥', 'keys.name': '名称', 'keys.namePh': '例如：Cursor、我的网站',
    'keys.limit': '额度上限', 'keys.unlimited': '不限额度（用账户余额）', 'keys.limitPh': '最多可用金额',
    'keys.expire': '有效期', 'keys.never': '永不过期', 'keys.d1': '1 天', 'keys.d30': '30 天', 'keys.d90': '90 天', 'keys.d365': '1 年',
    'keys.models': '限制可用模型（选填，逗号分隔）', 'keys.group': '分组',
    'keys.on': '启用', 'keys.off': '已停用', 'keys.expired': '已过期', 'keys.exhausted': '额度用完',
    'keys.used': '已用 {v}', 'keys.left': '剩余 {v}', 'keys.noLimit': '不限额', 'keys.expires': '{d} 到期',
    'keys.copy': '复制密钥', 'keys.copied': '密钥已复制', 'keys.disable': '停用', 'keys.enable': '启用',
    'keys.delete': '删除', 'keys.delConfirm': '删除密钥「{name}」？用这个密钥的应用会立刻无法调用。',
    'keys.deleted': '密钥已删除', 'keys.saved': '已保存', 'keys.created': '密钥已创建',
    'keys.empty': '还没有密钥', 'keys.emptyP': '创建一个密钥，填到你的应用里就能开始调用。',

    'top.title': '充值', 'top.sub': '充值到账户余额，所有密钥共用。',
    'top.amount': '充值金额', 'top.custom': '自定义金额', 'top.method': '支付方式', 'top.pay': '去支付',
    'top.payable': '实付', 'top.get': '到账', 'top.discount': '{d} 折', 'top.min': '最低充值 {v}',
    'top.redeem': '兑换码', 'top.redeemPh': '输入兑换码', 'top.redeemBtn': '兑换', 'top.redeemed': '兑换成功，到账 {v}',
    'top.history': '充值记录', 'top.noHistory': '还没有充值记录', 'top.disabled': '在线充值暂未开放，可以使用兑换码。',
    'top.jumping': '正在打开支付页面…', 'top.paid': '支付完成后余额会自动到账，如未到账请稍等 1 分钟后刷新。',
    'top.status.success': '已到账', 'top.status.pending': '待支付', 'top.status.expired': '已关闭', 'top.status.failed': '失败',
    'top.alipay': '支付宝', 'top.wxpay': '微信支付', 'top.qqpay': 'QQ 钱包', 'top.usdt': 'USDT',

    'bill.title': '账单', 'bill.sub': '每一次调用的模型、Token 数和费用。',
    'bill.all': '全部', 'bill.consume': '消费', 'bill.topup': '充值', 'bill.error': '错误', 'bill.refund': '退款', 'bill.system': '系统', 'bill.manage': '管理',
    'bill.time': '时间', 'bill.key': '密钥', 'bill.model': '模型', 'bill.in': '输入', 'bill.out': '输出', 'bill.cost': '费用', 'bill.dur': '耗时',
    'bill.searchModel': '按模型筛选', 'bill.searchKey': '按密钥筛选', 'bill.empty': '这段时间没有记录', 'bill.emptyP': '调用一次接口后，记录会出现在这里。',
    'bill.prev': '上一页', 'bill.next': '下一页', 'bill.page': '第 {p} 页', 'bill.stream': '流式',
    'bill.periodCost': '本页合计 {v}', 'bill.today': '今天', 'bill.d7': '近 7 天', 'bill.d30': '近 30 天',

    'price.title': '模型价格', 'price.sub': '按 100 万 Token 计价，实际扣费以账单为准。',
    'price.in': '输入 / 1M', 'price.out': '输出 / 1M', 'price.per': '每次调用', 'price.search': '搜索模型',
    'price.empty': '没有找到这个模型', 'price.group': '你的分组倍率 ×{r}',

    'me.title': '我的', 'me.account': '账户', 'me.id': '用户 ID', 'me.group': '分组', 'me.email': '邮箱',
    'me.pwd': '修改密码', 'me.oldPwd': '当前密码', 'me.newPwd': '新密码', 'me.pwdSaved': '密码已修改，请重新登录',
    'me.lang': '语言', 'me.theme': '外观', 'me.auto': '跟随系统', 'me.light': '浅色', 'me.dark': '深色',
    'me.invite': '邀请好友', 'me.inviteP': '好友通过你的链接注册并充值，你会获得奖励额度。',
    'me.inviteLink': '邀请链接', 'me.invited': '已邀请', 'me.reward': '待提取奖励', 'me.rewardTotal': '累计奖励',
    'me.transfer': '提取到余额', 'me.transferred': '已提取到余额',
    'me.download': '下载 App', 'me.support': '联系客服', 'me.checkin': '每日签到', 'me.checkedIn': '今天已签到',
    'me.checkinOk': '签到成功，获得 {v}',

    'dl.title': '下载 App', 'dl.sub': '手机和电脑都能用，登录同一个账号。',
    'dl.android': 'Android', 'dl.ios': 'iPhone / iPad', 'dl.win': 'Windows', 'dl.mac': 'macOS',
    'dl.iosNote': 'iOS 版为 ipa 安装包，需用全能签、爱思助手等工具自签名后安装。',
    'dl.get': '下载', 'dl.web': '网页版', 'dl.webMeta': '不用安装，浏览器直接打开', 'dl.open': '打开',

    'c.copy': '复制', 'c.copied': '已复制', 'c.save': '保存', 'c.cancel': '取消', 'c.confirm': '确定', 'c.close': '关闭',
    'c.loading': '加载中…', 'c.retry': '重试', 'c.error': '出错了：{m}', 'c.network': '网络连接失败，请检查网络后重试',
    'c.sessionExpired': '登录已过期，请重新登录', 'c.more': '更多', 'c.optional': '选填', 'c.done': '完成'
  };

  const tw = {
    'nav.home': '總覽', 'nav.keys': '金鑰', 'nav.topup': '儲值', 'nav.billing': '帳單', 'nav.me': '我的',
    'nav.pricing': '模型價格', 'nav.logout': '登出', 'nav.console': '進入控制台', 'nav.download': '下載 App',

    'land.title': '一個金鑰，\n接通所有主流大模型',
    'land.sub': '相容 OpenAI 與 Anthropic 介面格式。換掉 Base URL 和 Key，現有程式碼、Cursor、Claude Code、沉浸式翻譯都能直接用。',
    'land.start': '免費註冊', 'land.login': '登入', 'land.endpoint': '介面位址',
    'land.f1.t': '按量計費，用多少扣多少', 'land.f1.p': '沒有月費和最低消費。每次呼叫的模型、Token 數和費用都能在帳單裡查到。',
    'land.f2.t': '支付寶、微信直接儲值', 'land.f2.p': '儲值秒到帳，餘額永久有效。也支援兌換碼。',
    'land.f3.t': '一個 Key 切換任意模型', 'land.f3.p': '在請求裡改 model 名稱即可，不用為每家廠商單獨開戶。',
    'land.prices': '部分模型價格', 'land.allPrices': '查看全部模型價格',
    'nav.main': '主導覽', 'land.web': '開啟網頁版', 'land.board': '多個模型匯聚到你的一個 Key', 'land.yourKey': '你的一個 Key',
    'land.dev.t': '現有程式碼，\n改兩行就能用', 'land.dev.p': '把 Base URL 換成星樞的位址，填上你的 Key。OpenAI SDK、Anthropic SDK 和常見客戶端都不用改別的。',
    'land.dev.keys': '管理我的 Key', 'land.dev.hello': '你好', 'land.apps': '在哪都能用',
    'land.app.apk': '下載 APK 安裝檔', 'land.app.exe': '下載安裝程式', 'land.app.dmg': 'Intel 與 Apple 晶片通用',

    'auth.login': '登入', 'auth.register': '註冊', 'auth.username': '使用者名稱', 'auth.password': '密碼',
    'auth.password2': '再次輸入密碼', 'auth.email': '電子郵件', 'auth.code': '郵件驗證碼', 'auth.sendCode': '發送驗證碼',
    'auth.resend': '{n} 秒後可重發', 'auth.codeSent': '驗證碼已發送，請查收郵件', 'auth.aff': '邀請碼（選填）',
    'auth.noAccount': '還沒有帳號？', 'auth.haveAccount': '已有帳號？', 'auth.toRegister': '註冊', 'auth.toLogin': '登入',
    'auth.2fa': '兩步驟驗證', 'auth.2faHint': '輸入驗證器 App 裡的 6 位數字，或一組備用碼。', 'auth.2faCode': '驗證碼',
    'auth.verify': '驗證並登入', 'auth.welcome': '登入成功', 'auth.registered': '註冊成功，請登入',
    'auth.pwdMismatch': '兩次輸入的密碼不一樣', 'auth.pwdShort': '密碼至少 8 位',
    'auth.regClosed': '目前暫停新使用者註冊', 'auth.forgot': '忘記密碼？', 'auth.forgotHint': '輸入註冊信箱，我們會寄送重設連結。',
    'auth.sendReset': '寄送重設郵件', 'auth.resetSent': '重設郵件已寄出，請查收', 'auth.back': '返回登入',
    'auth.humanCheck': '請先完成人機驗證',

    'home.balance': '餘額', 'home.used': '已用', 'home.requests': '請求次數', 'home.low': '餘額不多了，儲值後可繼續使用。',
    'home.topup': '儲值', 'home.connect': '接入資訊', 'home.baseUrl': 'Base URL', 'home.key': 'API Key',
    'home.noKey': '還沒有金鑰', 'home.createKey': '建立金鑰', 'home.quick': '快速開始', 'home.usage': '最近 7 天消費',
    'home.recent': '最近呼叫', 'home.viewAll': '全部帳單', 'home.hello': '你好，{name}',
    'home.claudeCode': 'Claude Code 用法',

    'keys.title': 'API 金鑰', 'keys.sub': '每個應用單獨建一個金鑰，外洩時只刪這一個。',
    'keys.create': '建立金鑰', 'keys.edit': '編輯金鑰', 'keys.name': '名稱', 'keys.namePh': '例如：Cursor、我的網站',
    'keys.limit': '額度上限', 'keys.unlimited': '不限額度（使用帳戶餘額）', 'keys.limitPh': '最多可用金額',
    'keys.expire': '有效期', 'keys.never': '永不過期', 'keys.d1': '1 天', 'keys.d30': '30 天', 'keys.d90': '90 天', 'keys.d365': '1 年',
    'keys.models': '限制可用模型（選填，逗號分隔）', 'keys.group': '分組',
    'keys.on': '啟用', 'keys.off': '已停用', 'keys.expired': '已過期', 'keys.exhausted': '額度用完',
    'keys.used': '已用 {v}', 'keys.left': '剩餘 {v}', 'keys.noLimit': '不限額', 'keys.expires': '{d} 到期',
    'keys.copy': '複製金鑰', 'keys.copied': '金鑰已複製', 'keys.disable': '停用', 'keys.enable': '啟用',
    'keys.delete': '刪除', 'keys.delConfirm': '刪除金鑰「{name}」？使用這個金鑰的應用會立刻無法呼叫。',
    'keys.deleted': '金鑰已刪除', 'keys.saved': '已儲存', 'keys.created': '金鑰已建立',
    'keys.empty': '還沒有金鑰', 'keys.emptyP': '建立一個金鑰，填到你的應用裡就能開始呼叫。',

    'top.title': '儲值', 'top.sub': '儲值到帳戶餘額，所有金鑰共用。',
    'top.amount': '儲值金額', 'top.custom': '自訂金額', 'top.method': '付款方式', 'top.pay': '去付款',
    'top.payable': '實付', 'top.get': '到帳', 'top.discount': '{d} 折', 'top.min': '最低儲值 {v}',
    'top.redeem': '兌換碼', 'top.redeemPh': '輸入兌換碼', 'top.redeemBtn': '兌換', 'top.redeemed': '兌換成功，到帳 {v}',
    'top.history': '儲值紀錄', 'top.noHistory': '還沒有儲值紀錄', 'top.disabled': '線上儲值暫未開放，可以使用兌換碼。',
    'top.jumping': '正在開啟付款頁面…', 'top.paid': '付款完成後餘額會自動到帳，如未到帳請稍等 1 分鐘後重新整理。',
    'top.status.success': '已到帳', 'top.status.pending': '待付款', 'top.status.expired': '已關閉', 'top.status.failed': '失敗',
    'top.alipay': '支付寶', 'top.wxpay': '微信支付', 'top.qqpay': 'QQ 錢包', 'top.usdt': 'USDT',

    'bill.title': '帳單', 'bill.sub': '每一次呼叫的模型、Token 數和費用。',
    'bill.all': '全部', 'bill.consume': '消費', 'bill.topup': '儲值', 'bill.error': '錯誤', 'bill.refund': '退款', 'bill.system': '系統', 'bill.manage': '管理',
    'bill.time': '時間', 'bill.key': '金鑰', 'bill.model': '模型', 'bill.in': '輸入', 'bill.out': '輸出', 'bill.cost': '費用', 'bill.dur': '耗時',
    'bill.searchModel': '按模型篩選', 'bill.searchKey': '按金鑰篩選', 'bill.empty': '這段時間沒有紀錄', 'bill.emptyP': '呼叫一次介面後，紀錄會出現在這裡。',
    'bill.prev': '上一頁', 'bill.next': '下一頁', 'bill.page': '第 {p} 頁', 'bill.stream': '串流',
    'bill.periodCost': '本頁合計 {v}', 'bill.today': '今天', 'bill.d7': '近 7 天', 'bill.d30': '近 30 天',

    'price.title': '模型價格', 'price.sub': '按 100 萬 Token 計價，實際扣費以帳單為準。',
    'price.in': '輸入 / 1M', 'price.out': '輸出 / 1M', 'price.per': '每次呼叫', 'price.search': '搜尋模型',
    'price.empty': '沒有找到這個模型', 'price.group': '你的分組倍率 ×{r}',

    'me.title': '我的', 'me.account': '帳戶', 'me.id': '使用者 ID', 'me.group': '分組', 'me.email': '電子郵件',
    'me.pwd': '修改密碼', 'me.oldPwd': '目前密碼', 'me.newPwd': '新密碼', 'me.pwdSaved': '密碼已修改，請重新登入',
    'me.lang': '語言', 'me.theme': '外觀', 'me.auto': '跟隨系統', 'me.light': '淺色', 'me.dark': '深色',
    'me.invite': '邀請好友', 'me.inviteP': '好友透過你的連結註冊並儲值，你會獲得獎勵額度。',
    'me.inviteLink': '邀請連結', 'me.invited': '已邀請', 'me.reward': '待提取獎勵', 'me.rewardTotal': '累計獎勵',
    'me.transfer': '提取到餘額', 'me.transferred': '已提取到餘額',
    'me.download': '下載 App', 'me.support': '聯絡客服', 'me.checkin': '每日簽到', 'me.checkedIn': '今天已簽到',
    'me.checkinOk': '簽到成功，獲得 {v}',

    'dl.title': '下載 App', 'dl.sub': '手機和電腦都能用，登入同一個帳號。',
    'dl.android': 'Android', 'dl.ios': 'iPhone / iPad', 'dl.win': 'Windows', 'dl.mac': 'macOS',
    'dl.iosNote': 'iOS 版為 ipa 安裝檔，需用全能簽、愛思助手等工具自簽後安裝。',
    'dl.get': '下載', 'dl.web': '網頁版', 'dl.webMeta': '不用安裝，瀏覽器直接開啟', 'dl.open': '開啟',

    'c.copy': '複製', 'c.copied': '已複製', 'c.save': '儲存', 'c.cancel': '取消', 'c.confirm': '確定', 'c.close': '關閉',
    'c.loading': '載入中…', 'c.retry': '重試', 'c.error': '出錯了：{m}', 'c.network': '網路連線失敗，請檢查網路後重試',
    'c.sessionExpired': '登入已過期，請重新登入', 'c.more': '更多', 'c.optional': '選填', 'c.done': '完成'
  };

  const en = {
    'nav.home': 'Overview', 'nav.keys': 'Keys', 'nav.topup': 'Top up', 'nav.billing': 'Usage', 'nav.me': 'Account',
    'nav.pricing': 'Pricing', 'nav.logout': 'Sign out', 'nav.console': 'Open console', 'nav.download': 'Get the app',

    'land.title': 'One key for\nevery major model',
    'land.sub': 'Works with the OpenAI and Anthropic API formats. Swap the base URL and key, and your code, Cursor or Claude Code keep working.',
    'land.start': 'Create account', 'land.login': 'Sign in', 'land.endpoint': 'Endpoint',
    'land.f1.t': 'Pay only for what you use', 'land.f1.p': 'No subscription or minimum. Every call’s model, tokens and cost show up in your usage log.',
    'land.f2.t': 'Top up with Alipay or WeChat Pay', 'land.f2.p': 'Credit arrives instantly and never expires. Redeem codes work too.',
    'land.f3.t': 'Switch models by name', 'land.f3.p': 'Change the model field in your request. No separate account with each provider.',
    'land.prices': 'Selected model prices', 'land.allPrices': 'See all model prices',
    'nav.main': 'Main', 'land.web': 'Open web app', 'land.board': 'Many models flowing into one key', 'land.yourKey': 'Your one key',
    'land.dev.t': 'Keep your code.\nChange two lines.', 'land.dev.p': 'Point the base URL at us and use your key. The OpenAI SDK, the Anthropic SDK and most clients need nothing else.',
    'land.dev.keys': 'Manage my keys', 'land.dev.hello': 'Hello', 'land.apps': 'Use it anywhere',
    'land.app.apk': 'APK installer', 'land.app.exe': 'Windows installer', 'land.app.dmg': 'Intel and Apple silicon',

    'auth.login': 'Sign in', 'auth.register': 'Create account', 'auth.username': 'Username', 'auth.password': 'Password',
    'auth.password2': 'Confirm password', 'auth.email': 'Email', 'auth.code': 'Email code', 'auth.sendCode': 'Send code',
    'auth.resend': 'Resend in {n}s', 'auth.codeSent': 'Code sent. Check your inbox.', 'auth.aff': 'Invite code (optional)',
    'auth.noAccount': 'New here?', 'auth.haveAccount': 'Already have an account?', 'auth.toRegister': 'Create account', 'auth.toLogin': 'Sign in',
    'auth.2fa': 'Two-step verification', 'auth.2faHint': 'Enter the 6-digit code from your authenticator app, or a backup code.', 'auth.2faCode': 'Code',
    'auth.verify': 'Verify and sign in', 'auth.welcome': 'Signed in', 'auth.registered': 'Account created. Sign in to continue.',
    'auth.pwdMismatch': 'Passwords don’t match', 'auth.pwdShort': 'Use at least 8 characters',
    'auth.regClosed': 'New sign-ups are paused', 'auth.forgot': 'Forgot password?', 'auth.forgotHint': 'Enter your account email and we’ll send a reset link.',
    'auth.sendReset': 'Send reset email', 'auth.resetSent': 'Reset email sent', 'auth.back': 'Back to sign in',
    'auth.humanCheck': 'Complete the human check first',

    'home.balance': 'Balance', 'home.used': 'Spent', 'home.requests': 'Requests', 'home.low': 'Your balance is running low. Top up to keep calls running.',
    'home.topup': 'Top up', 'home.connect': 'Connection details', 'home.baseUrl': 'Base URL', 'home.key': 'API key',
    'home.noKey': 'No key yet', 'home.createKey': 'Create key', 'home.quick': 'Quick start', 'home.usage': 'Spend, last 7 days',
    'home.recent': 'Recent calls', 'home.viewAll': 'All usage', 'home.hello': 'Hi, {name}',
    'home.claudeCode': 'Claude Code setup',

    'keys.title': 'API keys', 'keys.sub': 'Use one key per app, so a leak only means deleting that key.',
    'keys.create': 'Create key', 'keys.edit': 'Edit key', 'keys.name': 'Name', 'keys.namePh': 'e.g. Cursor, my website',
    'keys.limit': 'Spending limit', 'keys.unlimited': 'No limit (draws from your balance)', 'keys.limitPh': 'Maximum spend',
    'keys.expire': 'Expires', 'keys.never': 'Never', 'keys.d1': '1 day', 'keys.d30': '30 days', 'keys.d90': '90 days', 'keys.d365': '1 year',
    'keys.models': 'Allowed models (optional, comma separated)', 'keys.group': 'Group',
    'keys.on': 'Active', 'keys.off': 'Disabled', 'keys.expired': 'Expired', 'keys.exhausted': 'Limit reached',
    'keys.used': '{v} spent', 'keys.left': '{v} left', 'keys.noLimit': 'No limit', 'keys.expires': 'Expires {d}',
    'keys.copy': 'Copy key', 'keys.copied': 'Key copied', 'keys.disable': 'Disable', 'keys.enable': 'Enable',
    'keys.delete': 'Delete', 'keys.delConfirm': 'Delete “{name}”? Apps using this key will stop working right away.',
    'keys.deleted': 'Key deleted', 'keys.saved': 'Saved', 'keys.created': 'Key created',
    'keys.empty': 'No keys yet', 'keys.emptyP': 'Create a key and paste it into your app to start making calls.',

    'top.title': 'Top up', 'top.sub': 'Adds to your account balance, shared by all keys.',
    'top.amount': 'Amount', 'top.custom': 'Custom amount', 'top.method': 'Payment method', 'top.pay': 'Pay now',
    'top.payable': 'You pay', 'top.get': 'You get', 'top.discount': '{d}× price', 'top.min': 'Minimum {v}',
    'top.redeem': 'Redeem code', 'top.redeemPh': 'Enter code', 'top.redeemBtn': 'Redeem', 'top.redeemed': 'Redeemed. {v} added.',
    'top.history': 'Top-up history', 'top.noHistory': 'No top-ups yet', 'top.disabled': 'Online payment isn’t available yet. You can still redeem a code.',
    'top.jumping': 'Opening the payment page…', 'top.paid': 'Your balance updates automatically after payment. If it hasn’t, wait a minute and refresh.',
    'top.status.success': 'Paid', 'top.status.pending': 'Pending', 'top.status.expired': 'Closed', 'top.status.failed': 'Failed',
    'top.alipay': 'Alipay', 'top.wxpay': 'WeChat Pay', 'top.qqpay': 'QQ Wallet', 'top.usdt': 'USDT',

    'bill.title': 'Usage', 'bill.sub': 'Model, tokens and cost for every call.',
    'bill.all': 'All', 'bill.consume': 'Calls', 'bill.topup': 'Top-ups', 'bill.error': 'Errors', 'bill.refund': 'Refunds', 'bill.system': 'System', 'bill.manage': 'Admin',
    'bill.time': 'Time', 'bill.key': 'Key', 'bill.model': 'Model', 'bill.in': 'Input', 'bill.out': 'Output', 'bill.cost': 'Cost', 'bill.dur': 'Time taken',
    'bill.searchModel': 'Filter by model', 'bill.searchKey': 'Filter by key', 'bill.empty': 'Nothing in this period', 'bill.emptyP': 'Make an API call and it will show up here.',
    'bill.prev': 'Previous', 'bill.next': 'Next', 'bill.page': 'Page {p}', 'bill.stream': 'Stream',
    'bill.periodCost': 'Page total {v}', 'bill.today': 'Today', 'bill.d7': '7 days', 'bill.d30': '30 days',

    'price.title': 'Model pricing', 'price.sub': 'Per million tokens. Your usage log shows the exact charge.',
    'price.in': 'Input / 1M', 'price.out': 'Output / 1M', 'price.per': 'Per call', 'price.search': 'Search models',
    'price.empty': 'No model matches that search', 'price.group': 'Your group multiplier ×{r}',

    'me.title': 'Account', 'me.account': 'Account', 'me.id': 'User ID', 'me.group': 'Group', 'me.email': 'Email',
    'me.pwd': 'Change password', 'me.oldPwd': 'Current password', 'me.newPwd': 'New password', 'me.pwdSaved': 'Password changed. Sign in again.',
    'me.lang': 'Language', 'me.theme': 'Appearance', 'me.auto': 'System', 'me.light': 'Light', 'me.dark': 'Dark',
    'me.invite': 'Invite friends', 'me.inviteP': 'When friends sign up with your link and top up, you earn credit.',
    'me.inviteLink': 'Invite link', 'me.invited': 'Invited', 'me.reward': 'Unclaimed reward', 'me.rewardTotal': 'Total earned',
    'me.transfer': 'Move to balance', 'me.transferred': 'Moved to your balance',
    'me.download': 'Get the app', 'me.support': 'Contact support', 'me.checkin': 'Daily check-in', 'me.checkedIn': 'Checked in today',
    'me.checkinOk': 'Checked in. {v} added.',

    'dl.title': 'Get the app', 'dl.sub': 'Phone or computer, same account.',
    'dl.android': 'Android', 'dl.ios': 'iPhone / iPad', 'dl.win': 'Windows', 'dl.mac': 'macOS',
    'dl.iosNote': 'The iOS build is an unsigned .ipa. Sign it with a tool such as ESign or 3uTools before installing.',
    'dl.get': 'Download', 'dl.web': 'Web app', 'dl.webMeta': 'Runs in your browser, nothing to install', 'dl.open': 'Open',

    'c.copy': 'Copy', 'c.copied': 'Copied', 'c.save': 'Save', 'c.cancel': 'Cancel', 'c.confirm': 'Confirm', 'c.close': 'Close',
    'c.loading': 'Loading…', 'c.retry': 'Try again', 'c.error': 'Something went wrong: {m}', 'c.network': 'Can’t reach the server. Check your connection and try again.',
    'c.sessionExpired': 'Your session expired. Sign in again.', 'c.more': 'More', 'c.optional': 'Optional', 'c.done': 'Done'
  };

  const dicts = { 'zh-CN': zh, 'zh-TW': tw, en };
  function detect() {
    try { const s = localStorage.getItem('lang'); if (s && dicts[s]) return s; } catch (e) {}
    const n = (navigator.language || 'zh-CN').toLowerCase();
    if (n.startsWith('zh')) return /tw|hk|mo|hant/.test(n) ? 'zh-TW' : 'zh-CN';
    return n.startsWith('en') ? 'en' : 'zh-CN';
  }
  let lang = detect();
  window.I18N = {
    langs: [['zh-CN', '简体中文'], ['zh-TW', '繁體中文'], ['en', 'English']],
    get lang() { return lang; },
    set(l) { if (!dicts[l]) return; lang = l; try { localStorage.setItem('lang', l); } catch (e) {} document.documentElement.lang = l; },
    t(key, vars) {
      let s = (dicts[lang] && dicts[lang][key]) || zh[key] || key;
      if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
      return s;
    }
  };
  document.documentElement.lang = lang;
})();
