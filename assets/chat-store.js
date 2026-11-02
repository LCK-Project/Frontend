// 대화 상태 모듈. DOM 과 fetch 를 모르는 순수 상태 저장소다.
// 브라우저에서는 window.ChatStore, Node 에서는 module.exports 로 쓴다.
// 계약은 docs/specs/2026-11-03-chat-mode-design.md 6절과
// Backend/docs/specs/2026-11-03-clarify-design.md 3-6절에 있다.
(function () {
  const DEFAULT_TEMPLATE = "{question} ({option} 기준)";

  // 선택지를 고른 뒤 다시 보낼 질문. 백엔드가 준 축별 형식(template)으로 원래 질문에 범위를 붙인다.
  // template 은 "{question} ({option} 상대 기준)" 처럼 두 자리만 쓴다. 없거나 자리가 빠지면 기본 형식.
  function composeRefinedQuestion(original, option, template) {
    const t = typeof template === "string" && template.includes("{question}") && template.includes("{option}")
      ? template : DEFAULT_TEMPLATE;
    return t.replace("{question}", original).replace("{option}", option);
  }

  function createChatStore() {
    let seq = 0;
    const turns = [];            // Turn[] 추가 순서
    let activeId = null;         // status === "done" 인 턴의 id 또는 null
    let mode = "chat";           // "chat" | "analysis"

    // Turn = { id: string, question: string, status: "loading"|"done"|"error"|"clarify",
    //          data: object|null, error: string|null, skipClarify: boolean, choice: string|null }

    function find(id) { return turns.find(t => t.id === id) || null; }

    return {
      // 읽기. 반환 객체는 매번 새로 만든다(외부에서 turns 를 직접 바꾸지 못하게).
      state() { return { turns: turns.map(t => ({ ...t })), activeId, mode }; },
      activeTurn() { const t = find(activeId); return t ? { ...t } : null; },
      isLoading() { return turns.some(t => t.status === "loading"); },

      // 질문 추가. 이미 loading 턴이 있으면 null 을 돌려주고 아무것도 바꾸지 않는다.
      // skipClarify 는 선택지를 고른 뒤 보내는 두 번째 질문에 붙인다.
      // scope 는 되묻기에서 고른 범위 { axis, value } 또는 null. 그대로 백엔드에 보낸다.
      ask(question, { skipClarify = false, scope = null } = {}) {
        if (this.isLoading()) return null;
        const id = `turn-${++seq}`;
        turns.push({ id, question, status: "loading", data: null, error: null, skipClarify, scope, choice: null });
        return id;
      },

      // 응답 도착. 되묻기(type === "clarify")면 clarify 상태로 두고 활성은 바꾸지 않는다.
      // 그 외는 done 으로 바꾸고 활성으로 만든다. 모드는 바꾸지 않는다.
      // 모르는 id 나 loading 이 아닌 턴이면 false.
      resolve(id, data) {
        const t = find(id);
        if (!t || t.status !== "loading") return false;
        t.data = data;
        if (data && data.type === "clarify") {
          t.status = "clarify";
        } else {
          t.status = "done"; activeId = id;
        }
        return true;
      },

      // 되묻기 선택지 고르기. clarify 턴에서 처음 한 번만 받고,
      // 다시 보낼 { question: 합친 질문, scope: { axis, value } } 를 돌려준다. 아니면 null.
      choose(id, option) {
        const t = find(id);
        if (!t || t.status !== "clarify" || t.choice !== null) return null;
        t.choice = option;
        const clarify = (t.data && t.data.clarify) || {};
        return {
          question: composeRefinedQuestion(t.question, option, clarify.template),
          scope: { axis: clarify.axis || null, value: option }
        };
      },

      // 실패. 활성은 바꾸지 않는다. 모르는 id 나 loading 이 아닌 턴이면 false.
      fail(id, message) {
        const t = find(id);
        if (!t || t.status !== "loading") return false;
        t.status = "error"; t.error = message;
        return true;
      },

      // "분석 보기". done 턴만 활성이 되고 모드가 analysis 로 바뀐다. 아니면 false.
      activate(id) {
        const t = find(id);
        if (!t || t.status !== "done") return false;
        activeId = id; mode = "analysis";
        return true;
      },

      // 모드 전환. "chat" | "analysis" 외는 무시하고 false.
      setMode(next) {
        if (next !== "chat" && next !== "analysis") return false;
        mode = next;
        return true;
      }
    };
  }

  const ChatStore = { createChatStore, composeRefinedQuestion };
  if (typeof module !== "undefined") module.exports = ChatStore; else window.ChatStore = ChatStore;
})();
