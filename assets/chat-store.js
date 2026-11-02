// 대화 상태 모듈. DOM 과 fetch 를 모르는 순수 상태 저장소다.
// 브라우저에서는 window.ChatStore, Node 에서는 module.exports 로 쓴다.
// 계약은 docs/specs/2026-11-03-chat-mode-design.md 6절에 있다.
(function () {
  function createChatStore() {
    let seq = 0;
    const turns = [];            // Turn[] 추가 순서
    let activeId = null;         // status === "done" 인 턴의 id 또는 null
    let mode = "chat";           // "chat" | "analysis"

    // Turn = { id: string, question: string, status: "loading"|"done"|"error",
    //          data: object|null, error: string|null }

    function find(id) { return turns.find(t => t.id === id) || null; }

    return {
      // 읽기. 반환 객체는 매번 새로 만든다(외부에서 turns 를 직접 바꾸지 못하게).
      state() { return { turns: turns.map(t => ({ ...t })), activeId, mode }; },
      activeTurn() { const t = find(activeId); return t ? { ...t } : null; },
      isLoading() { return turns.some(t => t.status === "loading"); },

      // 질문 추가. 이미 loading 턴이 있으면 null 을 돌려주고 아무것도 바꾸지 않는다.
      ask(question) {
        if (this.isLoading()) return null;
        const id = `turn-${++seq}`;
        turns.push({ id, question, status: "loading", data: null, error: null });
        return id;
      },

      // 응답 도착. 그 턴을 done 으로 바꾸고 활성으로 만든다. 모드는 바꾸지 않는다.
      // 모르는 id 나 loading 이 아닌 턴이면 false.
      resolve(id, data) {
        const t = find(id);
        if (!t || t.status !== "loading") return false;
        t.status = "done"; t.data = data; activeId = id;
        return true;
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

  const ChatStore = { createChatStore };
  if (typeof module !== "undefined") module.exports = ChatStore; else window.ChatStore = ChatStore;
})();
