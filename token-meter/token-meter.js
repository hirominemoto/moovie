// <token-meter> — うしと月のトークンメーター
//
// このチャット: いまの会話の大きさを、AIが一度に読める量（コンテキスト）と比べる。うしが右へ歩いていく。
// トータル:     これまでに使ったトークンの合計を、自分で決めた予算と比べる。月が満ちていく。
//
//   <script type="module" src="token-meter.js"></script>
//   <token-meter chat-limit="1000000" total-limit="5000000" storage-key="my-chat-total"></token-meter>
//
//   meter.addUsage(response.usage)  // Claude API のレスポンスの usage をそのまま渡す
//   meter.newChat()                 // 新しい会話を始めたとき

const COW_SVG = `
<svg class="cow" part="cow" viewBox="0 0 48 46" aria-hidden="true">
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

const CSS = `
:host { display: block; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

.wrap {
  --ink: var(--tm-ink, #222538);
  --muted: var(--tm-muted, #5f6680);
  --surface: var(--tm-surface, #ffffff);
  --line: var(--tm-line, #d6dfd2);
  --track: var(--tm-track, #e2e9de);
  --calm: var(--tm-calm, #46b26e);
  --half: var(--tm-half, #f0bb33);
  --near: var(--tm-near, #f58a43);
  --full: var(--tm-full, #ff6b6b);
  --pill-ink: #1d1b2c;
  --night: #1c2050;
  --night-2: #2d3378;
  --moon: #ffd96b;
  --moon-shade: #464b8e;
  container-type: inline-size;
  padding: 12px 16px 6px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--tm-font, inherit);
}
@media (prefers-color-scheme: dark) {
  .wrap {
    --ink: var(--tm-ink, #eceeff);
    --muted: var(--tm-muted, #a5aacb);
    --surface: var(--tm-surface, #1a1d3a);
    --line: var(--tm-line, #2e3263);
    --track: var(--tm-track, #282c55);
  }
}

.meters { display: grid; gap: 4px 28px; }
@container (min-width: 640px) { .meters { grid-template-columns: 1fr 1fr; } }

.row { --st: var(--calm); container: row / inline-size; }
.row[data-level="half"] { --st: var(--half); }
.row[data-level="near"] { --st: var(--near); }
.row[data-level="full"] { --st: var(--full); }

.head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.label { font-size: 13px; font-weight: 700; letter-spacing: .04em; white-space: nowrap; }
.pill {
  padding: 4px 9px 3px;
  border-radius: 999px;
  background: var(--st);
  color: var(--pill-ink);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  transition: background-color .4s;
}
.count, .pct {
  font-family: var(--tm-num-font, var(--tm-font, inherit));
  font-variant-numeric: tabular-nums;
}
.count { margin-left: auto; font-size: 12px; color: var(--muted); white-space: nowrap; }
.count .short { display: none; }
@container row (max-width: 340px) {
  .count .full { display: none; }
  .count .short { display: inline; }
}

.body { display: flex; align-items: center; gap: 14px; }
.track {
  --r: 30px;
  position: relative;
  flex: 1;
  height: 12px;
  margin: 12px 0;
  border-radius: 999px;
  background: var(--track);
}
.fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--p, 0) * 100%);
  border-radius: inherit;
  transition: width .7s cubic-bezier(.22, 1, .36, 1), background-color .4s;
}
.rider {
  position: absolute;
  top: 50%;
  left: calc(var(--p, 0) * (100% - var(--r)));
  width: var(--r);
  height: var(--r);
  margin-top: calc(var(--r) / -2);
  cursor: pointer;
  transition: left .7s cubic-bezier(.22, 1, .36, 1);
}
.pct { min-width: 3.3em; font-size: 26px; line-height: 1; text-align: right; }
.pct b { font-weight: 600; }
.pct small { margin-left: 1px; font-size: 14px; font-weight: 500; color: var(--muted); }

/* このチャット: 牧場のバーを、うし柄の色が伸びていく */
.chat .fill {
  background:
    radial-gradient(8px 4.5px at 11px 4px, rgba(29, 27, 44, .2) 95%, transparent),
    radial-gradient(5px 3.5px at 30px 8.5px, rgba(29, 27, 44, .16) 95%, transparent),
    var(--st);
  background-size: 42px 12px, 42px 12px, auto;
}
.cow { display: block; width: 100%; height: 100%; overflow: visible; transform-origin: 50% 90%; }
.cow .eyes-x, .cow .sweat { display: none; }
.row[data-level="near"] .sweat, .row[data-level="full"] .sweat { display: inline; }
.row[data-level="full"] .eyes-o { display: none; }
.row[data-level="full"] .eyes-x { display: inline; }

/* トータル: 夜空のバーで、月が満ちていく */
.total .track {
  --r: 24px;
  background:
    radial-gradient(1px 1px at 12% 35%, #fff 99%, transparent),
    radial-gradient(1px 1px at 31% 70%, rgba(255, 255, 255, .75) 99%, transparent),
    radial-gradient(1.3px 1.3px at 52% 30%, #fff 99%, transparent),
    radial-gradient(1px 1px at 72% 66%, rgba(255, 255, 255, .7) 99%, transparent),
    radial-gradient(1.2px 1.2px at 90% 38%, #fff 99%, transparent),
    linear-gradient(90deg, var(--night), var(--night-2));
}
.total .fill {
  --end: var(--moon);
  background: linear-gradient(90deg, rgba(150, 135, 255, .35), rgba(190, 172, 255, .8) 55%, var(--end));
}
.total[data-level="near"] .fill, .total[data-level="full"] .fill { --end: var(--st); }
.moon {
  position: absolute;
  inset: 0;
  border: 1.5px solid rgba(255, 217, 107, .75);
  border-radius: 50%;
  background: var(--moon-shade);
  box-shadow:
    inset calc(var(--p, 0) * -21px) 0 0 0 var(--moon),
    0 0 calc(3px + var(--p, 0) * 12px) rgba(255, 217, 107, calc(.25 + var(--p, 0) * .5));
  transition: box-shadow .7s cubic-bezier(.22, 1, .36, 1);
}

/* ふきだし */
.bubble {
  position: absolute;
  bottom: calc(100% + 6px);
  left: -4px;
  z-index: 2;
  padding: 4px 9px;
  border-radius: 10px;
  background: var(--ink);
  color: var(--surface);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px) scale(.9);
  transform-origin: 14px 100%;
  transition: opacity .2s, transform .25s cubic-bezier(.3, 1.5, .5, 1);
}
.bubble::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 14px;
  border: 5px solid transparent;
  border-top-color: var(--ink);
}
.flip .bubble { left: auto; right: -4px; transform-origin: calc(100% - 14px) 100%; }
.flip .bubble::after { left: auto; right: 14px; }
.saying .bubble { opacity: 1; transform: none; }

@keyframes waddle {
  0%, 100% { transform: rotate(0); }
  25% { transform: translateY(-2px) rotate(-9deg); }
  75% { transform: translateY(-2px) rotate(9deg); }
}
@keyframes hop {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-14px) rotate(-8deg); }
  70% { transform: translateY(0); }
  85% { transform: translateY(-4px); }
}
@keyframes worry {
  0%, 84%, 100% { transform: rotate(0); }
  89% { transform: rotate(-7deg); }
  95% { transform: rotate(7deg); }
}
@keyframes glow {
  50% { filter: brightness(1.3) drop-shadow(0 0 6px rgba(255, 217, 107, .9)); }
}
.row[data-level="full"] .cow { animation: worry 2.8s ease-in-out infinite; }
.walking .cow { animation: waddle .32s ease-in-out 3; }
.glowing .moon { animation: glow .9s ease-in-out; }
.hop .cow, .hop .moon { animation: hop .75s cubic-bezier(.3, .7, .4, 1); }

@media (prefers-reduced-motion: reduce) {
  .fill, .rider, .moon, .bubble { transition: none; }
  .cow, .moon { animation: none !important; }
}
`;

const row = (key, label, rider) => `
  <div class="row ${key}" id="${key}" data-level="calm">
    <div class="head">
      <span class="label" id="${key}-label">${label}</span>
      <span class="pill"></span>
      <span class="count"><span class="full"></span><span class="short"></span></span>
    </div>
    <div class="body">
      <div class="track" role="meter" aria-labelledby="${key}-label" aria-valuemin="0" aria-valuemax="100">
        <div class="fill"></div>
        <div class="rider" aria-hidden="true"><span class="bubble"></span>${rider}</div>
      </div>
      <span class="pct" aria-hidden="true"><b>0</b><small>%</small></span>
    </div>
  </div>`;

const TEMPLATE = `
<style>${CSS}</style>
<div class="wrap" part="panel">
  <div class="meters">
    ${row("chat", "このチャット", COW_SVG)}
    ${row("total", "トータル", `<span class="moon"></span>`)}
  </div>
</div>`;

const STEPS = [[0.95, "full"], [0.8, "near"], [0.5, "half"], [0, "calm"]];
const RANK = { calm: 0, half: 1, near: 2, full: 3 };
const levelOf = (ratio) => STEPS.find(([min]) => ratio >= min)[1];

const CHAT_WORDS = { calm: "もーまんたい", half: "はんぶん こえた", near: "もーすぐ いっぱい", full: "もー げんかい" };
const chatWord = (ratio) => (ratio >= 1 ? "もー はいらない" : CHAT_WORDS[levelOf(ratio)]);

function moonWord(ratio) {
  if (ratio >= 1) return "満月オーバー";
  if (ratio >= 0.95) return "満月";
  if (ratio >= 0.65) return "もうすぐ満月";
  if (ratio >= 0.35) return "半月";
  if (ratio >= 0.1) return "三日月";
  return "新月";
}

// 段階が上がった瞬間のふきだし
const LEVEL_UP = {
  chat: { half: "まだまだ 歩けるモ〜", near: "そろそろ 新しいチャットかモ", full: "もー 歩けない…！" },
  total: { half: "予算の半分をこえたよ", near: "そろそろ 使いすぎかも", full: "満月！ 予算いっぱい" },
};

const toNumber = (value, fallback) => {
  const n = Number(String(value ?? "").replace(/[,_\s]/g, ""));
  return value != null && value !== "" && Number.isFinite(n) && n >= 0 ? n : fallback;
};
const digits = (n) => Math.round(n).toLocaleString("ja-JP");

// 41.8万 / 100万 のような短い表記
function man(n) {
  n = Math.round(n);
  if (n < 10_000) return digits(n);
  const [base, unit] = n < 1e8 ? [1e4, "万"] : [1e8, "億"];
  const x = n / base;
  return (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10) + unit;
}

// 10%未満は小数1桁。切り捨てなので、ほんとうに使い切るまで100にはならない
function percent(ratio) {
  const p = ratio * 100;
  if (p <= 0) return "0";
  if (p < 10) return Math.max(0.1, Math.floor(p * 10) / 10).toFixed(1);
  return String(Math.floor(p));
}

// 1回の API 呼び出しで読み書きしたトークン。毎回これまでの会話をまるごと送るので、
// これがそのまま「いまの会話の大きさ」になる
export function tokensOf(usage = {}) {
  return (
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.output_tokens || 0)
  );
}

const reduceMotion =
  typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

export class TokenMeter extends HTMLElement {
  static observedAttributes = ["chat-used", "chat-limit", "total-used", "total-limit", "chat-label", "total-label"];
  static cowSvg = COW_SVG;

  #meters;
  #ready = false;
  #queued = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;
    const meter = (key, limit) => {
      const el = root.getElementById(key);
      const $ = (selector) => el.querySelector(selector);
      return {
        key, limit, el,
        used: 0, prevUsed: 0, shown: 0, level: "calm", raf: 0, timers: {},
        label: $(".label"), pill: $(".pill"), track: $(".track"), rider: $(".rider"), bubble: $(".bubble"),
        pct: $(".pct b"), full: $(".count .full"), short: $(".count .short"),
      };
    };
    this.#meters = { chat: meter("chat", 1_000_000), total: meter("total", 5_000_000) };

    const { chat, total } = this.#meters;
    chat.rider.addEventListener("click", () => {
      this.#say(chat, "モ〜");
      this.#play(chat, "hop", 800);
    });
    total.rider.addEventListener("click", () => {
      const left = 1 - total.used / total.limit;
      this.#say(total, left > 0 ? `満月まで あと ${percent(left)}%` : "まんまる！");
      this.#play(total, "glowing", 900);
    });
  }

  connectedCallback() {
    const saved = this.#load();
    if (saved != null) this.#meters.total.used = saved;
    this.#render();
    this.#ready = true;
  }

  attributeChangedCallback(name, _old, value) {
    const { chat, total } = this.#meters;
    if (name === "chat-label") chat.label.textContent = value || "このチャット";
    else if (name === "total-label") total.label.textContent = value || "トータル";
    else if (name === "chat-used") chat.used = toNumber(value, 0);
    else if (name === "total-used") total.used = toNumber(value, 0);
    else if (name === "chat-limit") chat.limit = Math.max(1, toNumber(value, 1_000_000));
    else if (name === "total-limit") total.limit = Math.max(1, toNumber(value, 5_000_000));
    this.#schedule();
  }

  get chatUsed() { return this.#meters.chat.used; }
  set chatUsed(n) { this.#set("chat", "used", n); }
  get chatLimit() { return this.#meters.chat.limit; }
  set chatLimit(n) { this.#set("chat", "limit", n); }
  get totalUsed() { return this.#meters.total.used; }
  set totalUsed(n) { this.#set("total", "used", n); }
  get totalLimit() { return this.#meters.total.limit; }
  set totalLimit(n) { this.#set("total", "limit", n); }

  // Claude API のレスポンスの usage を渡すと、両方のメーターを進める
  addUsage(usage) {
    const tokens = tokensOf(usage);
    this.chatUsed = tokens;
    this.totalUsed += tokens;
    return tokens;
  }

  newChat() { this.chatUsed = 0; }
  resetTotal() { this.totalUsed = 0; }

  #set(key, field, value) {
    const m = this.#meters[key];
    const n = toNumber(value, m[field]);
    m[field] = field === "limit" ? Math.max(1, n) : n;
    this.#schedule();
  }

  #schedule() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      this.#render();
    });
  }

  #render() {
    for (const m of Object.values(this.#meters)) {
      const ratio = m.used / m.limit;
      const p = Math.min(1, Math.max(0, ratio));
      const level = levelOf(ratio);

      m.el.style.setProperty("--p", p.toFixed(4));
      m.el.dataset.level = level;
      m.el.classList.toggle("flip", p > 0.5);
      m.pill.textContent = m.key === "chat" ? chatWord(ratio) : moonWord(ratio);
      m.track.setAttribute("aria-valuenow", String(Math.min(100, Math.floor(ratio * 100))));
      m.track.setAttribute("aria-valuetext", `${percent(ratio)}%（${digits(m.used)} / ${digits(m.limit)} トークン）`);

      if (this.#ready) {
        if (m.used > m.prevUsed) this.#play(m, m.key === "chat" ? "walking" : "glowing", 1000);
        if (m.used < m.prevUsed) this.#play(m, "hop", 800);
        if (RANK[level] > RANK[m.level]) this.#say(m, LEVEL_UP[m.key][level]);
        if (level !== m.level) {
          this.dispatchEvent(new CustomEvent("levelchange", { bubbles: true, detail: { meter: m.key, level, ratio } }));
        }
      }
      m.level = level;
      m.prevUsed = m.used;
      this.#tween(m);
    }
    this.#save();
  }

  // 数字はぱらぱらと数え上げる
  #tween(m) {
    cancelAnimationFrame(m.raf);
    const from = m.shown;
    const to = m.used;
    if (!this.#ready || reduceMotion.matches || from === to) {
      m.shown = to;
      this.#paint(m);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 700);
      m.shown = from + (to - from) * (1 - (1 - t) ** 3);
      this.#paint(m);
      if (t < 1) m.raf = requestAnimationFrame(step);
    };
    m.raf = requestAnimationFrame(step);
  }

  #paint(m) {
    m.pct.textContent = percent(m.shown / m.limit);
    m.full.textContent = `${digits(m.shown)} / ${digits(m.limit)}`;
    m.short.textContent = `${man(m.shown)} / ${man(m.limit)}`;
  }

  #play(m, name, ms) {
    if (reduceMotion.matches) return;
    clearTimeout(m.timers[name]);
    m.el.classList.remove(name);
    void m.el.offsetWidth; // アニメーションを頭から流しなおす
    m.el.classList.add(name);
    m.timers[name] = setTimeout(() => m.el.classList.remove(name), ms);
  }

  #say(m, text) {
    clearTimeout(m.timers.say);
    m.bubble.textContent = text;
    m.el.classList.add("saying");
    m.timers.say = setTimeout(() => m.el.classList.remove("saying"), 2000);
  }

  // storage-key を付けると、トータルをブラウザに覚えておく（ページを開きなおしても続きから）
  #load() {
    const key = this.getAttribute("storage-key");
    if (!key) return null;
    try {
      return toNumber(localStorage.getItem(key), null);
    } catch {
      return null;
    }
  }

  #save() {
    const key = this.getAttribute("storage-key");
    if (!key || !this.#ready) return;
    try {
      localStorage.setItem(key, String(Math.round(this.#meters.total.used)));
    } catch {
      // 保存できない環境（プライベートモードなど）でもメーターはそのまま動く
    }
  }
}

if (!customElements.get("token-meter")) customElements.define("token-meter", TokenMeter);
