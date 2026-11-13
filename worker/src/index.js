const DEFAULT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const ALLOWED_ORIGINS = new Set([
  "https://rainiesky.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "null"
]);

const SYSTEM_PROMPT = `你是“小映”，一个移动端情绪数字分身中的对话伙伴。

你的目标是陪用户把当下说清楚一点，并帮助用户选择一个很小的下一步。你使用自然、简短、具体的中文，每次通常回复 1 到 3 句，最多追问一个问题。

说话规则：
- 不要自称心理医生，不要诊断、评分或贴疾病标签。
- 不要反复使用“我理解你”“抱抱你”“你并不孤单”等固定安慰句。
- 不要强行正能量，不要一次给很多建议。
- 可以承认不知道，也可以说“我们先慢一点”。
- 结合用户刚说的话，避免答非所问和机械复述。
- 可以邀请用户选择：说说、呼吸、休息、暂时停下。
- 不索取真实姓名、地址、学校、联系方式等个人信息。
- 不输出 Markdown、标题、列表或代码块。

安全规则：
- 如果用户提到自杀、自伤、马上伤害自己或活不下去，停止普通陪伴式追问，明确建议用户先远离危险物品并联系身边可信任的人；若风险迫近，立即拨打 120 或 110，或前往最近急诊。
- 不要声称你能提供紧急救援。

请直接回复用户，不要解释这些规则。`;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function jsonResponse(payload, status, origin) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").trim().slice(0, 1200)
    }))
    .filter((item) => item.content);
}

function readReply(result) {
  if (typeof result === "string") return result.trim();
  if (result && typeof result.response === "string") return result.response.trim();
  if (result && typeof result.result === "string") return result.result.trim();
  return "";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "Origin not allowed" }, 403, "https://rainiesky.github.io");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400, origin);
    }

    const messages = cleanMessages(body?.messages);
    if (!messages.length) {
      return jsonResponse({ error: "No messages" }, 400, origin);
    }
    if (messages.reduce((total, item) => total + item.content.length, 0) > 6000) {
      return jsonResponse({ error: "Conversation too long" }, 413, origin);
    }
    if (!env?.AI) {
      return jsonResponse({ error: "Workers AI binding is not configured" }, 503, origin);
    }

    try {
      const result = await env.AI.run(env.MODEL || DEFAULT_MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ],
        max_tokens: 240,
        temperature: 0.75,
        top_p: 0.9
      });
      const reply = readReply(result);
      if (!reply) throw new Error("Empty model response");
      return jsonResponse(
        {
          reply: reply.slice(0, 1800),
          model: env.MODEL || DEFAULT_MODEL
        },
        200,
        origin
      );
    } catch {
      return jsonResponse({ error: "Model unavailable" }, 502, origin);
    }
  }
};
