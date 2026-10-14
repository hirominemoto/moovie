// もーバー: claude.ai のチャット画面の上に、うしと月のトークンバーを出す
//
// うし（このチャット）: claude.ai が画面に会話を出すときに読む会話データから数えたトークンの推定。
//                       読めないときは画面の文字から数える。上限は設定で選ぶ
// 月（使用上限）:       claude.ai の設定画面「使用量」と同じ 5時間枠・週の使用率。多く使っているほうで満ち欠けする
//
// どちらも公式に用意された読み方ではないので、読めないときは画面の文字に切り替えるか「—」にする
(() => {
  if (window.__mooBar) return;
  window.__mooBar = true;

  const STORE = "moo-bar:";
  const load = (name, fallback) => {
    try {
      const value = localStorage.getItem(STORE + name);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const save = (name, value) => {
    try {
      localStorage.setItem(STORE + name, JSON.stringify(value));
    } catch {
      // 保存できなくてもバーはそのまま動く
    }
  };

  const settings = { limit: 200_000, extra: 0, showLimits: true, countProject: true, ...load("settings", {}) };

  const COW_SVG = `
<svg class="cow" viewBox="0 0 48 46" aria-hidden="true">
  <g stroke="#2b2840" stroke-width="1.8" stroke-linejoin="round">
    <path d="M15 11C12 9 10 5 11 2c3 1 6 4 7 7z" fill="#f6e7bf"/>
    <path d="M33 11c3-2 5-6 4-9-3 1-6 4-7 7z" fill="#f6e7bf"/>
    <ellipse cx="8" cy="18" rx="6.5" ry="3.6" transform="rotate(-18 8 18)" fill="#fff"/>
    <ellipse cx="40" cy="18" rx="6.5" ry="3.6" transform="rotate(18 40 18)" fill="#fff"/>
    <path d="M24 7c9 0 14 6 14 14v6c0 9-6 15-14 15s-14-6-14-15v-6c0-8 5-14 14-14z" fill="#fff"/>
  </g>
  <ellipse cx="8.6" cy="18.2" rx="3.4" ry="1.6" transform="rotate(-18 8.6 18.2)" fill="#ffb3c4"/>
  <ellipse cx="39.4" cy="18.2" rx="3.4" ry="1.6" transform="rotate(18 39.4 18.2)" fill="#ffb3c4"/>
  <path d="M14.5 14c1.5-4.5 7.5-5 9-1.5s-2.5 7-6 6.5c-3-.5-4-2.5-3-5z" fill="#2b2840"/>
  <path d="M33 22.5c2-1 4.2.6 3.4 2.8-.7 1.8-3.6 1.9-4.2.3-.3-1.1-.1-2.4.8-3.1z" fill="#2b2840"/>
  <g class="eyes-o" fill="#2b2840">
    <circle cx="19" cy="24" r="2.2"/><circle cx="29" cy="24" r="2.2"/>
    <circle cx="19.8" cy="23.2" r=".7" fill="#fff"/><circle cx="29.8" cy="23.2" r=".7" fill="#fff"/>
  </g>
  <path class="eyes-x" d="M17 22l4 4m0-4l-4 4m10-4l4 4m0-4l-4 4" stroke="#2b2840" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <ellipse cx="14.6" cy="29" rx="2.2" ry="1.3" fill="#ffb3c4"/>
  <ellipse cx="33.4" cy="29" rx="2.2" ry="1.3" fill="#ffb3c4"/>
  <ellipse cx="24" cy="35" rx="10.5" ry="6.4" fill="#ffc7d3" stroke="#2b2840" stroke-width="1.8"/>
  <ellipse cx="20.6" cy="35" rx="1.3" ry="1.9" fill="#2b2840" opacity=".75"/>
  <ellipse cx="27.4" cy="35" rx="1.3" ry="1.9" fill="#2b2840" opacity=".75"/>
  <path class="sweat" d="M42 6s3.5 4 3.5 6.3a3.5 3.5 0 0 1-7 0C38.5 10 42 6 42 6z" fill="#8fd0ff" stroke="#2b2840" stroke-width="1.2"/>
</svg>`;

  const GEAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
  const MINUS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }

.bar {
  --bg: rgba(255, 255, 255, .94);
  --solid: #ffffff;
  --ink: #2a2733;
  --muted: #676476;
  --line: rgba(40, 35, 60, .14);
  --track: #e4eae0;
  --warn: #b0480f;
  --calm: #46b26e;
  --half: #f0bb33;
  --near: #f58a43;
  --full: #ff6b6b;
  --moon: #ffd96b;
  --moon-shade: #464b8e;
  position: fixed;
  top: 60px;
  left: 50%;
  z-index: 2147483000;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 5px 0 4px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink);
  box-shadow: 0 6px 20px rgba(20, 16, 40, .12);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  font: 500 12px/1 system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  user-select: none;
  transform: translateX(-50%);
  color-scheme: light;
}
.bar.dark {
  --bg: rgba(40, 40, 46, .94);
  --solid: #2c2c33;
  --ink: #f1eff7;
  --muted: #aca8ba;
  --line: rgba(255, 255, 255, .15);
  --track: #3b3e54;
  --warn: #ffb07a;
  color-scheme: dark;
}
.bar.placed { transform: none; }

.grip {
  flex: none;
  width: 10px;
  height: 22px;
  margin-left: 4px;
  border-radius: 4px;
  background: radial-gradient(circle, var(--muted) 1px, transparent 1.5px) 0 0 / 5px 5.5px;
  opacity: .7;
  cursor: grab;
  touch-action: none;
}
.grip:active { cursor: grabbing; }

.full { display: flex; align-items: center; gap: 10px; }
.seg { display: flex; align-items: center; gap: 7px; }
.lbl { font-size: 11px; color: var(--muted); }
.pct { min-width: 2.7em; text-align: right; }
.pct b { font-size: 14px; font-weight: 700; }
.pct small { margin-left: 1px; font-size: 10px; font-weight: 600; color: var(--muted); }
.nodata small { display: none; }
.sub { font-size: 11px; color: var(--muted); }
.sep { width: 1px; height: 18px; background: var(--line); }

.chat { --st: var(--calm); }
.chat[data-level="half"] { --st: var(--half); }
.chat[data-level="near"] { --st: var(--near); }
.chat[data-level="full"] { --st: var(--full); }
.track { --r: 22px; position: relative; width: 120px; height: 8px; border-radius: 999px; background: var(--track); }
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--p, 0) * 100%);
  border-radius: inherit;
  background:
    radial-gradient(6px 3.2px at 9px 3px, rgba(29, 27, 44, .2) 95%, transparent),
    radial-gradient(4px 2.6px at 24px 5.5px, rgba(29, 27, 44, .16) 95%, transparent),
    var(--st);
  background-size: 32px 8px, 32px 8px, auto;
  transition: width .6s cubic-bezier(.22, 1, .36, 1), background-color .4s;
}
.rider {
  position: absolute;
  top: 50%;
  left: calc(var(--p, 0) * (100% - var(--r)));
  width: var(--r);
  height: var(--r);
  margin-top: calc(var(--r) / -2);
  cursor: pointer;
  transition: left .6s cubic-bezier(.22, 1, .36, 1);
}
.cow { display: block; width: 100%; height: 100%; overflow: visible; transform-origin: 50% 90%; }
.cow .eyes-x, .cow .sweat { display: none; }
[data-level="near"] .cow .sweat, [data-level="full"] .cow .sweat { display: inline; }
[data-level="full"] .cow .eyes-o { display: none; }
[data-level="full"] .cow .eyes-x { display: inline; }

