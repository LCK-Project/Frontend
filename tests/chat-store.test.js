const test = require("node:test");
const assert = require("node:assert/strict");
const { createChatStore, composeRefinedQuestion } = require("../assets/chat-store.js");
const ask = require("../fixtures/ask_sample.json");

test("initial_state", () => {
  const s = createChatStore();
  assert.deepEqual(s.state(), { turns: [], activeId: null, mode: "chat" });
});

test("ask_adds_loading_turn", () => {
  const s = createChatStore();
  assert.equal(s.ask("q"), "turn-1");
  const st = s.state();
  assert.deepEqual(st.turns[0], { id: "turn-1", question: "q", status: "loading", data: null, error: null, skipClarify: false, choice: null });
  assert.equal(st.activeId, null);
});

test("ask_rejected_while_loading", () => {
  const s = createChatStore();
  s.ask("q1");
  assert.equal(s.ask("q2"), null);
  assert.equal(s.state().turns.length, 1);
});

test("resolve_marks_done_and_activates", () => {
  const s = createChatStore();
  const id = s.ask("q");
  assert.equal(s.resolve(id, ask), true);
  const st = s.state();
  assert.equal(st.turns[0].status, "done");
  assert.equal(st.turns[0].data, ask);
  assert.equal(st.activeId, "turn-1");
  assert.equal(st.mode, "chat");
});

test("resolve_unknown_or_not_loading_is_false", () => {
  const s = createChatStore();
  assert.equal(s.resolve("nope", ask), false);
  const id = s.ask("q");
  s.resolve(id, ask);
  const before = s.state();
  assert.equal(s.resolve(id, { other: 1 }), false);
  assert.deepEqual(s.state(), before);
});

test("fail_keeps_previous_active", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  const id2 = s.ask("q2");
  assert.equal(s.fail(id2, "x"), true);
  const st = s.state();
  assert.equal(st.turns[1].status, "error");
  assert.equal(st.turns[1].error, "x");
  assert.equal(st.activeId, "turn-1");
});

test("ask_allowed_after_fail", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  s.fail(s.ask("q2"), "x");
  assert.equal(s.ask("q3"), "turn-3");
});

test("latest_resolved_becomes_active", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  s.resolve(s.ask("q2"), ask);
  assert.equal(s.state().activeId, "turn-2");
});

test("activate_done_turn_switches_to_analysis", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  s.resolve(s.ask("q2"), ask);
  assert.equal(s.activate("turn-1"), true);
  const st = s.state();
  assert.equal(st.activeId, "turn-1");
  assert.equal(st.mode, "analysis");
});

test("activate_rejects_loading_and_error", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  const id2 = s.ask("q2");
  assert.equal(s.activate(id2), false);
  s.fail(id2, "x");
  assert.equal(s.activate(id2), false);
  const st = s.state();
  assert.equal(st.activeId, "turn-1");
  assert.equal(st.mode, "chat");
});

test("setMode_validates", () => {
  const s = createChatStore();
  assert.equal(s.setMode("analysis"), true);
  assert.equal(s.setMode("chat"), true);
  assert.equal(s.setMode("foo"), false);
  assert.equal(s.state().mode, "chat");
});

test("state_returns_copies", () => {
  const s = createChatStore();
  s.ask("q");
  s.state().turns[0].question = "x";
  assert.equal(s.state().turns[0].question, "q");
});

test("activeTurn_null_until_resolve", () => {
  const s = createChatStore();
  const id = s.ask("q");
  assert.equal(s.activeTurn(), null);
  s.resolve(id, ask);
  assert.equal(s.activeTurn().id, "turn-1");
});

// ---------- 범위 되묻기 ----------
const clarify = require("../fixtures/clarify_sample.json");

test("ask_records_skipClarify", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  assert.equal(s.state().turns[0].skipClarify, false);
  s.ask("q2", { skipClarify: true });
  assert.equal(s.state().turns[1].skipClarify, true);
});

test("resolve_clarify_keeps_active", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  const id2 = s.ask("q2");
  assert.equal(s.resolve(id2, clarify), true);
  const st = s.state();
  assert.equal(st.turns[1].status, "clarify");
  assert.equal(st.turns[1].data, clarify);
  assert.equal(st.activeId, "turn-1");
  assert.equal(s.isLoading(), false);
});

test("choose_returns_composed_question_once", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  const id2 = s.ask("q2");
  s.resolve(id2, clarify);
  assert.equal(s.choose(id2, "2025 LCK Cup"), "q2 (2025 LCK Cup 기준)");
  assert.equal(s.state().turns[1].choice, "2025 LCK Cup");
  assert.equal(s.choose(id2, "2026 LCK Cup"), null);
  assert.equal(s.state().turns[1].choice, "2025 LCK Cup");
});

test("choose_rejects_non_clarify", () => {
  const s = createChatStore();
  const id1 = s.ask("q1");
  assert.equal(s.choose(id1, "x"), null);
  s.resolve(id1, ask);
  assert.equal(s.choose(id1, "x"), null);
  assert.equal(s.choose("nope", "x"), null);
});

test("activate_rejects_clarify", () => {
  const s = createChatStore();
  s.resolve(s.ask("q1"), ask);
  const id2 = s.ask("q2");
  s.resolve(id2, clarify);
  assert.equal(s.activate(id2), false);
  const st = s.state();
  assert.equal(st.activeId, "turn-1");
  assert.equal(st.mode, "chat");
});

test("composeRefinedQuestion", () => {
  assert.equal(composeRefinedQuestion("T1의 전략이 궁금해", "2025 LCK Cup"), "T1의 전략이 궁금해 (2025 LCK Cup 기준)");
});

test("clarify_fixture_shape", () => {
  assert.equal(clarify.type, "clarify");
  assert.ok(["tournament", "season"].includes(clarify.clarify.axis));
  assert.ok(typeof clarify.clarify.prompt === "string" && clarify.clarify.prompt.length > 0);
  assert.ok(Array.isArray(clarify.clarify.options) && clarify.clarify.options.length >= 2);
});
