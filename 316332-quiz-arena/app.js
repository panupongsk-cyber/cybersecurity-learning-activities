// app.js — DOM SHELL ONLY. Every rule lives in game-core.js.
//
// This file is allowed to: touch the DOM, read the clock, generate entropy, and talk to
// localStorage. It is NOT allowed to decide whether an answer is correct, compute a score or a
// streak, shuffle anything, or choose which item comes next — all of that goes through `reduce`
// and `selectView`. If an `if` here ever starts deciding right-vs-wrong, it belongs in game-core.
//
// See ../DESIGN.md §4 (architecture) and the P3 contract in planning-brief.md.

import { createSession, reduce, selectView, mergeHistory, validatePack, MODES } from "./game-core.js";

const PACK_URL = "packs/316332.json";
const STORAGE_KEY = (packId) => `quizArena:v1:${packId}`;

// ── UI copy, bilingual. Kept here (not in the pack) because it's chrome, not content. ──────────

const UI = {
  en: {
    brand: "Quiz Arena",
    menuTitle: "Practice by week",
    menuLede: "Ungraded practice. Nothing here is recorded or reported.",
    menuNote:
      "This is not the graded quiz. Your marks come from the weekly quizzes on Moodle — this is just a place to test yourself as often as you like.",
    modeHeading: "Choose a mode",
    pickHeading: "Choose a week",
    pickHeadingOther: "Ready when you are",
    start: "Start",
    modes: {
      practice: { name: "Practice", desc: "One week at a time, in order. No timer — read the explanation for every question." },
      streak_rush: { name: "Streak Rush", desc: "60 seconds, questions from every week, shuffled. How long a streak can you hold?" },
      misconception_duel: { name: "Misconception Duel", desc: "Only the true/false traps — the statements students most often get backwards." },
      revision: { name: "Revision", desc: "Rebuilds a set from your own history: never-seen first, then what you got wrong, then what you haven't touched in a while." },
    },
    timeLeft: (s) => `${s}s left`,
    timeUp: "Time!",
    items: (n) => `${n} questions`,
    count: (i, n) => `Question ${i} of ${n}`,
    correct: "Correct",
    wrong: "Not quite",
    next: "Next question",
    finish: "See results",
    quit: "← Back to weeks",
    sourceLabel: (p) => `Reference: ${p}`,
    doneTitle: "Round complete",
    scoreLabel: (n) => `out of ${n} correct`,
    streak: (n) => `Best streak this round: ${n}`,
    breakdownHeading: "By question type",
    cognitive: { concept: "Concept", misconception: "Misconception check", applied: "Applied" },
    again: "Play this week again",
    menu: "Pick another week",
    errorTitle: "Could not load the question pack",
    footer: "Ungraded practice tool · 316332 Cybersecurity · no accounts, no data leaves this device",
  },
  th: {
    brand: "Quiz Arena",
    menuTitle: "ฝึกทำข้อสอบรายสัปดาห์",
    menuLede: "ฝึกฝนโดยไม่มีผลต่อคะแนน ไม่มีการบันทึกหรือรายงานผลใด ๆ",
    menuNote:
      "นี่ไม่ใช่แบบทดสอบที่เก็บคะแนน คะแนนของคุณมาจาก quiz รายสัปดาห์บน Moodle — ที่นี่เป็นเพียงที่ให้ทบทวนตัวเองกี่ครั้งก็ได้",
    modeHeading: "เลือกโหมด",
    pickHeading: "เลือกสัปดาห์",
    pickHeadingOther: "พร้อมเมื่อไหร่ก็เริ่มได้",
    start: "เริ่ม",
    modes: {
      practice: { name: "ฝึกทีละสัปดาห์", desc: "ทีละสัปดาห์ เรียงตามลำดับ ไม่จับเวลา — อ่านคำอธิบายให้ครบทุกข้อ" },
      streak_rush: { name: "ตอบให้ไว 60 วินาที", desc: "60 วินาที สุ่มข้อจากทุกสัปดาห์ ตอบถูกติดกันได้กี่ข้อ?" },
      misconception_duel: { name: "ดวลความเข้าใจผิด", desc: "เฉพาะข้อ true/false ที่เป็นกับดัก — ข้อความที่นักศึกษามักเข้าใจกลับด้านที่สุด" },
      revision: { name: "ทบทวนตามผลของคุณ", desc: "สร้างชุดจากประวัติของคุณเอง: ข้อที่ยังไม่เคยทำก่อน แล้วข้อที่เคยตอบผิด แล้วข้อที่ไม่ได้แตะมานาน" },
    },
    timeLeft: (s) => `เหลือ ${s} วิ`,
    timeUp: "หมดเวลา!",
    items: (n) => `${n} ข้อ`,
    count: (i, n) => `ข้อ ${i} จาก ${n}`,
    correct: "ถูกต้อง",
    wrong: "ยังไม่ถูก",
    next: "ข้อถัดไป",
    finish: "ดูผล",
    quit: "← กลับไปเลือกสัปดาห์",
    sourceLabel: (p) => `อ้างอิง: ${p}`,
    doneTitle: "จบรอบแล้ว",
    scoreLabel: (n) => `จาก ${n} ข้อ`,
    streak: (n) => `ตอบถูกติดต่อกันมากสุดรอบนี้: ${n}`,
    breakdownHeading: "แยกตามประเภทคำถาม",
    cognitive: { concept: "แนวคิด", misconception: "ตรวจความเข้าใจผิด", applied: "ประยุกต์ใช้" },
    again: "เล่นสัปดาห์นี้อีกครั้ง",
    menu: "เลือกสัปดาห์อื่น",
    errorTitle: "โหลดชุดคำถามไม่สำเร็จ",
    footer: "เครื่องมือฝึกฝนที่ไม่เก็บคะแนน · 316332 Cybersecurity · ไม่ต้องล็อกอิน ไม่มีข้อมูลออกจากเครื่องนี้",
  },
};

