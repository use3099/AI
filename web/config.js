// ===== 站点配置：改这里就能换品牌，不用动其他代码 =====
window.SITE = {
  name: '星枢 API',            // 品牌名（中文）
  nameEn: 'Xingshu API',       // 品牌名（英文界面显示）
  tagline: '一个密钥，接入 Claude、GPT、Gemini 等主流模型',
  taglineEn: 'One key for Claude, GPT, Gemini and more',
  // API 地址：留空 = 自动用当前网址。App 内也会自动用打开的网站地址。
  apiBase: '',
  // 客服 / 交流群（留空则不显示）
  support: { label: 'Telegram 交流群', url: '' },
  // App 下载地址（下载页使用，留空则隐藏对应按钮）
  downloads: {
    android: '/download/app.apk',
    ios: '/download/app.ipa',
    windows: '/download/app-setup.exe',
    mac: '/download/app.dmg'
  },
  // 首页展示的模型（只是展示用，实际可用模型以后台渠道为准）
  showcaseModels: ['claude-sonnet-4-5', 'gpt-5', 'gemini-2.5-pro', 'deepseek-v3', 'claude-opus-4-1', 'gpt-4o-mini']
};
