// もーバー: claude.ai のチャット画面の上に、うしと月のトークンバーを出す
//
// うし（このチャット）: 画面に出ている会話の文字から数えたトークンの推定。上限は設定で選ぶ
// 月（使用上限）:       claude.ai の設定画面「使用量」と同じ 5時間枠・週の使用率。
//                       公式の方法ではないので、読めなかったときは「—」にする
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

  const settings = { limit: 200_000, extra: 0, showLimits: true, ...load("settings", {}) };

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
  width: 16px;
  height: 16px;
  border: 1px solid rgba(255, 217, 107, .8);
  border-radius: 50%;
  background: var(--moon-shade);
  box-shadow:
    inset calc(var(--p, 0) * -14px) 0 0 0 var(--moon),
    0 0 calc(2px + var(--p, 0) * 8px) rgba(255, 217, 107, calc(.2 + var(--p, 0) * .5));
  cursor: pointer;
  transition: box-shadow .6s;
}
.limits[data-level="near"] .pct b, .limits[data-level="full"] .pct b { color: var(--warn); }
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
.mini .moonicon { width: 14px; height: 14px; }
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
  width: 280px;
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
.panel h2 { margin: 0; font-size: 13px; font-weight: 700; }
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

  // claude.ai の会話の吹き出し。見つからないときは画面の本文まるごとで数える
  const MESSAGES = '[data-testid="user-message"], .font-claude-message, .font-claude-response, [data-is-streaming]';
  function conversationText() {
    const found = [...document.querySelectorAll(MESSAGES)].filter((el) => !el.parentElement?.closest(MESSAGES));
    if (found.length) return found.map((el) => el.textContent).join("\n");
    const main = document.querySelector("main");
    if (!main) return "";
    let text = main.textContent;
    for (const field of main.querySelectorAll('[contenteditable="true"], textarea')) {
      const draft = field.value ?? field.textContent;
      if (draft) text = text.replace(draft, "");
    }
    return text;
  }
  const chatIdOf = (path) => path.match(/\/chat\/([^/?#]+)/)?.[1] ?? null;
  const userMessageCount = () => document.querySelectorAll('[data-testid="user-message"]').length;

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
      <span class="lbl limit-lbl">使用上限</span>
      <span class="pct nodata"><b class="limit-pct">—</b><small>%</small></span>
      <span class="sub limit-sub"></span>
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
    <label>上乗せするトークン（プロジェクトの資料など）
      <input class="opt-extra" type="number" min="0" step="1000" inputmode="numeric">
    </label>
    <label class="check"><input class="opt-limits" type="checkbox"> 使用上限（5時間・週）を表示する</label>
    <p>うしの数字は、画面に出ている会話の文字から数えた推定です。システムの指示、添付ファイル、プロジェクトの資料は画面に出ないので入っていません。上限はプランやモデルで変わります。</p>
    <p>月の数字は、claude.ai の設定画面「使用量」と同じものを読んでいます。公式の方法ではないので、読めないときは「—」になります。</p>
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
  let chat = { id: undefined, tokens: 0, level: "calm" };

  function updateChat() {
    const id = chatIdOf(location.pathname);
    const tokens = id ? estimateTokens(conversationText()) + (Number(settings.extra) || 0) : 0;
    const ratio = tokens / settings.limit;
    const p = Math.min(1, Math.max(0, ratio));
    const level = levelOf(ratio);
    const sameChat = id === chat.id;

    if (sameChat && tokens > chat.tokens) play("walking", 1000);
    if (sameChat && RANK[level] > RANK[chat.level]) say(CHAT_UP[level], $(".rider"));
    chat = { id, tokens, level };

    const word = ratio >= 1 ? "もー はいらない" : CHAT_WORDS[level];
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
    chatSeg.title = `このチャット：約${digits(tokens)} トークン（推定）/ 上限 ${digits(settings.limit)}\n${word}`;
  }

  // ---- 使用上限（月） ----
  let limits = { state: "off" };
  let lastFetch = 0;
  let orgId = null;

  function orgFromCookie() {
    const match = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function orgFromApi() {
    const res = await fetch(new URL("/api/organizations", location.origin), { credentials: "include" });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? (list.find((org) => org?.uuid)?.uuid ?? null) : null;
  }

  async function refreshLimits({ force = false } = {}) {
    if (!settings.showLimits) {
      limits = { state: "off" };
      renderLimits(null);
      return;
    }
    const now = Date.now();
    if (!force && now - lastFetch < 60_000) return;
    lastFetch = now;
    const before = limits;
    try {
      orgId = orgFromCookie() ?? orgId ?? (await orgFromApi());
      const org = orgId;
      if (!org) throw new Error("組織が見つかりません");
      const res = await fetch(new URL(`/api/organizations/${encodeURIComponent(org)}/usage`, location.origin), {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
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
      limits = { state: "error", reason: error?.message || String(error) };
    }
    renderLimits(before);
  }

  function renderLimits(before) {
    const main = limits.state === "ok" ? (limits.five ?? limits.week) : null;
    const ratio = main ? main.pct / 100 : 0;
    const level = levelOf(ratio);
    const p = Math.min(1, ratio).toFixed(4);

    limitSeg.classList.toggle("off", !main);
    limitSeg.dataset.level = level;
    for (const icon of root.querySelectorAll(".moonicon")) icon.style.setProperty("--p", p);
    for (const el of [$(".limits .pct"), $(".mini-limit-wrap")]) el.classList.toggle("nodata", !main);

    const text = main ? String(Math.round(main.pct)) : "—";
    $(".limit-pct").textContent = text;
    $(".mini-limit").textContent = text;
    $(".limit-lbl").textContent = !main ? "使用上限" : limits.five ? "5時間" : "週";
    $(".limit-sub").textContent = limits.five && limits.week ? `週 ${Math.round(limits.week.pct)}%` : "";

    if (limits.state === "ok") {
      const lines = [];
      if (limits.five) lines.push(`5時間枠：${Math.round(limits.five.pct)}%${when(limits.five.resetsAt) ? `（${when(limits.five.resetsAt)} にリセット）` : ""}`);
      if (limits.week) lines.push(`1週間：${Math.round(limits.week.pct)}%${when(limits.week.resetsAt) ? `（${when(limits.week.resetsAt)} にリセット）` : ""}`);
      limitSeg.title = lines.join("\n");
      const prev = before?.state === "ok" ? levelOf((before.five ?? before.week).pct / 100) : null;
      if (prev && RANK[level] > RANK[prev]) say(LIMIT_UP[level], $(".limits .moonicon"));
    } else if (limits.state === "error") {
      limitSeg.title = `使用上限を読めませんでした（${limits.reason}）。claude.ai の設定画面「使用量」で確かめてください。`;
    } else {
      limitSeg.title = "使用上限の表示はオフです（設定でオンにできます）";
    }
  }

  // ---- 操作 ----
  $(".rider").addEventListener("click", () => {
    say("モ〜", $(".rider"));
    play("hop", 800);
  });
  $(".limits .moonicon").addEventListener("click", () => {
    const icon = $(".limits .moonicon");
    if (limits.state !== "ok") return say("使用上限は いま読めないみたい", icon);
    const slot = limits.five ?? limits.week;
    const reset = when(slot.resetsAt);
    say(reset ? `${reset} にリセット` : `${Math.round(slot.pct)}% つかったよ`, icon);
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
    $(".opt-limits").checked = settings.showLimits;
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
  let lastPath = location.pathname;
  let lastSent = userMessageCount();
  new MutationObserver(() => {
    isDirty = true;
  }).observe(document.body, { subtree: true, childList: true, characterData: true });

  setInterval(() => {
    attach();
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      isDirty = true;
    }
    if (isDirty) {
      isDirty = false;
      updateChat();
      clampIntoView();
      const sent = userMessageCount();
      if (sent > lastSent) refreshLimits();
      lastSent = sent;
    }
  }, 1500);
  setInterval(() => bar.classList.toggle("dark", isDarkPage()), 3000);
  setInterval(() => refreshLimits(), 3 * 60_000);
})();