// ── app-level (not game) state ────────────────────────────────────────────────────────────────

let pack = null;
let session = null;      // opaque game-core state; app.js never inspects it to make decisions
let lang = "th";
let currentGroupId = null;
let currentMode = "practice";
let timerHandle = null;  // Streak Rush only; see startTimer/stopTimer
let savedThisRound = false;  // guards finishRound(); see the comment there

const REVISION_LIMIT = 20;   // a revision round should be finishable in one sitting, not all 75
const TICK_MS = 200;         // smooth enough for a seconds countdown without busy-looping

const $ = (id) => document.getElementById(id);
const t = () => UI[lang];

// ── markdown-ish emphasis, rendered as DOM nodes (never innerHTML) ────────────────────────────
// Item stems use *…* around the quoted misconception. Building text nodes keeps pack content
// strictly inert: even if a pack were ever edited by hand, it cannot inject markup here.
//
// Applied to stems only, and that is currently correct rather than an oversight: in packs/316332.json
// all 75 stems contain `*`, while zero choices and zero explanations do. If a regenerated pack ever
// puts emphasis in an explanation, it would render as literal asterisks — route that field through
// this helper too rather than assuming the mismatch is cosmetic.

function renderEmphasis(target, text) {
  target.textContent = "";
  for (const [i, part] of String(text).split("*").entries()) {
    if (part === "") continue;
    if (i % 2 === 1) {
      const em = document.createElement("em");
      em.textContent = part;
      target.appendChild(em);
    } else {
      target.appendChild(document.createTextNode(part));
    }
  }
}

// ── persistence. game-core stays pure; the localStorage round-trip lives here. ─────────────────

function loadHistory(packId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(packId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.perItem === "object" ? parsed.perItem : {};
  } catch {
    return {}; // corrupt or unavailable storage must never block practice
  }
}

function saveHistory(packId, log) {
  try {
    const perItem = mergeHistory(loadHistory(packId), log); // fold via game-core, never by hand
    localStorage.setItem(STORAGE_KEY(packId), JSON.stringify({ perItem }));
  } catch {
    /* private mode / quota — practice still works, progress just isn't remembered */
  }
}

