# 채팅 모드 전환 · 설계 문서

작성일 2026-11-03. 대상 저장소 `Frontend`(단일 `index.html`, 빌드 도구 없음).

## 1. 의도

지금 대시보드는 질문 하나에 답변 하나가 덮어쓰이는 구조라서, 연달아 질문해도 대화가 이어지는
느낌이 없다. 사용자는 질문과 답변이 채팅처럼 아래로 쌓이기를 원하고, 그래프·근거 같은 분석
화면은 탭으로 빼서 오가며 보기를 원한다.

백엔드 `POST /ask` 는 `question` 하나만 받고 이전 대화를 모른다. 이번 작업은 **화면이 채팅처럼
쌓이는 것까지**다. 뒤 질문이 앞 대화를 실제로 이어받는 것은 비범위다(사용자 결정, 2026-11-03).

## 2. 목표 · 비범위 · 안티목표

**목표** (모두 `?mock=1` 목 모드에서 백엔드 없이 확인 가능해야 한다)

- 질문을 보내면 오른쪽 패널에 질문 말풍선과 답변 말풍선이 아래로 쌓이고, 이전 대화는 지워지지
  않는다.
- 답변 말풍선마다 "분석 보기" 동작이 있다. 누르면 오른쪽 패널이 분석 모드로 바뀌고 왼쪽 그래프
  패널과 분석 모드의 내용이 **그 답변의 데이터**로 바뀐다.
- 오른쪽 패널은 "채팅"과 "분석" 두 모드를 오갈 수 있다. 분석 모드는 지금 오른쪽에 있는
  선택한 노드, 답변 / 지식그래프 근거 / RDB 근거 탭을 그대로 보여준다.
- 왼쪽 지식그래프 패널(통계 카드, 엔티티 레일, 관계 필터 칩, 그래프, 날짜 스트립)은 위치와
  기능을 그대로 둔다. 채팅 모드일 때도 계속 떠 있다.
- 기존 테스트 `node --test "tests/*.test.js"` 는 계속 통과한다.

**비범위**

- 백엔드 변경 전부. 대화 맥락 전달, 세션 저장, 새 API.
- 대화 내용을 새로고침 뒤까지 남기기(localStorage 등).
- 1100px 이하 한 열 배치의 재설계. 지금처럼 한 열로 떨어지기만 하면 된다.

**안티목표** (이게 되면 기술적으로 돌아가도 실패다)

- 새 질문을 보냈더니 이전 질문·답변이 사라진다.
- "분석 보기"를 눌렀는데 왼쪽 그래프는 다른 답변 것이 남아 있다(왼쪽과 오른쪽이 다른 답변을
  가리킨다).
- 그래프 패널의 레일·칩·스트립·노드 상세 연동이 깨진다.

## 3. 제약

- 빌드 도구·패키지 설치 없음. CDN 은 기존 vis-network 하나.
- 순수 로직은 `assets/*.js` 로 빼고 Node 24 내장 러너로 검증한다(`graph-utils.js` 와 같은 패턴:
  브라우저에서는 `window.X`, Node 에서는 `module.exports`).
- 읽는 응답 키는 지금 `index.html` 이 읽는 것만(`answer, graph, graph_facts, rdb_answer,
  rdb_facts, rdb_entities, rdb_sql, article_chunks`). 새 키를 만들어 읽지 않는다.
- `fixtures/*.json`, `config.js` 수정 금지. 목 모드는 어떤 질문에도 `fixtures/ask_sample.json`
  을 돌려주므로 대화가 쌓여도 데이터는 같다. 이건 허용한다.
- 산문에 대시 금지, 커밋·주석 한국어(전역 규칙).

## 4. 접근 방식

| 안 | 내용 | 평가 |
|---|---|---|
| A | `index.html` 안에 채팅 목록 DOM, 모드 토글, 답변별 데이터 배열을 바로 넣는다 | 가장 빠르지만 1,552줄 파일이 더 커지고 대화 상태 로직을 자동 테스트로 못 잡는다 |
| **B (채택)** | 대화 상태만 `assets/chat-store.js` 순수 모듈로 빼고 `index.html` 은 화면 연결만 한다 | 프로젝트가 이미 쓰는 패턴. 뒤에 맥락 이어받기를 붙일 때 이 모듈만 늘리면 된다 |
| C | 프레임워크 도입 | nginx 정적 서빙·무빌드 전제와 어긋나 제외 |

사용자가 B 를 골랐다(2026-11-03).

## 5. 결정된 사항