.moonicon {
  flex: none;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(255, 217, 107, .85);
  border-radius: 50%;
  background: var(--moon-shade);
  box-shadow:
    inset calc(var(--p, 0) * -16px) 0 0 0 var(--moon),
    0 0 calc(2px + var(--p, 0) * 8px) rgba(255, 217, 107, calc(.25 + var(--p, 0) * .5));
  cursor: pointer;
  transition: box-shadow .6s;
}
.win { display: flex; align-items: center; gap: 4px; }
.win[hidden] { display: none; }
.win .pct { min-width: 2.2em; }
.win[data-warn] .pct b { color: var(--warn); }
.limits.off .pct b { color: var(--muted); font-weight: 500; }

.btn {
  all: unset;
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--muted);
  cursor: pointer;
}
.btn:hover { background: var(--line); color: var(--ink); }
.btn:focus-visible, .mini:focus-visible { outline: 2px solid var(--calm); outline-offset: 1px; }
.btn svg { width: 14px; height: 14px; }

.mini { all: unset; display: none; align-items: center; gap: 6px; padding: 0 6px 0 2px; cursor: pointer; }
.mini .chat { display: flex; }
.mini .cow { width: 20px; height: 20px; }
.mini .moonicon { width: 15px; height: 15px; box-shadow: inset calc(var(--p, 0) * -13px) 0 0 0 var(--moon); }
.mini b { font-size: 13px; font-weight: 700; }
.bar.min .full { display: none; }
.bar.min .mini { display: flex; }

