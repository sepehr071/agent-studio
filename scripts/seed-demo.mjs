// Seed .data/studio.db with obviously fictional demo data (Acme, Alice, Bob)
// so the UI can be explored and screenshotted without any API key.
// Usage: start the app once (`npm run dev`, it runs the migrations), then
//   node scripts/seed-demo.mjs
// Re-running replaces the rows it created (ids prefixed with "demo-").
import path from "node:path";
import Database from "better-sqlite3";

const db = new Database(path.join(process.cwd(), ".data", "studio.db"));
const hasTables = db
  .prepare("select 1 from sqlite_master where name = 'conversations'")
  .get();
if (!hasTables) {
  console.error("No schema yet: run `npm run dev` once, then re-run this script.");
  process.exit(1);
}

const MODEL = "anthropic/claude-sonnet-4.6";
const now = Date.now();
const min = 60_000;
const day = 24 * 60 * min;
const json = (v) => JSON.stringify(v);

const clear = db.transaction(() => {
  for (const table of [
    "messages",
    "conversations",
    "configs",
    "mcp_servers",
    "knowledge_items",
    "knowledge_folders",
    "projects",
    "usage_logs",
  ]) {
    const col = table === "messages" ? "conversation_id" : "id";
    db.prepare(`delete from ${table} where ${col} like 'demo-%'`).run();
  }
});
clear();