### 5-1. 화면 (사용자가 목업으로 확인한 것)

- 두 열 유지. 왼쪽 = 지식그래프 패널 고정. 오른쪽 = 채팅 ↔ 분석 모드 전환.
- 채팅 모드: 질문·답변 말풍선이 위에서 아래로 쌓이고, 입력창은 아래에 있다. 답변 말풍선에
  "분석 보기" 버튼이 있다.
- 분석 모드: 위에 어느 질문의 분석인지 한 줄, 그 아래 선택한 노드, 그 아래 답변 / 지식그래프
  근거 / RDB 근거 탭. 모두 지금 오른쪽 패널에 있는 것 그대로다.
- "분석 보기"를 누르면 오른쪽이 분석 모드로 바뀌고 왼쪽 그래프도 그 답변 데이터로 바뀐다.

### 5-2. 활성 답변 규칙 (작성자 제안, 사용자 동의)

- "활성 답변"은 하나다. 왼쪽 그래프 패널과 분석 모드는 항상 활성 답변의 데이터를 보여준다.
- 새 답변이 도착하면 그 답변이 활성이 된다. 모드는 바꾸지 않는다(채팅 모드면 채팅 모드 그대로.
  사용자는 말풍선에서 답을 읽고, 왼쪽 그래프만 새 답변으로 바뀐다).
- "분석 보기"는 그 답변을 활성으로 만들고 모드를 분석으로 바꾼다.
- 활성 답변이 바뀌면 선택한 노드는 초기화한다(다른 그래프의 노드이므로). 답변 / 근거 / RDB
  탭 선택은 유지한다.

### 5-3. 작성자가 정한 세부 (사용자 미확인, 틀리면 고친다)

- **한 번에 하나만 요청한다.** 답변을 기다리는 동안 입력창과 전송 버튼은 비활성이다. 동시
  요청의 순서 꼬임을 피하는 가장 단순한 길이다.
- 로딩 중에는 답변 자리에 로딩 말풍선이 뜬다. 실패하면 그 자리에 오류 말풍선이 남고 "분석
  보기"는 없다. 실패한 턴은 활성이 되지 않는다(왼쪽 그래프는 직전 활성 답변 그대로).
- 기존의 `askBox` 접기 / `askSummary` 한 줄 요약 / "새 질문" 버튼은 없앤다. 채팅 목록이 그
  역할을 대신한다.
- 제안 질문 버튼 4개는 대화가 비어 있을 때만 채팅 영역 안에 보여준다.
- 답변 말풍선 본문은 `data.answer` 전체다. 접지 않는다.
- 설계 문서 위치는 `Frontend/docs/specs/` 다. 이전 스펙은 저장소 밖 절대 경로였고 worktree 에서
  안 보이는 문제가 있어 저장소 안으로 옮겼다.

## 6. 공유 계약: `assets/chat-store.js`

DOM·fetch 를 모르는 순수 상태 모듈. `index.html` 과 테스트가 함께 의존하므로 시그니처를 고정한다.

```js
// assets/chat-store.js
// 브라우저: window.ChatStore, Node: module.exports
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
```

`tests/chat-store.test.js` (전량. 픽스처는 `fixtures/ask_sample.json` 하나만 `data` 로 쓴다)

| 테스트 이름 | 단언 |
|---|---|
| `initial_state` | `state()` 가 `{ turns: [], activeId: null, mode: "chat" }` |
| `ask_adds_loading_turn` | `ask("q")` 가 `"turn-1"` 을 돌려주고 `turns[0]` 이 `{ id:"turn-1", question:"q", status:"loading", data:null, error:null }`, `activeId` 는 여전히 `null` |
| `ask_rejected_while_loading` | 첫 `ask` 뒤 두 번째 `ask` 가 `null` 이고 `turns.length === 1` |
| `resolve_marks_done_and_activates` | `resolve("turn-1", ask)` 가 `true`, 턴이 `done`, `data === ask`, `activeId === "turn-1"`, `mode` 는 `"chat"` 그대로 |
| `resolve_unknown_or_not_loading_is_false` | `resolve("nope", ask)` 가 `false`; done 턴에 다시 `resolve` 해도 `false` 이고 상태 불변 |
| `fail_keeps_previous_active` | 턴1 resolve 후 턴2 ask → `fail("turn-2","x")` 가 `true`, 턴2 가 `error` 이고 `error === "x"`, `activeId === "turn-1"` |
| `ask_allowed_after_fail` | 위 상태에서 `ask("q3")` 가 `"turn-3"` |
| `latest_resolved_becomes_active` | 턴1·턴2 차례로 resolve 하면 `activeId === "turn-2"` |
| `activate_done_turn_switches_to_analysis` | `activate("turn-1")` 이 `true`, `activeId === "turn-1"`, `mode === "analysis"` |
| `activate_rejects_loading_and_error` | loading 턴과 error 턴에 `activate` 가 모두 `false` 이고 `activeId`·`mode` 불변 |
| `setMode_validates` | `setMode("chat")` 이 `true`; `setMode("foo")` 가 `false` 이고 `mode` 불변 |
| `state_returns_copies` | `state().turns[0].question = "x"` 로 바꿔도 다음 `state()` 의 값은 원래 그대로 |
| `activeTurn_null_until_resolve` | ask 직후 `activeTurn() === null`, resolve 뒤 `activeTurn().id === "turn-1"` |