.bubble {
  position: absolute;
  top: calc(100% + 8px);
  left: var(--bubble-x, 40px);
  padding: 5px 10px;
  border-radius: 10px;
  background: var(--ink);
  color: var(--solid);
  font-size: 12px;
  font-weight: 700;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity .2s, transform .25s;
}
.bubble::before {
  content: "";
  position: absolute;
  bottom: 100%;
  left: 14px;
  border: 5px solid transparent;
  border-bottom-color: var(--ink);
}
.bar.saying .bubble { opacity: 1; transform: none; }

.panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  gap: 12px;
  width: 300px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--solid);
  color: var(--ink);
  box-shadow: 0 10px 30px rgba(20, 16, 40, .18);
  white-space: normal;
  user-select: text;
}
.panel[hidden] { display: none; }
.panel h2, .panel h3 { margin: 0; font-size: 13px; font-weight: 700; }
.panel label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; line-height: 1.4; }
.panel select, .panel input[type="number"] {
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-weight: 500;
}
.panel label.check { display: flex; align-items: center; gap: 8px; }
.panel p { margin: 0; font-size: 11px; line-height: 1.65; color: var(--muted); }
.diag { display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--line); }
.diag dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 0; font-size: 11px; line-height: 1.5; }
.diag dt { color: var(--muted); }
.diag dd { margin: 0; overflow-wrap: anywhere; }
.panel .close {
  all: unset;
  justify-self: end;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--ink);
  color: var(--solid);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

@keyframes waddle {
  0%, 100% { transform: rotate(0); }
  25% { transform: translateY(-2px) rotate(-9deg); }
  75% { transform: translateY(-2px) rotate(9deg); }
}
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px) rotate(-8deg); }
  70% { transform: translateY(0); }
  85% { transform: translateY(-3px); }
}
@keyframes worry {
  0%, 84%, 100% { transform: rotate(0); }
  89% { transform: rotate(-7deg); }
  95% { transform: rotate(7deg); }
}
[data-level="full"] .cow { animation: worry 2.8s ease-in-out infinite; }
.walking .rider .cow { animation: waddle .32s ease-in-out 3; }
.hop .rider .cow { animation: hop .75s cubic-bezier(.3, .7, .4, 1); }

