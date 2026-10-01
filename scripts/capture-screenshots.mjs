// Capture README screenshots from a running dev server seeded with demo data.
//   npm run dev -- -H 127.0.0.1 -p 4270   &&   node scripts/seed-demo.mjs
//   BASE=http://127.0.0.1:4270 node scripts/capture-screenshots.mjs [outDir]
// Needs Playwright (not a project dependency): `npm i --no-save playwright`,
// or run with NODE_PATH pointing at a folder that has it installed.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://127.0.0.1:4270";
const OUT = process.argv[2] ?? "docs/images";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shot(name, url, { theme = "dark", width = 1440, height = 900, before, crop } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  // The theme bootstrap reads localStorage first, so pin it explicitly.
  await ctx.addInitScript((t) => localStorage.setItem("studio-theme", t), theme);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (before) await before(page);
  // crop: locator for one element; the shot is clipped to it plus a margin
  let clip;
  if (crop) {
    const box = await crop(page).boundingBox();
    const pad = 24;
    clip = { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad };
  }
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
  console.log("saved", name);
  await ctx.close();
}

// Hide the floating "scroll to bottom" arrow so it does not cover the answer
const hideScrollButton = (page) =>
  page.addStyleTag({ content: "button:has(> svg.lucide-arrow-down) { display: none !important; }" });

// Wheel-scroll the pane under the pointer (the body itself never scrolls)
const wheel = async (page, dy, x = 700, y = 450) => {
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(800);
};

// Start of the agent turn: user prompt, reasoning, tool cards, answer
const toTop = (page) => wheel(page, -20_000);

const openMcpCard = async (page) => {
  await page.getByText("acme-crm__get_region_pipeline").first().click();
  await page.waitForTimeout(600);
  await page.getByText("acme-crm__get_region_pipeline").first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(600);
  await hideScrollButton(page);
};

// Tall enough to fit the whole turn, prompt through the last answer section
await shot("chat-agent-turn", "/chat/demo-conv-sales", {
  height: 1150,
  before: async (page) => {
    await toTop(page);
    await hideScrollButton(page);
  },
});
await shot("mcp-tool-call", "/chat/demo-conv-sales", { theme: "light", before: openMcpCard });
await shot("canvas-preview", "/chat/demo-conv-canvas", {
  before: async (page) => {
    await page.getByRole("button", { name: "باز کردن در بوم" }).click();
    await page.waitForTimeout(2000);
  },
});
await shot("mcp-servers", "/settings", {
  before: async (page) => {
    await wheel(page, 20_000);
  },
  crop: (page) => page.locator("section", { hasText: "سرورهای MCP" }).last(),
});
await shot("assistants", "/assistants", { theme: "light" });
await shot("usage", "/usage", { height: 990 });
await shot("mobile-chat", "/chat/demo-conv-sales", {
  width: 390,
  height: 844,
  before: async (page) => {
    await wheel(page, -20_000, 200, 400);
    await hideScrollButton(page);
  },
});

// README hero: a title panel framing the chat screenshot captured above
const chatPng = fs.readFileSync(path.join(OUT, "chat-agent-turn.png")).toString("base64");
const heroCtx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const hero = await heroCtx.newPage();
await hero.setContent(`<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:1600px;height:900px;overflow:hidden}
  body{font-family:"Segoe UI",system-ui,sans-serif;color:#eef3fa;box-sizing:border-box;
    background:radial-gradient(800px 500px at 90% 10%,hsla(205,95%,55%,.28),transparent 60%),
      radial-gradient(700px 500px at 5% 95%,hsla(265,80%,62%,.22),transparent 60%),hsl(222 18% 7%);
    display:grid;grid-template-columns:440px 1fr;align-items:center;gap:40px;padding:0 56px 0 64px}
  h1{font-size:60px;line-height:1.02;margin:0 0 20px;letter-spacing:-1.5px}
  p{font-size:20px;line-height:1.5;color:#b7c3d4;margin:0 0 28px}
  .chips{display:flex;flex-wrap:wrap;gap:10px}
  .chips span{font-size:15px;padding:7px 13px;border-radius:999px;border:1px solid hsla(210,30%,80%,.18);background:hsla(222,16%,16%,.7);color:#d6e0ee}
  img{max-width:100%;max-height:800px;justify-self:center;display:block;border-radius:14px;border:1px solid hsla(210,30%,80%,.16);box-shadow:0 40px 90px -30px #000c}
  .note{position:absolute;left:64px;bottom:32px;font-size:13px;color:#7d8aa0}
</style><div><h1>Agent Studio</h1>
<p>A local, Persian-first AI workbench: tool-calling agents, MCP servers, a knowledge vault and a live HTML canvas, built on the Vercel AI SDK.</p>
<div class="chips"><span>Next.js 16</span><span>AI SDK v6</span><span>MCP</span><span>SQLite + Drizzle</span><span>RTL</span></div></div>
<img src="data:image/png;base64,${chatPng}"><div class="note">Real app screenshot, demo data</div>`);
await hero.screenshot({ path: path.join(OUT, "hero.png") });
console.log("saved hero");
await heroCtx.close();

await browser.close();
