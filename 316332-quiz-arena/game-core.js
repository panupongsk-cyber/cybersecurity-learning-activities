// game-core.js — PURE LOGIC. No DOM, no globals, no localStorage, no Math.random(), no Date.now().
//
// Every effect that would make this untestable from plain `node` is pushed to the caller:
//   - randomness takes an explicit numeric `seed` / `rngState`, threaded through and returned
//   - time takes an explicit `now` (ms), never read internally
//   - persistence (localStorage) is app.js's job; this file only returns plain, JSON-serializable
//     data for app.js to store and pass back in next time
//
// Design: ../DESIGN.md sections 3 (pack schema), 4 (architecture), 5 (modes), 6 (live-mode seam).
//
// Signature note vs. DESIGN.md §4's illustrative pseudocode: `reduce` and `selectView` there are
// written as `(state, action)` / `(state)` only. Rendering and evaluating an answer both need the
// pack's actual question content (stems, choices, correct answer), which state deliberately does
// NOT duplicate (state stores item *ids*, not item bodies, to stay small and pack-agnostic across
// a session). So both take an explicit `pack` parameter here. `scoreSession(state)` keeps the
// exact signature from the design: state carries its own `log` of what was answered and how, so
// scoring never needs the pack.

export const SUPPORTED_SCHEMA_VERSIONS = [1];

export const MODES = /** @type {const} */ (["practice", "streak_rush", "misconception_duel", "revision"]);

const DEFAULT_STREAK_RUSH_MS = 60_000;

// --- pack validation -----------------------------------------------------------------------

/**
 * @param {any} pack
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePack(pack) {
  const errors = [];
  if (!pack || typeof pack !== "object") {
    return { ok: false, errors: ["pack is not an object"] };
  }
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(pack.schemaVersion)) {
    errors.push(
      `unsupported schemaVersion ${pack.schemaVersion} (supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")})`
    );
  }
  if (!Array.isArray(pack.groups) || pack.groups.length === 0) {
    errors.push("pack.groups must be a non-empty array");
  }
  if (!Array.isArray(pack.items) || pack.items.length === 0) {
    errors.push("pack.items must be a non-empty array");
  } else {
    const ids = new Set();
    const groupIds = new Set((pack.groups || []).map((g) => g.id));
    for (const item of pack.items) {
      if (!item.id) errors.push("an item is missing id");
      else if (ids.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
      ids.add(item.id);
      if (!groupIds.has(item.group)) errors.push(`${item.id}: unknown group ${item.group}`);
      if (!Array.isArray(item.choices) || item.choices.length === 0) {
        errors.push(`${item.id}: choices must be a non-empty array`);
      } else if (!item.choices.some((c) => c.key === item.answer)) {
        errors.push(`${item.id}: answer ${item.answer} is not one of its choices`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function findItem(pack, itemId) {
  const item = pack.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`unknown item id: ${itemId}`);
  return item;
}

// --- seeded RNG (mulberry32) — deterministic, no Math.random() --------------------------------

/**
 * One deterministic pseudo-random draw. `state` is a plain 32-bit unsigned integer, trivially
 * JSON-serializable, so it can live inside session state and be replayed exactly.
 * @param {number} state
 * @returns {{ value: number, state: number }} value in [0, 1)
 */
export function nextRandom(state) {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}

/**
 * Fisher-Yates shuffle using the seeded RNG above. Pure: returns a new array and the advanced
 * RNG state, never mutates its input.
 * @template T
 * @param {T[]} items
 * @param {number} rngState
 * @returns {{ shuffled: T[], rngState: number }}
 */
