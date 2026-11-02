const test = require("node:test");
const assert = require("node:assert/strict");
const { render } = require("../assets/markdown-lite.js");

test("bold_and_headings", () => {
  assert.equal(render("## 핵심\nT1은 **메타 적응력**이 강점"), "<h4>핵심</h4><p>T1은 <strong>메타 적응력</strong>이 강점</p>");
});

test("heading_levels_shift_below_panel_titles", () => {
  assert.equal(render("# 제목"), "<h3>제목</h3>");
  assert.equal(render("### 소제목"), "<h5>소제목</h5>");
  assert.equal(render("###### 깊이"), "<h6>깊이</h6>");
});

test("paragraphs_and_line_breaks", () => {
  assert.equal(render("첫 줄\n둘째 줄\n\n새 문단"), "<p>첫 줄<br>둘째 줄</p><p>새 문단</p>");
});

test("unordered_and_ordered_lists", () => {
  assert.equal(render("- 하나\n- **둘**\n\n1. 첫\n2) 둘"), "<ul><li>하나</li><li><strong>둘</strong></li></ul><ol><li>첫</li><li>둘</li></ol>");
});

test("list_switch_closes_previous", () => {
  assert.equal(render("- a\n1. b"), "<ul><li>a</li></ul><ol><li>b</li></ol>");
});

test("italic_and_code", () => {
  assert.equal(render("*기울임* 과 `코드`"), "<p><em>기울임</em> 과 <code>코드</code></p>");
  assert.equal(render("**굵게** 안의 별은 기울임 아님"), "<p><strong>굵게</strong> 안의 별은 기울임 아님</p>");
});

test("html_is_escaped_before_markup", () => {
  assert.equal(render("<script>alert(1)</script> **x**"), "<p>&lt;script&gt;alert(1)&lt;/script&gt; <strong>x</strong></p>");
  assert.equal(render('a & b "c"'), "<p>a &amp; b &quot;c&quot;</p>");
});

test("empty_and_null", () => {
  assert.equal(render(""), "");
  assert.equal(render(null), "");
  assert.equal(render("\n\n"), "");
});

test("plain_text_unchanged_inside_paragraph", () => {
  assert.equal(render("그냥 문장"), "<p>그냥 문장</p>");
});