// ── screens ───────────────────────────────────────────────────────────────────────────────────

function showScreen(name) {
  for (const id of ["menu", "play", "done", "error"]) {
    $(`screen-${id}`).classList.toggle("is-hidden", id !== name);
  }
}

// ── dispatch: the ONLY way session state changes ──────────────────────────────────────────────

function dispatch(action) {
  session = reduce(session, action, pack);
  renderPlay();
}

// ── render: menu ──────────────────────────────────────────────────────────────────────────────

function renderChrome() {
  const c = t();
  document.documentElement.lang = lang;
  $("brand-title").textContent = c.brand;
  $("menu-title").textContent = c.menuTitle;
  $("menu-lede").textContent = c.menuLede;
  $("menu-note").textContent = c.menuNote;
  $("menu-mode-heading").textContent = c.modeHeading;
  $("btn-quit").textContent = c.quit;
  $("btn-again").textContent = c.again;
  $("btn-menu").textContent = c.menu;
  $("done-title").textContent = c.doneTitle;
  $("done-breakdown-heading").textContent = c.breakdownHeading;
  $("error-title").textContent = c.errorTitle;
  $("footer-note").textContent = c.footer;
  $("lang-toggle").setAttribute("aria-pressed", String(lang === "en"));
}

function renderMenu() {
  renderModePicker();
  renderModeDetail();
}

function renderModePicker() {
  const list = $("mode-list");
  list.textContent = "";

  for (const mode of MODES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "mode-card" + (mode === currentMode ? " is-active" : "");
    card.setAttribute("aria-pressed", String(mode === currentMode));

    const name = document.createElement("span");
    name.className = "mode-card-name";
    name.textContent = t().modes[mode].name;

    const desc = document.createElement("span");
    desc.className = "mode-card-desc";
    desc.textContent = t().modes[mode].desc;

    card.append(name, desc);
    card.addEventListener("click", () => {
      currentMode = mode;
      renderMenu();
    });
    list.appendChild(card);
  }
}

function renderModeDetail() {
  const c = t();
  const groupList = $("group-list");
  const startBtn = $("btn-start-mode");
  const isPractice = currentMode === "practice";

  $("menu-pick-heading").textContent = isPractice ? c.pickHeading : c.pickHeadingOther;
  $("mode-detail-desc").textContent = c.modes[currentMode].desc;

  // Practice is the only mode scoped to one week; the rest draw across the whole pack.
  groupList.classList.toggle("is-hidden", !isPractice);
  startBtn.classList.toggle("is-hidden", isPractice);
  startBtn.textContent = c.start;

  groupList.textContent = "";
  if (!isPractice) return;

  for (const group of pack.groups) {
    const count = pack.items.filter((i) => i.group === group.id).length;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "group-card";

    const label = document.createElement("span");
    label.className = "group-card-label";
    label.textContent = group.label[lang];

    const meta = document.createElement("span");
    meta.className = "group-card-meta";
    meta.textContent = c.items(count);

    card.append(label, meta);
    card.addEventListener("click", () => startRound("practice", group.id));
    groupList.appendChild(card);
  }
}

// ── render: play + reveal ─────────────────────────────────────────────────────────────────────

function renderPlay() {
  const view = selectView(session, pack);

  if (view.status === "complete") {
    renderDone(view.summary);
    return;
  }

  const c = t();
  const group = pack.groups.find((g) => g.id === view.item.group);

  // In Practice the week is the frame; in every other mode the queue spans weeks, so the mode
  // name is the more useful label and the week is noise.
  $("play-group").textContent =
    view.mode === "practice" ? group.label[lang] : c.modes[view.mode].name;
  $("play-cognitive").textContent = c.cognitive[view.item.cognitive] ?? view.item.cognitive;
  $("play-count").textContent = c.count(view.progress.index + 1, view.progress.total);
  $("play-progress-fill").style.width = `${(view.progress.index / view.progress.total) * 100}%`;
  renderTimer(view);

  renderEmphasis($("play-stem"), view.item.stem[lang]);
  renderChoices(view);
  renderReveal(view);
}