export function shuffle(items, rngState) {
  const out = items.slice();
  let state = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const drawn = nextRandom(state);
    state = drawn.state;
    const j = Math.floor(drawn.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { shuffled: out, rngState: state };
}

// --- revision-mode ranking -------------------------------------------------------------------

/**
 * Three-tier, fully deterministic ranking (no randomness) implementing DESIGN.md §5's
 * "unseen > wrong > long-ago-correct" heuristic:
 *   tier 3 (highest priority): never seen
 *   tier 2: most recent attempt was wrong
 *   tier 1 (lowest priority): most recent attempt was correct
 * Within a tier, items are ordered oldest-`lastAt`-first, so a long-ago-correct item resurfaces
 * before one answered correctly five minutes ago. This is deliberately simple and explainable
 * (a leech list, not spaced repetition) so its fairness is inspectable and its order is exactly
 * reproducible in a test — no sampling, no statistics required to verify it.
 *
 * @param {{id:string}[]} items
 * @param {Record<string, {seen:number, correct:number, lastAt:number|null, lastCorrect:boolean|null}>} history
 * @returns {string[]} item ids, highest priority first
 */
export function revisionRank(items, history) {
  const tierOf = (entry) => {
    if (!entry || entry.seen === 0) return 3;
    return entry.lastCorrect ? 1 : 2;
  };
  return items
    .map((item) => {
      const entry = history[item.id];
      return { id: item.id, tier: tierOf(entry), lastAt: entry?.lastAt ?? 0 };
    })
    .sort((a, b) => b.tier - a.tier || a.lastAt - b.lastAt || a.id.localeCompare(b.id))
    .map((row) => row.id);
}

// --- queue selection per mode ------------------------------------------------------------------

/**
 * @param {any} pack
 * @param {{mode:string, groupId?:string, groupIds?:string[], cognitive?:string, limit?:number,
 *          history?: Record<string, any>, seed:number}} config
 * @returns {{ queue: string[], rngState: number }}
 */
export function selectQueue(pack, config) {
  const allowedGroups = config.groupIds
    ? new Set(config.groupIds)
    : config.groupId
      ? new Set([config.groupId])
      : null; // null = every group in the pack

  const inScope = pack.items.filter((item) => !allowedGroups || allowedGroups.has(item.group));

  switch (config.mode) {
    case "practice": {
      if (!config.groupId) throw new Error("practice mode requires config.groupId");
      const items = pack.items.filter((item) => item.group === config.groupId);
      return { queue: items.map((i) => i.id), rngState: requireSeed(config.seed) };
    }

    case "misconception_duel": {
      const items = inScope.filter((item) => item.cognitive === "misconception");
      const { shuffled, rngState } = shuffle(items, requireSeed(config.seed));
      return { queue: shuffled.map((i) => i.id), rngState };
    }

    case "streak_rush": {
      const { shuffled, rngState } = shuffle(inScope, requireSeed(config.seed));
      return { queue: shuffled.map((i) => i.id), rngState };
    }

    case "revision": {
      const ranked = revisionRank(inScope, config.history || {});
      const queue = config.limit ? ranked.slice(0, config.limit) : ranked;
      return { queue, rngState: requireSeed(config.seed) };
    }

    default:
      throw new Error(`unknown mode: ${config.mode}`);
  }
}

function requireNow(now) {
  if (typeof now !== "number" || !Number.isFinite(now)) {
    throw new Error("action.payload.now must be an explicit ms timestamp (caller-supplied, not read internally)");
  }
  return now;
}

function requireSeed(seed) {
  if (typeof seed !== "number" || !Number.isFinite(seed)) {
    throw new Error("config.seed must be a finite number (explicit — never Math.random() internally)");
  }
  return seed >>> 0;
}

// --- session lifecycle -----------------------------------------------------------------------

/**
 * @param {any} pack
 * @param {{mode:string, now:number, seed:number, timeLimitMs?:number, [key:string]:any}} config
 * @returns {any} State — a plain, JSON-serializable object
 */
export function createSession(pack, config) {
  const { ok, errors } = validatePack(pack);
  if (!ok) throw new Error(`invalid pack: ${errors.join("; ")}`);
  if (!MODES.includes(config.mode)) throw new Error(`unknown mode: ${config.mode}`);
  if (typeof config.now !== "number") {
    throw new Error("config.now must be an explicit ms timestamp (caller-supplied, not read internally)");
  }

  const { queue, rngState } = selectQueue(pack, config);
  const timeLimitMs = config.mode === "streak_rush" ? (config.timeLimitMs ?? DEFAULT_STREAK_RUSH_MS) : null;

  /** @type {any} */
  const state = {
    packId: pack.packId,
    mode: config.mode,
    queue,
    index: 0,
    rngState,
    revealed: false,
    selectedKey: null,
    choiceOrder: null,
    score: { correct: 0, total: 0, streak: 0, bestStreak: 0 },
    log: [],
    startedAt: config.now,
    elapsedMs: 0,
    timeLimitMs,
    status: queue.length > 0 ? "in_progress" : "complete",
  };

  return queue.length > 0 ? withShuffledChoices(state, pack) : state;
}

function withShuffledChoices(state, pack) {
  const item = findItem(pack, state.queue[state.index]);
  const { shuffled, rngState } = shuffle(item.choices, state.rngState);
  return { ...state, choiceOrder: shuffled.map((c) => c.key), rngState };
}

// --- reducer -----------------------------------------------------------------------------------

/**
 * The single state transition. Never mutates its inputs.
 * @param {any} state
 * @param {{type:string, payload?:any}} action  plain, serializable — see DESIGN.md §6
 * @param {any} pack
 * @returns {any} next state
 */
export function reduce(state, action, pack) {
  if (state.status === "complete") return state; // terminal; further actions are no-ops

  switch (action.type) {
    case "ANSWER":
    case "SELF_RATE":
      return applyAnswer(state, action, pack);
    case "NEXT":
      return applyNext(state, pack);
    case "TICK":
      return applyTick(state, action);
    default:
      throw new Error(`unknown action type: ${action.type}`);
  }
}

function applyAnswer(state, action, pack) {
  if (state.revealed) return state; // already answered this item; ANSWER is not re-entrant
  const item = findItem(pack, state.queue[state.index]);
  const now = requireNow(action.payload && action.payload.now);

  let correct;
  if (action.type === "SELF_RATE") {
    if (item.type !== "self_assess") throw new Error(`${item.id}: SELF_RATE on a non-self_assess item`);
    correct = !!action.payload.correct;
  } else {
    correct = action.payload.key === item.answer;
  }

  const streak = correct ? state.score.streak + 1 : 0;
  const score = {
    correct: state.score.correct + (correct ? 1 : 0),
    total: state.score.total + 1,
    streak,
    bestStreak: Math.max(state.score.bestStreak, streak),
  };

  const log = state.log.concat([
    {
      itemId: item.id,
      group: item.group,
      cognitive: item.cognitive,
      type: item.type,
      selectedKey: action.payload.key ?? null,
      correct,
      at: now,
    },
  ]);

  return { ...state, revealed: true, selectedKey: action.payload.key ?? null, score, log };
}

function applyNext(state, pack) {
  if (!state.revealed) return state; // must reveal before advancing
  const index = state.index + 1;
  if (index >= state.queue.length) {
    return { ...state, index, status: "complete", revealed: false, selectedKey: null, choiceOrder: null };
  }
  const advanced = { ...state, index, revealed: false, selectedKey: null };
  return withShuffledChoices(advanced, pack);
}

function applyTick(state, action) {
  if (state.timeLimitMs == null) return state; // ticks are meaningless outside timed modes
  const elapsedMs = Math.max(0, action.payload.now - state.startedAt);
  if (elapsedMs >= state.timeLimitMs) {
    return { ...state, elapsedMs: state.timeLimitMs, status: "complete", revealed: false, choiceOrder: null };
  }
  return { ...state, elapsedMs };
}

// --- view + scoring --------------------------------------------------------------------------

/**
 * @param {any} state
 * @param {any} pack
 * @returns {any} ViewModel — everything app.js needs to render, nothing it needs to compute
 */
export function selectView(state, pack) {
  if (state.status === "complete") {
    return { status: "complete", summary: scoreSession(state) };
  }

  const item = findItem(pack, state.queue[state.index]);
  const choices = (state.choiceOrder || item.choices.map((c) => c.key)).map((key) =>
    item.choices.find((c) => c.key === key)
  );

  return {
    status: "in_progress",
    mode: state.mode,
    progress: { index: state.index, total: state.queue.length },
    score: state.score,
    timeRemainingMs: state.timeLimitMs != null ? Math.max(0, state.timeLimitMs - state.elapsedMs) : null,
    item: {
      id: item.id,
      group: item.group,
      type: item.type,
      cognitive: item.cognitive,
      stem: item.stem,
      choices,
      source: item.source,
    },
    revealed: state.revealed,
    selectedKey: state.selectedKey,
    reveal: state.revealed
      ? {
          answer: item.answer,
          correct: state.selectedKey === item.answer,
          explanation: item.explanation,
          // Misconception Duel puts the correction front and centre per DESIGN.md §5.
          emphasiseCorrection: item.cognitive === "misconception",
        }
      : null,
  };
}

/**
 * @param {any} state
 * @returns {any} Summary — pack-independent; everything comes from state.log
 */
export function scoreSession(state) {
  const byCognitive = {};
  for (const entry of state.log) {
    const bucket = (byCognitive[entry.cognitive] ??= { correct: 0, total: 0 });
    bucket.total += 1;
    if (entry.correct) bucket.correct += 1;
  }
  return {
    mode: state.mode,
    correct: state.score.correct,
    total: state.score.total,
    accuracy: state.score.total > 0 ? state.score.correct / state.score.total : 0,
    bestStreak: state.score.bestStreak,
    byCognitive,
  };
}

// --- persistence bridge (still pure — no localStorage here; app.js reads/writes it) -----------

/**
 * Fold one session's log into a persisted per-item history map. Pure: returns a new object.
 * @param {Record<string, {seen:number, correct:number, lastAt:number|null, lastCorrect:boolean|null}>} history
 * @param {any[]} log  state.log from a finished (or in-progress) session
 * @returns {Record<string, any>}
 */
export function mergeHistory(history, log) {
  const next = { ...history };
  for (const entry of log) {
    const prev = next[entry.itemId] ?? { seen: 0, correct: 0, lastAt: null, lastCorrect: null };
    next[entry.itemId] = {
      seen: prev.seen + 1,
      correct: prev.correct + (entry.correct ? 1 : 0),
      lastAt: entry.at,
      lastCorrect: entry.correct,
    };
  }
  return next;
}
