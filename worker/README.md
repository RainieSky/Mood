# 映心聊天代理

这是一个部署到 Cloudflare Workers 的轻量聊天代理。代理使用 Workers AI 中的 Qwen3 中文模型，前端不接触模型密钥，也不保存聊天记录。

## 部署

1. 安装 Node.js 后，在 `worker` 目录运行：

```powershell
npm install
npx wrangler login
npm run deploy
```

也可以直接在 GitHub 仓库设置以下 Actions Secrets，然后运行 `Deploy chat proxy` 工作流：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

API Token 只需要 Workers Scripts 与 Workers AI 的相关权限。不要把这些值写进代码或发送到聊天中。

2. 当前部署地址：

```text
https://dry-bonus-fbc1.xiaoshabi328.workers.dev/
```

3. 在项目根目录的 `chat-config.js` 中使用这个地址：

```js
window.YINGXIN_CHAT_CONFIG = Object.freeze({
  endpoint: "https://dry-bonus-fbc1.xiaoshabi328.workers.dev/",
  modelLabel: "Qwen 云端模型",
  fallbackToLocal: true,
  maxHistoryMessages: 10
});
```

4. 提交并推送 `chat-config.js`，GitHub Pages 更新后即可使用。

## 免费额度与隐私

- 使用 Cloudflare Workers AI 时，免费额度和可用模型以 Cloudflare 账户当前条款为准。
- Worker 不写入数据库，也不主动记录聊天正文。
- 浏览器只发送最近 10 条对话到代理，代理再发送给 Workers AI 生成回复。
- 语音识别由浏览器提供，页面不保存录音。
- 代理限制来源域名、消息数量、单条长度和总长度，免费额度用尽时前端自动回退到本地回应。