## 7. 화면 요구사항 (규약 7절. 배치·문구·클래스는 실행자 재량, 사용자 확인으로 바뀐다)

`index.html` 이 만족해야 할 행동. DOM 구조나 문구를 고정하지 않는다.

1. 오른쪽 패널에 채팅 / 분석 모드 전환 수단이 있고, 처음은 채팅 모드다.
2. 채팅 모드: 전송하면 `ChatStore.ask` → `loadAsk` → 성공 시 `resolve`, 실패 시 `fail`.
   말풍선 목록은 항상 `store.state().turns` 를 그려서 만든다(상태가 진실, DOM 은 결과).
3. 로딩 중에는 입력과 전송이 비활성이고 로딩 말풍선이 보인다.
4. done 말풍선에는 "분석 보기"가 있고, 누르면 `store.activate(id)` 뒤 다시 그린다.
5. 활성 답변이 바뀔 때마다(resolve 또는 activate) 기존 `renderStats, renderGraph, renderRail,
   renderFilterChips, renderDateStrip, renderRdb, renderFacts` 를 활성 답변 `data` 로 호출하고
   `resetNodeDetail()` 을 부른다. 이 함수들은 시그니처를 바꾸지 않는다.
6. 분석 모드는 기존 `nodeDetail`, 탭 3개, `answer`·`chunks`·`rdbAnswer`·`rdbFacts` 영역을 그대로
   쓰고, 위에 활성 답변의 질문을 한 줄 보여준다.
7. 활성 답변이 없을 때(첫 질문 전, 또는 첫 질문이 실패) 분석 모드는 빈 상태 문구를 보여주고
   왼쪽 패널은 지금의 초기 상태 그대로다.
8. 제안 질문 버튼은 대화가 비어 있을 때만 보인다. 누르면 입력창에 채운다(기존 `setQuestion`).
9. `queryStatus`·`apiStatus` 문구 갱신은 기존 의미를 유지한다.
10. `?mock=1` 에서 질문 세 번 → 말풍선 6개, "분석 보기" 세 개, 어느 것을 눌러도 분석 모드로 가고
    콘솔 에러 0.
11. 1100px 이하에서 한 열로 떨어지고 채팅 입력이 가려지지 않는다.

## 8. 실행 모델 요약 (구현 계획에서 상세화)

- 화면 하나·파일 두 개(`index.html`, `chat-store.js`)라 터미널 1개, worktree 1개
  (`Frontend/.claude/worktrees/lck-chat-mode`, 브랜치 `feat/chat-mode`).
- 태스크는 규약 7절대로 셋: ① 계약(`chat-store.js` + 테스트 전량) ② 화면 초안(`index.html`,
  요구사항 7절만) ③ 확정(사용자가 "확정" 한 뒤 README 갱신, 최종 화면 단언 테스트가 필요하면 추가).
- ② 와 ③ 사이에 오케스트레이터 자체 점검(목 모드 실제 화면, 실제 백엔드 1회)과 사용자 확인
  루프가 있다.
- 모델: 전부 표준 모델(`claude-opus-5-5` 추론 medium). 상위 모델이 필요한 판단 로직이 없다.
  계약 모듈은 이 문서가 코드로 고정했다.

## 9. 빌더에게 맡기는 것

- 말풍선·모드 전환·입력창의 마크업, 클래스 이름, 문구, 스타일.
- 채팅 목록 자동 스크롤 여부와 방식.
- `askBox`·`askSummary`·`newQuestion` 관련 CSS 정리 범위.
- 한 열 폴백에서 채팅 패널과 그래프 패널의 순서.