@media (max-width: 760px) {
  .sub { display: none; }
  .track { width: 80px; }
}
@media (prefers-reduced-motion: reduce) {
  .fill, .rider, .moonicon, .bubble { transition: none; }
  .cow { animation: none !important; }
}
`;

  const STEPS = [[0.95, "full"], [0.8, "near"], [0.5, "half"], [0, "calm"]];
  const RANK = { calm: 0, half: 1, near: 2, full: 3 };
  const levelOf = (ratio) => STEPS.find(([min]) => ratio >= min)[1];
  const CHAT_WORDS = { calm: "もーまんたい", half: "はんぶん こえた", near: "もーすぐ いっぱい", full: "もー げんかい" };
  const CHAT_UP = { half: "まだまだ 歩けるモ〜", near: "そろそろ 新しいチャットかモ", full: "もー 歩けない…！" };
  const LIMIT_UP = { half: "使用上限の半分をこえたよ", near: "そろそろ 使いすぎかも", full: "満月！ もうすぐ上限" };

  // 画像やPDFなどのファイルは中身の文字が取れないので、1つこのくらいとして数える
  const FILE_TOKENS = 1500;

  const digits = (n) => Math.round(n).toLocaleString("ja-JP");
  function man(n) {
    n = Math.round(n);
    if (n < 10_000) return digits(n);
    const x = n / 10_000;
    return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10) + "万";
  }
  function percent(ratio) {
    const p = ratio * 100;
    if (p <= 0) return "0";
    if (p < 10) return Math.max(0.1, Math.floor(p * 10) / 10).toFixed(1);
    return String(Math.floor(p));
  }
  const when = (iso) => {
    const date = iso ? new Date(iso) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const errorText = (error) => error?.message || String(error);

  // 日本語は1文字1トークン強、英語などは3〜4文字で1トークンくらい
  function estimateTokens(text) {
    let wide = 0;
    let narrow = 0;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (c <= 0x20 || c === 0xa0 || c === 0x3000) continue;
      if ((c >= 0x2e80 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) wide++;
      else narrow++;
    }
    return Math.round(wide * 1.2 + narrow / 3.3);
  }

  const chatIdOf = (path) => path.match(/\/chat\/([^/?#]+)/)?.[1] ?? null;

  // ---- 画面の文字から数える（会話データが読めないときの予備） ----
  const MESSAGES = '[data-testid="user-message"], .font-claude-message, .font-claude-response, [data-is-streaming]';
  const NOT_CONVERSATION = 'nav, aside, header, footer, form, button, textarea, [contenteditable="true"], script, style, noscript, svg';

  function screenMessages() {
    return [...document.querySelectorAll(MESSAGES)].filter((el) => !el.parentElement?.closest(MESSAGES));
  }

  function screenText() {
    const found = screenMessages();
    if (found.length) return found.map((el) => el.textContent).join("\n");
    const scope = document.querySelector("main") ?? document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest(NOT_CONVERSATION) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let text = "";
    for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.data;
    return text;
  }

  // ---- claude.ai の中の情報を読む ----
  let orgId = null;

  function orgFromCookie() {
    const match = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function getJson(path, params) {
    const url = new URL(path, location.origin);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const res = await fetch(url, { credentials: "include", headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function ensureOrg() {
    orgId = orgFromCookie() ?? orgId;
    if (!orgId) {
      const list = await getJson("/api/organizations");
      orgId = Array.isArray(list) ? (list.find((org) => org?.uuid)?.uuid ?? null) : null;
    }
    if (!orgId) throw new Error("組織が見つかりません");
    return encodeURIComponent(orgId);
  }

  // 編集や再生成で枝分かれした会話は、いま表示している枝だけをたどる
  function currentBranch(data) {
    const all = data.chat_messages;
    const leaf = data.current_leaf_message_uuid;
    if (!leaf || !all.every((m) => m?.uuid)) return all;
    const byId = new Map(all.map((m) => [m.uuid, m]));
    const path = [];
    for (let m = byId.get(leaf); m && path.length < all.length; m = byId.get(m.parent_message_uuid)) path.push(m);
    return path.length ? path.reverse() : all;
  }

  const textOf = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(textOf).join("\n");
    if (value && typeof value === "object") return textOf(value.text ?? value.content ?? "");
    return "";
  };

  // 考えている途中の文章（thinking）は次の返事には持ち越されないので数えない
  function messageText(message) {
    const parts = [];
    if (Array.isArray(message.content) && message.content.length) {
      for (const block of message.content) {
        if (block?.type === "text") parts.push(block.text ?? "");
        else if (block?.type === "tool_use") parts.push(JSON.stringify(block.input ?? {}));
        else if (block?.type === "tool_result") parts.push(textOf(block.content));
      }
    } else if (typeof message.text === "string") {
      parts.push(message.text);
    }
    for (const attachment of message.attachments ?? []) parts.push(attachment?.extracted_content ?? "");
    return parts.join("\n");
  }

  const projectDocs = new Map();

  async function projectTokens(org, projectId) {
    const cached = projectDocs.get(projectId);
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached;
    let entry;
    try {
      const docs = await getJson(`/api/organizations/${org}/projects/${encodeURIComponent(projectId)}/docs`);
      const list = Array.isArray(docs) ? docs : [];
      entry = { at: Date.now(), count: list.length, tokens: estimateTokens(list.map((doc) => doc?.content ?? "").join("\n")), error: null };
    } catch (error) {
      entry = { at: Date.now(), count: 0, tokens: 0, error: errorText(error) };
    }
    projectDocs.set(projectId, entry);
    return entry;
  }

  let convo = { id: null, at: 0, busy: false, parts: null, error: null, messages: 0 };
  let changedSinceFetch = false;

  async function fetchConversation(id) {
    if (convo.busy) return;
    const startedAt = Date.now();
    const before = convo;
    convo = { ...convo, busy: true };
    changedSinceFetch = false;
    let next;
    try {
      const org = await ensureOrg();
      const data = await getJson(`/api/organizations/${org}/chat_conversations/${encodeURIComponent(id)}`, {
        tree: "True",
        rendering_mode: "messages",
        render_all_tools: "true",
      });
      if (!Array.isArray(data?.chat_messages)) throw new Error("会話が入っていません");
      const messages = currentBranch(data);
      const fileCount = (m) => [m.files_v2, m.files].find(Array.isArray)?.length ?? 0;
      const files = messages.reduce((n, m) => n + fileCount(m), 0);
      const parts = {
        messages: messages.length,
        text: estimateTokens(messages.map(messageText).join("\n")),
        files,
        fileTokens: files * FILE_TOKENS,
        project: null,
      };
      const projectId = data.project_uuid ?? data.project?.uuid;
      if (projectId && settings.countProject) parts.project = await projectTokens(org, projectId);
      next = { id, at: startedAt, parts, error: null, messages: messages.length };
    } catch (error) {
      next = { id, at: startedAt, parts: null, error: errorText(error), messages: 0 };
    }
    convo = { ...next, busy: false };
    if (before.id === id && convo.messages > before.messages) refreshLimits();
    updateChat();
  }

  // ---- 画面 ----
  const host = document.createElement("moo-bar");
  const root = host.attachShadow({ mode: "open" });
  if ("adoptedStyleSheets" in root && typeof CSSStyleSheet === "function" && "replaceSync" in CSSStyleSheet.prototype) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } else {
    const style = document.createElement("style");
    style.textContent = CSS;
    root.append(style);
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = `
<div class="bar" role="region" aria-label="トークンの使用量">
  <div class="grip" title="ドラッグで動かせます（ダブルクリックで真ん中にもどる）"></div>
  <div class="full">
    <div class="seg chat" data-level="calm">
      <span class="lbl">このチャット</span>
      <div class="track" role="meter" aria-label="このチャットのトークン（推定）" aria-valuemin="0" aria-valuemax="100">
        <div class="fill"></div>
        <div class="rider">${COW_SVG}</div>
      </div>
      <span class="pct"><b class="chat-pct">0</b><small>%</small></span>
      <span class="sub chat-sub"></span>
    </div>
    <div class="sep"></div>
    <div class="seg limits off" data-level="calm">
      <span class="moonicon"></span>
      <span class="win five"><span class="lbl five-lbl">使用上限</span><span class="pct nodata"><b class="five-pct">—</b><small>%</small></span></span>
      <span class="win week" hidden><span class="lbl">週</span><span class="pct"><b class="week-pct">—</b><small>%</small></span></span>
    </div>
    <button class="btn gear" type="button" title="設定" aria-label="設定">${GEAR_SVG}</button>
    <button class="btn shrink" type="button" title="小さくする" aria-label="小さくする">${MINUS_SVG}</button>
  </div>
  <button class="mini" type="button" title="ひらく" aria-label="バーをひらく">
    <span class="chat" data-level="calm">${COW_SVG}</span><span class="pct"><b class="mini-chat">0</b><small>%</small></span>
    <span class="moonicon"></span><span class="pct nodata mini-limit-wrap"><b class="mini-limit">—</b><small>%</small></span>
  </button>
  <span class="bubble"></span>
  <div class="panel" hidden>
    <h2>もーバーの設定</h2>
    <label>このチャットの上限
      <select class="opt-limit">
        <option value="200000">20万トークン</option>
        <option value="500000">50万トークン</option>
        <option value="1000000">100万トークン</option>
      </select>
    </label>
    <label>上乗せするトークン
      <input class="opt-extra" type="number" min="0" step="1000" inputmode="numeric">
    </label>
    <label class="check"><input class="opt-project" type="checkbox"> プロジェクトの資料も数える</label>
    <label class="check"><input class="opt-limits" type="checkbox"> 使用上限（5時間・週）を表示する</label>
    <p>うしの数字は、claude.ai の会話データの文字から数えた推定です。読めないときは画面に出ている文字で数えます。システムの指示は入っていません。上限はプランやモデルで変わります。</p>
    <p>月は、5時間枠と週のうち多く使っているほうで満ち欠けします。数字は claude.ai の設定画面「使用量」と同じものです。どちらも公式の読み方ではないので、読めないときは「—」になります。</p>
    <div class="diag">
      <h3>しくみの状態</h3>
      <dl class="diag-list"></dl>
    </div>
    <button class="close" type="button">閉じる</button>
  </div>