function renderChoices(view) {
  const box = $("play-choices");
  box.textContent = "";

  for (const [position, choice] of view.item.choices.entries()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.disabled = view.revealed;

    // The badge is POSITIONAL, not the pack's key. Choices arrive shuffled, so printing the pack
    // key would show "A C B D" down the page and read as a rendering bug. `choice.key` stays the
    // identity dispatched to the reducer; only the label is positional.
    const key = document.createElement("span");
    key.className = "choice-key";
    key.textContent = String.fromCharCode(65 + position);

    const text = document.createElement("span");
    text.textContent = choice.text[lang];

    btn.append(key, text);

    // Which class to paint is read off the view model — app.js never recomputes correctness.
    if (view.revealed) {
      if (choice.key === view.reveal.answer) btn.classList.add("is-correct");
      else if (choice.key === view.selectedKey) btn.classList.add("is-wrong");
    } else {
      btn.addEventListener("click", () =>
        dispatch({ type: "ANSWER", payload: { key: choice.key, now: Date.now() } })
      );
    }

    box.appendChild(btn);
  }
}

// packs/README.md asks for `m1-foundations / 01-what-is-cybersecurity`, not the full repo path:
// the deployment prefix is noise to a student, while module + note name is what they open.
function referenceLabel(sourcePath) {
  const parts = sourcePath.split("/").filter(Boolean);
  const tail = parts.slice(-2).join(" / ");
  return tail.replace(/\.md$/, "");
}

function renderReveal(view) {
  const panel = $("play-reveal");

  if (!view.revealed) {
    panel.classList.add("is-hidden");
    return;
  }

  const c = t();
  panel.classList.remove("is-hidden");
  panel.classList.toggle("is-correct", view.reveal.correct);
  panel.classList.toggle("is-wrong", !view.reveal.correct);
  panel.classList.toggle("emphasise", view.reveal.emphasiseCorrection);

  $("reveal-verdict").textContent = view.reveal.correct ? c.correct : c.wrong;
  $("reveal-explanation").textContent = view.reveal.explanation[lang];

  // `source` is a repo-relative path to a lecture note that is NOT part of the deployed artifact,
  // so it renders as a reference label, never a link (packs/README.md field note).
  const src = $("reveal-source");
  src.classList.toggle("is-hidden", !view.item.source);
  if (view.item.source) src.textContent = c.sourceLabel(referenceLabel(view.item.source));

  const isLast = view.progress.index + 1 >= view.progress.total;
  $("btn-next").textContent = isLast ? c.finish : c.next;
}

// ── render: results ───────────────────────────────────────────────────────────────────────────

function renderDone(summary) {
  stopTimer(); // belt and braces: no path may reach the results screen with a live interval
  const c = t();

  $("done-score").textContent = String(summary.correct);
  $("done-score-label").textContent = c.scoreLabel(summary.total);
  $("done-streak").textContent = c.streak(summary.bestStreak);

  const list = $("done-breakdown");
  list.textContent = "";
  for (const [cognitive, bucket] of Object.entries(summary.byCognitive)) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.className = "breakdown-label";
    label.textContent = c.cognitive[cognitive] ?? cognitive;

    const value = document.createElement("span");
    value.className = "breakdown-value";
    value.textContent = `${bucket.correct} / ${bucket.total}`;

    li.append(label, value);
    list.appendChild(li);
  }

  showScreen("done");
}

// ── round lifecycle ───────────────────────────────────────────────────────────────────────────

function startRound(mode, groupId = null) {
  stopTimer(); // a replay must never leave the previous round's interval running
  savedThisRound = false;
  currentMode = mode;
  currentGroupId = groupId;

  // app.js supplies the entropy and the clock; game-core never reaches for either itself.
  const config = {
    mode,
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
    now: Date.now(),
  };
  if (mode === "practice") config.groupId = groupId;
  if (mode === "revision") {
    config.history = loadHistory(pack.packId);
    config.limit = REVISION_LIMIT;
  }

  session = createSession(pack, config);
  showScreen("play");
  renderPlay();

  if (mode === "streak_rush") startTimer();
}