// ------------------------------------------------------------------ MCP servers
const insertMcp = db.prepare(
  `insert into mcp_servers (id, name, transport, url, headers, command, args, env, is_enabled, created_at, updated_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
insertMcp.run("demo-mcp-crm", "acme-crm", "http", "http://127.0.0.1:8808/mcp", json({ Authorization: "Bearer demo-token" }), null, null, null, 1, now - 9 * day, now - 2 * day);
insertMcp.run("demo-mcp-fs", "filesystem", "stdio", null, null, "npx", json(["-y", "@modelcontextprotocol/server-filesystem", "./workspace"]), json({}), 1, now - 20 * day, now - 20 * day);
insertMcp.run("demo-mcp-docs", "acme-docs", "sse", "http://127.0.0.1:8809/sse", null, null, null, null, 0, now - 4 * day, now - 4 * day);

// ------------------------------------------------------------------ assistants
const insertConfig = db.prepare(
  `insert into configs (id, name, avatar_emoji, system_prompt, model_id, params, tool_config, is_pinned, usage_count, created_at, updated_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
insertConfig.run("demo-cfg-analyst", "تحلیلگر فروش", "📊", "تو یک تحلیلگر فروش دقیق هستی. همیشه به داده‌های CRM و گنجینه دانش استناد کن.", MODEL, json({ temperature: 0.3 }), json({ enabledTools: ["knowledge_search"], mcpServerIds: ["demo-mcp-crm"] }), 1, 42, now - 12 * day, now - day);
insertConfig.run("demo-cfg-dev", "دستیار فرانت‌اند", "🧑‍💻", "کد HTML/CSS تمیز و مستقل بنویس تا در بوم پیش‌نمایش شود.", "openai/gpt-5.1", json({ temperature: 0.5 }), json({ enabledTools: [], mcpServerIds: ["demo-mcp-fs"] }), 1, 17, now - 8 * day, now - 3 * day);
insertConfig.run("demo-cfg-writer", "ویراستار فارسی", "✍️", "متن‌ها را روان و رسمی ویرایش کن.", "google/gemini-2.5-pro", json({ temperature: 0.7 }), json({ enabledTools: ["knowledge_search"] }), 0, 8, now - 30 * day, now - 6 * day);
insertConfig.run("demo-cfg-research", "پژوهشگر", "🔎", "با جستجوی وب پاسخ مستند و دارای منبع بده.", "anthropic/claude-sonnet-4.6", json({ reasoningEffort: "medium" }), json({ enabledTools: ["knowledge_search", "generate_image"], mcpServerIds: ["demo-mcp-docs"] }), 0, 5, now - 40 * day, now - 10 * day);

// ------------------------------------------------------------------ knowledge vault
const insertFolder = db.prepare(
  `insert into knowledge_folders (id, parent_id, name, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
);
insertFolder.run("demo-kf-sales", null, "فروش", 0, now - 20 * day, now - 20 * day);
insertFolder.run("demo-kf-eng", null, "مهندسی", 1, now - 20 * day, now - 20 * day);
const insertKnowledge = db.prepare(
  `insert into knowledge_items (id, folder_id, title, content, model_id, tags, is_favorite, created_at, updated_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
insertKnowledge.run("demo-k1", "demo-kf-sales", "گزارش فروش فصل سوم Acme", "درآمد فصل سوم شرکت فرضی Acme نسبت به فصل قبل رشد داشت. بیشترین سهم مربوط به محصول «Acme Cloud» بود و منطقه شمال ضعیف‌ترین عملکرد را داشت.", MODEL, json(["فروش", "گزارش"]), 1, now - 5 * day, now - 5 * day);
insertKnowledge.run("demo-k2", "demo-kf-sales", "یادداشت جلسه با Alice", "Alice پیشنهاد داد کمپین تخفیف پاییزه برای مشتریان منطقه شمال اجرا شود. Bob مسئول آماده‌سازی داشبورد پیگیری شد.", MODEL, json(["جلسه"]), 0, now - 3 * day, now - 3 * day);
insertKnowledge.run("demo-k3", "demo-kf-eng", "چک‌لیست انتشار نسخه", "۱. اجرای تست‌ها\n۲. بررسی مهاجرت‌های پایگاه داده\n۳. به‌روزرسانی تغییرات نسخه\n۴. اطلاع‌رسانی به تیم پشتیبانی", null, json(["مهندسی", "چک‌لیست"]), 1, now - 9 * day, now - 9 * day);
insertKnowledge.run("demo-k4", "demo-kf-eng", "الگوی خطایابی MCP", "اگر یک سرور MCP پاسخ ندهد، بقیه ابزارها همچنان در دسترس می‌مانند. خروجی ابزارهای خارجی پیش از رسیدن به مدل پاک‌سازی و کوتاه می‌شود.", MODEL, json(["MCP"]), 0, now - 2 * day, now - 2 * day);

// ------------------------------------------------------------------ projects
db.prepare(
  `insert into projects (id, name, description, color, emoji, is_pinned, is_archived, sort_order, created_at, updated_at)
   values (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
).run("demo-proj-acme", "کمپین پاییزه Acme", "برنامه‌ریزی و تحلیل کمپین فروش پاییز", "var(--chart-4)", "🍂", 1, 0, now - 15 * day, now - day);

// ------------------------------------------------------------------ conversations
const insertConv = db.prepare(
  `insert into conversations (id, title, model_id, project_id, config_id, tags, is_pinned, is_archived, message_count, input_tokens, output_tokens, total_tokens, last_message_at, created_at, updated_at)
   values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
);
const insertMsg = db.prepare(
  `insert into messages (id, conversation_id, role, parts, metadata, order_index, created_at) values (?, ?, ?, ?, ?, ?, ?)`,
);

function conversation({ id, title, model, projectId = null, configId = null, pinned = 0, at, messages }) {
  const sum = (key) => messages.reduce((acc, m) => acc + (m.metadata?.[key] ?? 0), 0);
  const input = sum("inputTokens");
  const output = sum("outputTokens");
  insertConv.run(id, title, model, projectId, configId, json([]), pinned, messages.length, input, output, input + output, at + messages.length * min, at, at + messages.length * min);
  messages.forEach((m, i) => {
    insertMsg.run(`${id}-m${i}`, id, m.role, json(m.parts), m.metadata ? json(m.metadata) : null, i, at + i * min);
  });
}

const user = (text) => ({ role: "user", parts: [{ type: "text", text }] });
const assistant = (parts, meta) => ({
  role: "assistant",
  parts,
  metadata: { modelId: MODEL, createdAt: now, ...meta },
});

conversation({
  id: "demo-conv-sales",
  title: "تحلیل فروش فصل سوم Acme",
  model: MODEL,
  projectId: "demo-proj-acme",
  configId: "demo-cfg-analyst",
  pinned: 1,
  at: now - 40 * min,
  messages: [
    user("وضعیت فروش فصل سوم Acme چطور بود؟ منطقه شمال را با CRM مقایسه کن و یک اقدام پیشنهادی بده."),
    assistant(
      [
        { type: "step-start" },
        { type: "reasoning", text: "اول گزارش فصل سوم را در گنجینه دانش پیدا می‌کنم، سپس عدد منطقه شمال را از CRM می‌گیرم و مقایسه می‌کنم.", state: "done" },
        {
          type: "tool-knowledge_search",
          toolCallId: "demo-call-1",
          state: "output-available",
          input: { query: "فروش فصل سوم Acme", limit: 3 },
          output: [
            { id: "demo-k1", title: "گزارش فروش فصل سوم Acme", snippet: "درآمد فصل سوم نسبت به فصل قبل رشد داشت… منطقه شمال ضعیف‌ترین عملکرد را داشت." },
            { id: "demo-k2", title: "یادداشت جلسه با Alice", snippet: "Alice پیشنهاد داد کمپین تخفیف پاییزه برای مشتریان منطقه شمال اجرا شود…" },
          ],
        },
        { type: "step-start" },
        {
          type: "dynamic-tool",
          toolName: "acme-crm__get_region_pipeline",
          toolCallId: "demo-call-2",
          state: "output-available",
          input: { region: "north", quarter: "Q3" },
          output: { region: "north", openDeals: 14, wonDeals: 3, topAccount: "Acme Retail (demo)", owner: "Bob" },
        },
        { type: "step-start" },
        {
          type: "text",
          text: "## خلاصه\n\nبر اساس **گزارش فصل سوم** و داده‌های CRM:\n\n| شاخص | منطقه شمال |\n|---|---|\n| معاملات باز | ۱۴ |\n| معاملات موفق | ۳ |\n| مسئول | Bob |\n\nمنطقه شمال با وجود ۱۴ معامله باز، نرخ تبدیل پایینی دارد.\n\n### اقدام پیشنهادی\n1. اجرای کمپین تخفیف پاییزه که Alice پیشنهاد داده بود، فقط برای معاملات باز شمال.\n2. داشبورد پیگیری هفتگی توسط Bob.\n3. بازبینی نتیجه در پایان ماه.",
        },
      ],
      { inputTokens: 2840, outputTokens: 612, totalTokens: 3452, costUsd: 0.0177 },
    ),
  ],
});

conversation({
  id: "demo-conv-canvas",
  title: "کارت قیمت‌گذاری با HTML",
  model: "openai/gpt-5.1",
  configId: "demo-cfg-dev",
  at: now - 3 * 60 * min,
  messages: [
    user("یک کارت قیمت‌گذاری ساده و راست‌چین با HTML و CSS بساز که در بوم پیش‌نمایش شود."),
    assistant(
      [
        { type: "step-start" },
        {
          type: "text",
          text: "این یک کارت قیمت‌گذاری مستقل است؛ برای پیش‌نمایش «باز کردن در بوم» را بزنید.\n\n```html\n<!doctype html>\n<html dir=\"rtl\" lang=\"fa\">\n<head>\n<meta charset=\"utf-8\" />\n<style>\n  body { margin:0; min-height:100vh; display:grid; place-items:center; font-family: Tahoma, sans-serif; background: linear-gradient(135deg,#e0f2fe,#ede9fe); }\n  .card { width: 280px; padding: 28px; border-radius: 20px; background: #fff; box-shadow: 0 20px 50px -20px #0f172a55; }\n  h2 { margin: 0 0 4px; color:#0f172a; }\n  .price { font-size: 40px; font-weight: 800; color:#0284c7; margin: 12px 0; }\n  ul { padding: 0 18px; color:#334155; line-height: 2; }\n  button { width:100%; padding: 12px; border: 0; border-radius: 12px; background:#0284c7; color:#fff; font-size: 16px; }\n</style>\n</head>\n<body>\n  <div class=\"card\">\n    <h2>پلن تیمی Acme</h2>\n    <div>برای تیم‌های کوچک</div>\n    <div class=\"price\">۴۹ دلار</div>\n    <ul><li>۱۰ کاربر</li><li>گنجینه دانش مشترک</li><li>اتصال MCP</li></ul>\n    <button>شروع آزمایشی</button>\n  </div>\n</body>\n</html>\n```",
        },
      ],
      { modelId: "openai/gpt-5.1", inputTokens: 410, outputTokens: 520, totalTokens: 930, costUsd: 0.0057 },
    ),
  ],
});

conversation({
  id: "demo-conv-release",
  title: "چک‌لیست انتشار نسخه ۲.۱",
  model: MODEL,
  at: now - 2 * day,
  messages: [
    user("چک‌لیست انتشار را از گنجینه بیاور."),
    assistant(
      [
        { type: "tool-knowledge_search", toolCallId: "demo-call-3", state: "output-available", input: { query: "چک‌لیست انتشار" }, output: [{ id: "demo-k3", title: "چک‌لیست انتشار نسخه", snippet: "۱. اجرای تست‌ها ۲. بررسی مهاجرت‌ها…" }] },
        { type: "text", text: "چهار گام: اجرای تست‌ها، بررسی مهاجرت‌ها، به‌روزرسانی تغییرات نسخه و اطلاع به پشتیبانی." },
      ],
      { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
    ),
  ],
});
conversation({ id: "demo-conv-email", title: "پیش‌نویس ایمیل به Alice", model: "google/gemini-2.5-pro", configId: "demo-cfg-writer", at: now - 4 * day, messages: [user("یک ایمیل کوتاه تشکر برای Alice بنویس."), assistant([{ type: "text", text: "Alice عزیز،\n\nاز پیشنهاد ارزشمندتان درباره کمپین پاییزه سپاسگزارم." }], { modelId: "google/gemini-2.5-pro", inputTokens: 300, outputTokens: 80, totalTokens: 380 })] });

// ------------------------------------------------------------------ usage logs (synthetic)
const insertUsage = db.prepare(
  `insert into usage_logs (id, model, provider, feature, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at)
   values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const models = [MODEL, "openai/gpt-5.1", "google/gemini-2.5-pro"];
const features = ["chat", "chat", "chat", "title", "enhancer", "image"];
let n = 0;
for (let d = 13; d >= 0; d--) {
  const perDay = 3 + ((d * 7) % 5);
  for (let k = 0; k < perDay; k++) {
    const model = models[(d + k) % models.length];
    const feature = features[(d * 3 + k) % features.length];
    const prompt = 400 + ((d * 131 + k * 97) % 2600);
    const completion = 120 + ((d * 61 + k * 43) % 900);
    insertUsage.run(`demo-u${n++}`, model, model.split("/")[0], feature, prompt, completion, prompt + completion, (prompt * 3 + completion * 15) / 1_000_000, now - d * day - k * 37 * min);
  }
}

console.log("Seeded demo data into .data/studio.db");
