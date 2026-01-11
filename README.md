# Lovart 验证码助手

> 基于 NiMail 临时邮箱 API 的 Lovart 注册验证码自动获取工具

## ✨ 特性

- 🚀 **自动生成**：一键生成 NiMail 临时邮箱
- 🔍 **智能监听**：自动轮询并解析 Lovart 验证码
- 🎨 **现代界面**：采用 Modern Clean SaaS 设计风格
- 📋 **历史记录**：本地存储最近 10 条查询记录
- ⚡ **极速响应**：实时获取验证码，无需手动操作

## 🛠️ 技术栈

- **前端**：原生 HTML + CSS + JavaScript
- **后端**：Node.js (HTTP Server)
- **API**：NiMail 临时邮箱服务

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/sxxxxxxxxxxxxxxxxxxxxx/lovart-verification-code-assistant.git
cd lovart-verification-code-assistant

# 安装依赖（可选，目前无外部依赖）
npm install

# 启动服务
npm start
# 或
node server.js
```

## 🚀 使用

1. 启动服务器后访问 `http://localhost:3001`
2. 点击「生成并监听」按钮
3. 复制生成的邮箱地址到 Lovart 注册页面
4. 系统会自动获取验证码并显示

## 📝 说明

- 服务器默认运行在 `3001` 端口
- 验证码查询间隔：3 秒
- 最大监听时长：3 分钟（60 次查询）
- 历史记录存储在浏览器 LocalStorage

## 🔒 隐私

- 所有数据仅在本地处理
- 不会上传任何个人信息
- 使用 NiMail 官方 API，安全可靠

