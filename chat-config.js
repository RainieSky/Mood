window.YINGXIN_CHAT_CONFIG = Object.freeze({
  // 部署 Cloudflare Worker 后，把地址填写在这里，例如：
  // endpoint: "https://yingxin-chat-proxy.<your-subdomain>.workers.dev/v1/chat"
  endpoint: "",
  modelLabel: "Qwen 云端模型",
  fallbackToLocal: true,
  maxHistoryMessages: 10
});