</div>`;
  root.append(...wrap.childNodes);

  const $ = (selector) => root.querySelector(selector);
  const bar = $(".bar");
  const chatSeg = $(".full .chat");
  const miniChat = $(".mini .chat");
  const limitSeg = $(".limits");
  const panel = $(".panel");
  const bubble = $(".bubble");
  const timers = {};

  function attach() {
    if (!host.isConnected) document.documentElement.append(host);
  }

  function say(text, anchor) {
    const barBox = bar.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    bar.style.setProperty("--bubble-x", `${Math.max(0, box.left - barBox.left - 6)}px`);
    bubble.textContent = text;
    clearTimeout(timers.say);
    bar.classList.add("saying");
    timers.say = setTimeout(() => bar.classList.remove("saying"), 2200);
  }

  function play(name, ms) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(timers[name]);
    bar.classList.remove(name);
    void bar.offsetWidth; // アニメーションを頭から流しなおす
    bar.classList.add(name);
    timers[name] = setTimeout(() => bar.classList.remove(name), ms);
  }

  // ---- このチャット（うし） ----
  // 資料が多くて会話と合わせて上限に収まらないとき、claude.ai は資料の中から必要なところだけ探して読むので足さない
  function isDocsCounted(parts) {
    const docs = parts.project && !parts.project.error ? parts.project.tokens : 0;
    return docs > 0 && parts.text + parts.fileTokens + docs <= settings.limit;
  }
  const conversationTokens = (parts) => parts.text + parts.fileTokens + (isDocsCounted(parts) ? parts.project.tokens : 0);
  const docsNote = (parts) => (isDocsCounted(parts) ? "数えている" : "上限に収まらないので、必要なところだけ読まれるはず。数えていない");

  let chat = { id: undefined, tokens: 0, level: "calm", source: "none", screen: 0 };

  function updateChat() {
    const id = chatIdOf(location.pathname);
    let tokens = 0;
    let source = "none";
    let screen = 0;
    if (id) {
      screen = estimateTokens(screenText());
      if (convo.id === id && convo.parts) {
        tokens = conversationTokens(convo.parts);
        source = "api";
      } else if (screen > 0) {
        tokens = screen;
        source = "screen";
      }
      tokens += Number(settings.extra) || 0;
    }
    const ratio = tokens / settings.limit;
    const p = Math.min(1, Math.max(0, ratio));
    const level = levelOf(ratio);
    const sameChat = id === chat.id;

    if (sameChat && tokens > chat.tokens) play("walking", 1000);
    if (sameChat && RANK[level] > RANK[chat.level]) say(CHAT_UP[level], $(".rider"));
    chat = { id, tokens, level, source, screen };

    for (const seg of [chatSeg, miniChat]) {
      seg.dataset.level = level;
      seg.style.setProperty("--p", p.toFixed(4));
    }
    $(".chat-pct").textContent = percent(ratio);
    $(".mini-chat").textContent = percent(ratio);
    $(".chat-sub").textContent = `約${man(tokens)} / ${man(settings.limit)}`;
    const track = $(".track");
    track.setAttribute("aria-valuenow", String(Math.min(100, Math.floor(ratio * 100))));
    track.setAttribute("aria-valuetext", `${percent(ratio)}%（約${digits(tokens)} / ${digits(settings.limit)} トークン）`);

    const lines = [`このチャット：約${digits(tokens)} トークン（推定）/ 上限 ${digits(settings.limit)}`];
    const parts = source === "api" ? convo.parts : null;
    if (parts) {
      lines.push(`会話 ${parts.messages}件：約${man(parts.text)}`);
      if (parts.files) lines.push(`ファイル ${parts.files}個：約${man(parts.fileTokens)}`);
      if (parts.project?.count) lines.push(`プロジェクトの資料 ${parts.project.count}個：約${man(parts.project.tokens)}（${docsNote(parts)}）`);
    } else if (source === "screen") {
      lines.push("（画面に出ている文字から数えています）");
    }
    if (settings.extra) lines.push(`上乗せ：${digits(settings.extra)}`);
    lines.push(ratio >= 1 ? "もー はいらない" : CHAT_WORDS[level]);
    chatSeg.title = lines.join("\n");
    renderDiag();
  }

  // ---- 使用上限（月） ----
  let limits = { state: "off" };
  let lastLimitsFetch = 0;

  async function refreshLimits({ force = false } = {}) {
    if (!settings.showLimits) {
      limits = { state: "off" };
      renderLimits(null);
      return;
    }
    const now = Date.now();
    if (!force && now - lastLimitsFetch < 60_000) return;
    lastLimitsFetch = now;
    const before = limits;
    try {
      const org = await ensureOrg();
      const data = await getJson(`/api/organizations/${org}/usage`);
      const pick = (key) => {
        const slot = data?.[key];
        return slot && typeof slot.utilization === "number"
          ? { pct: Math.max(0, slot.utilization), resetsAt: slot.resets_at ?? null }
          : null;
      };
      const five = pick("five_hour");
      const week = pick("seven_day");
      if (!five && !week) throw new Error("使用量が入っていません");
      limits = { state: "ok", five, week };
    } catch (error) {
      limits = { state: "error", reason: errorText(error) };
    }
    renderLimits(before);
  }

  // 5時間枠と週のうち、多く使っているほう
  const busiest = (l) => (l?.state === "ok" ? [l.five, l.week].filter(Boolean).sort((a, b) => b.pct - a.pct)[0] : null);

  function renderLimits(before) {
    const top = busiest(limits);
    const ratio = top ? top.pct / 100 : 0;
    const level = levelOf(ratio);
    // 新月でも月だとわかるよう、細い三日月は残す
    const phase = top ? (0.15 + 0.85 * Math.min(1, ratio)).toFixed(4) : "0";

    limitSeg.classList.toggle("off", !top);
    limitSeg.dataset.level = level;
    for (const icon of root.querySelectorAll(".moonicon")) icon.style.setProperty("--p", phase);

    const five = limits.state === "ok" ? limits.five : null;
    const week = limits.state === "ok" ? limits.week : null;
    $(".five-lbl").textContent = five ? "5時間" : week ? "週" : "使用上限";
    const first = five ?? week;
    $(".five-pct").textContent = first ? String(Math.round(first.pct)) : "—";
    $(".five .pct").classList.toggle("nodata", !first);
    $(".five").toggleAttribute("data-warn", Boolean(first && first.pct >= 80));
    $(".week").hidden = !(five && week);
    $(".week-pct").textContent = week ? String(Math.round(week.pct)) : "—";
    $(".week").toggleAttribute("data-warn", Boolean(week && week.pct >= 80));
    $(".mini-limit").textContent = top ? String(Math.round(top.pct)) : "—";
    $(".mini-limit-wrap").classList.toggle("nodata", !top);

    if (limits.state === "ok") {
      const lines = [];
      if (five) lines.push(`5時間枠：${Math.round(five.pct)}%${when(five.resetsAt) ? `（${when(five.resetsAt)} にリセット）` : ""}`);
      if (week) lines.push(`1週間：${Math.round(week.pct)}%${when(week.resetsAt) ? `（${when(week.resetsAt)} にリセット）` : ""}`);
      lines.push("月は多く使っているほうで満ち欠けします");
      limitSeg.title = lines.join("\n");
      const prev = busiest(before);
      if (prev && RANK[level] > RANK[levelOf(prev.pct / 100)]) say(LIMIT_UP[level], $(".limits .moonicon"));
    } else if (limits.state === "error") {
      limitSeg.title = `使用上限を読めませんでした（${limits.reason}）。claude.ai の設定画面「使用量」で確かめてください。`;
    } else {
      limitSeg.title = "使用上限の表示はオフです（設定でオンにできます）";
    }
    renderDiag();
  }

  // ---- しくみの状態（うまく動かないときに見る欄） ----
  function renderDiag() {
    if (panel.hidden) return;
    const id = chatIdOf(location.pathname);
    const rows = [
      ["ページ", id ? "チャット" : "チャット以外"],
      ["数え方", { api: "会話データ", screen: "画面の文字", none: "数えていない" }[chat.source]],
    ];
    if (id) {
      if (convo.busy) rows.push(["会話データ", "読んでいるところ"]);
      else if (convo.id === id && convo.error) rows.push(["会話データ", `読めない（${convo.error}）`]);
      else if (convo.id === id && convo.parts) {
        const parts = convo.parts;
        rows.push(["会話データ", `${parts.messages}件 約${man(parts.text)}`]);
        if (parts.files) rows.push(["ファイル", `${parts.files}個 約${man(parts.fileTokens)}`]);
        if (parts.project) {
          rows.push(["資料", parts.project.error ? `読めない（${parts.project.error}）` : `${parts.project.count}個 約${man(parts.project.tokens)}（${docsNote(parts)}）`]);
        }
      } else rows.push(["会話データ", "まだ読んでいない"]);
      rows.push(["画面の文字", `吹き出し ${screenMessages().length}個 / 約${man(chat.screen)}`]);
    }
    rows.push([
      "使用上限",
      limits.state === "ok" ? "読めた" : limits.state === "error" ? `読めない（${limits.reason}）` : "オフ",
    ]);
    const list = $(".diag-list");
    list.replaceChildren(
      ...rows.flatMap(([label, value]) => {
        const dt = document.createElement("dt");
        const dd = document.createElement("dd");
        dt.textContent = label;
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }

  // ---- 操作 ----
  $(".rider").addEventListener("click", () => {
    say("モ〜", $(".rider"));
    play("hop", 800);
  });
  $(".limits .moonicon").addEventListener("click", () => {
    const icon = $(".limits .moonicon");
    const top = busiest(limits);
    if (!top) return say("使用上限は いま読めないみたい", icon);
    const reset = when(top.resetsAt);
    const name = top === limits.five ? "5時間枠" : "週";
    say(reset ? `${name}は ${reset} にリセット` : `${name}は ${Math.round(top.pct)}% つかったよ`, icon);
  });

  function setMinimized(isMin) {
    bar.classList.toggle("min", isMin);
    panel.hidden = true;
    save("min", isMin);
    requestAnimationFrame(clampIntoView);
  }
  $(".shrink").addEventListener("click", () => setMinimized(true));
  $(".mini").addEventListener("click", () => setMinimized(false));

  $(".gear").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    $(".opt-limit").value = String(settings.limit);
    $(".opt-extra").value = String(settings.extra || 0);
    $(".opt-project").checked = settings.countProject;
    $(".opt-limits").checked = settings.showLimits;
    renderDiag();
  });
  $(".close").addEventListener("click", () => {
    panel.hidden = true;
  });
  // claude.ai のショートカットに入力を取られないように
  panel.addEventListener("keydown", (event) => event.stopPropagation());

  function changeSettings(patch) {
    Object.assign(settings, patch);
    save("settings", settings);
    updateChat();
  }
  $(".opt-limit").addEventListener("change", (event) => changeSettings({ limit: Number(event.target.value) || 200_000 }));
  $(".opt-extra").addEventListener("input", (event) => changeSettings({ extra: Math.max(0, Number(event.target.value) || 0) }));
  $(".opt-project").addEventListener("change", (event) => {
    changeSettings({ countProject: event.target.checked });
    const id = chatIdOf(location.pathname);
    if (id) fetchConversation(id);
  });
  $(".opt-limits").addEventListener("change", (event) => {
    changeSettings({ showLimits: event.target.checked });
    refreshLimits({ force: true });
  });

  // ドラッグで好きな場所へ。ダブルクリックで真ん中にもどる
  let position = load("pos", null);

  function place(x, y) {
    const box = bar.getBoundingClientRect();
    const left = Math.min(Math.max(4, x), Math.max(4, innerWidth - box.width - 4));
    const top = Math.min(Math.max(4, y), Math.max(4, innerHeight - box.height - 4));
    position = { x: left, y: top };
    bar.classList.add("placed");
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
  }

  function clampIntoView() {
    if (position) place(position.x, position.y);
  }

  const grip = $(".grip");
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const box = bar.getBoundingClientRect();
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    grip.setPointerCapture(event.pointerId);
    const move = (e) => place(e.clientX - dx, e.clientY - dy);
    grip.addEventListener("pointermove", move);
    grip.addEventListener(
      "pointerup",
      () => {
        grip.removeEventListener("pointermove", move);
        save("pos", position);
      },
      { once: true },
    );
  });
  grip.addEventListener("dblclick", () => {
    position = null;
    save("pos", null);
    bar.classList.remove("placed");
    bar.style.left = "";
    bar.style.top = "";
  });
  addEventListener("resize", clampIntoView);

  // ページが暗いか明るいかに合わせる
  function isDarkPage() {
    for (const el of [document.body, document.documentElement]) {
      const parts = el && getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!parts || (parts.length === 4 && Number(parts[3]) === 0)) continue;
      const [r, g, b] = parts.map(Number);
      return 0.299 * r + 0.587 * g + 0.114 * b < 128;
    }
    return matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // ---- 起動 ----
  attach();
  bar.classList.toggle("dark", isDarkPage());
  if (load("min", false)) bar.classList.add("min");
  requestAnimationFrame(clampIntoView);
  updateChat();
  refreshLimits({ force: true });

  let isDirty = false;
  let lastMutation = 0;
  let lastPath = location.pathname;
  new MutationObserver(() => {
    isDirty = true;
    changedSinceFetch = true;
    lastMutation = Date.now();
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  setInterval(() => {
    attach();
    const id = chatIdOf(location.pathname);
    const now = Date.now();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      isDirty = true;
    }
    if (id && !convo.busy) {
      const isNewChat = convo.id !== id;
      // 画面が変わって落ち着いたら読みなおす。ずっと動き続ける画面でも20秒に1回は読む。読めなかったときは間をあける
      const waited = now - convo.at;
      const isDue =
        changedSinceFetch &&
        document.visibilityState === "visible" &&
        waited > (convo.error ? 30_000 : 10_000) &&
        (now - lastMutation > 2500 || waited > 20_000);
      if (isNewChat || isDue) fetchConversation(id);
    }
    if (isDirty) {
      isDirty = false;
      updateChat();
      clampIntoView();
    }
  }, 1500);
  setInterval(() => bar.classList.toggle("dark", isDarkPage()), 3000);
  setInterval(() => refreshLimits(), 3 * 60_000);
})();