// Idempotent by construction, not by luck. `mergeHistory` folds a log additively, so saving the
// same finished session twice would double-count `seen` for every item in it. Three call sites can
// reach here (NEXT completing the queue, quitting, and the Streak Rush clock expiring); today only
// one fires per round, but that is a property of which buttons happen to be reachable on which
// screen, which is exactly the kind of thing a later phase quietly breaks.
function finishRound() {
  stopTimer();
  if (!session || savedThisRound) return;
  savedThisRound = true;
  saveHistory(pack.packId, session.log);
}

// ── the Streak Rush clock ─────────────────────────────────────────────────────────────────────
// Ticks go through `reduce` like every other action, but deliberately NOT through `dispatch`:
// a full re-render five times a second would tear down and rebuild the choice buttons under the
// player's finger. So a tick paints only the countdown, and hands over to a full render just once,
// at the moment the reducer flips the session to complete.

function startTimer() {
  stopTimer();
  timerHandle = setInterval(() => {
    if (!session) return stopTimer();
    session = reduce(session, { type: "TICK", payload: { now: Date.now() } }, pack);
    const view = selectView(session, pack);
    if (view.status === "complete") {
      stopTimer();
      finishRound();
      renderDone(view.summary);
    } else {
      renderTimer(view);
    }
  }, TICK_MS);
}

function stopTimer() {
  if (timerHandle !== null) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
}

function renderTimer(view) {
  const el = $("play-timer");
  const timed = view.timeRemainingMs != null;
  el.classList.toggle("is-hidden", !timed);
  if (!timed) return;
  const seconds = Math.ceil(view.timeRemainingMs / 1000);
  el.textContent = seconds > 0 ? t().timeLeft(seconds) : t().timeUp;
  el.classList.toggle("is-urgent", seconds <= 10);
}

// ── wiring ────────────────────────────────────────────────────────────────────────────────────

function wire() {
  $("lang-toggle").addEventListener("click", () => {
    lang = lang === "th" ? "en" : "th";
    renderChrome();
    renderMenu();
    // Re-renders from the SAME session object, so switching language mid-question keeps the
    // position, the revealed state, and the score exactly where they were.
    if (session) renderPlay();
  });

  $("btn-start-mode").addEventListener("click", () => startRound(currentMode));

  $("btn-next").addEventListener("click", () => {
    dispatch({ type: "NEXT" });
    if (selectView(session, pack).status === "complete") finishRound();
  });

  $("btn-quit").addEventListener("click", () => {
    finishRound(); // stops the timer and keeps the partial round rather than discarding it
    session = null;
    showScreen("menu");
    renderMenu();
  });

  $("btn-again").addEventListener("click", () => startRound(currentMode, currentGroupId));

  $("btn-menu").addEventListener("click", () => {
    stopTimer();
    session = null;
    showScreen("menu");
    renderMenu();
  });
}

// ── boot ──────────────────────────────────────────────────────────────────────────────────────

async function boot() {
  renderChrome();
  wire();

  try {
    const response = await fetch(PACK_URL);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const loaded = await response.json();
    // The pack is the one thing crossing a trust boundary here. Validate at the boundary so a bad
    // pack surfaces on the error screen, instead of throwing later inside a click handler.
    const { ok, errors } = validatePack(loaded);
    if (!ok) throw new Error(errors.join("; "));
    pack = loaded;
  } catch (err) {
    $("error-detail").textContent = `${PACK_URL} — ${err.message}`;
    showScreen("error");
    return;
  }

  renderMenu();
  showScreen("menu");
  registerServiceWorker();
}

// Offline support is an enhancement, never a precondition: registration failures (unsupported
// browser, `file://`, an http origin that isn't localhost) must leave a fully working online app.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* no offline support this session; the app still works while online */
  });
}

boot();
