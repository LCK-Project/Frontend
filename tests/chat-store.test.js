const test = require("node:test");
const assert = require("node:assert/strict");
const { createChatStore } = require("../assets/chat-store.js");
const ask = require("../fixtures/ask_sample.json");

test("initial_state", () => {
  const s = createChatStore();
  assert.deepEqual(s.state(), { turns: [], activeId: null, mode: "chat" });
});

test("ask_adds_loading_turn", () => {
  const s = createChatStore();
  assert.equal(s.ask("q"), "turn-1");
  const st = s.state();
  assert.deepEqual(st.turns[0], { id: "turn-1", question: "q", status: "loading", data: null, error: null });
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
