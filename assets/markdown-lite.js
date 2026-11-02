// LLM 답변에 섞여 오는 가벼운 마크다운(**굵게**, ## 제목, - 목록, 줄바꿈)을 HTML 로 바꾼다.
// 먼저 HTML 을 전부 이스케이프하고 나서 정해진 표기만 태그로 바꾸므로 답변에 태그가 섞여도 실행되지 않는다.
// 브라우저에서는 window.MarkdownLite, Node 에서는 module.exports 로 쓴다.
(function () {
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 한 줄 안의 표기: **굵게**, *기울임*, `코드`
  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }

  function render(text) {
    const lines = escapeHtml(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let list = null; // "ul" | "ol" | null
    let para = [];

    function closeList() {
      if (list) { out.push(`</${list}>`); list = null; }
    }
    function flushPara() {
      if (para.length) { out.push(`<p>${para.join("<br>")}</p>`); para = []; }
    }

    lines.forEach(raw => {
      const line = raw.trimEnd();
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
      const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);

      if (!line.trim()) { flushPara(); closeList(); return; }
      if (heading) {
        flushPara(); closeList();
        const level = Math.min(heading[1].length + 2, 6); // #→h3, ##→h4 … 패널 제목보다 작게
        out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        return;
      }
      if (ul || ol) {
        flushPara();
        const kind = ul ? "ul" : "ol";
        if (list !== kind) { closeList(); out.push(`<${kind}>`); list = kind; }
        out.push(`<li>${inline((ul || ol)[1])}</li>`);
        return;
      }
      closeList();
      para.push(inline(line));
    });
    flushPara();
    closeList();
    return out.join("");
  }

  const MarkdownLite = { render, escapeHtml };
  if (typeof module !== "undefined") module.exports = MarkdownLite; else window.MarkdownLite = MarkdownLite;
})();
