# 그래프 패널 개편 안 1 · 프론트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Frontend/index.html`의 그래프 열과 답변 열 상단을 안 1(엔티티 레일, 관계 필터 칩, 경기 날짜 스트립, 노드 상세 고정 카드, 근거 카드 hover 연동, 통계 칩 분리)대로 바꾼다. 백엔드 없이 픽스처(`?mock=1`)만으로 끝까지 동작한다.

**Architecture:** 빌드 도구 없는 단일 페이지를 유지한다. 입력과 출력만 있는 로직(관계 묶음 판정, 레일 정렬, 통계 집계, 날짜 스트립 좌표, 로컬 1홉 상세)은 `assets/graph-utils.js`로 빼서 Node 내장 테스트 러너로 검증하고, DOM과 vis-network를 만지는 코드만 `index.html`에 남긴다. 모든 데이터는 `/ask` 응답의 `graph` 필드와 `/node` 응답 두 계약만 읽는다.

**Tech Stack:** HTML/CSS/vanilla JS, vis-network(CDN, 기존), Node 24 `node --test`(테스트 전용, 패키지 설치 없음), Python `http.server`(정적 서빙).

**Spec:** `/Users/doo._.hyun/Study/Project/lck/docs/graph-panel-option1-spec.md` (저장소 밖 절대 경로. 3절 화면 사양, 4-1·4-2·4-3·4-4 공유 계약, 6절 프론트 태스크, 6-2 수동 체크리스트)

## Global Constraints

- 새 패키지 설치 금지. CDN 스크립트는 기존 vis-network 하나만.
- 응답에서 읽는 키는 스펙 4-1(`graph.nodes[]`: `id, name, label, degree, is_seed, match_date, props`, `graph.links[]`: `source, target, type, evidence`)과 4-3(`/node`)에 있는 것만. 없는 키를 만들어 읽지 않는다.
- 세 열 그리드 `300px minmax(0, 1fr) 380px`, 각 `.panel`에 `min-width: 0`. 1100px 이하 한 열 폴백 유지.
  (2026-10-11 완주 뒤 사용자 요청으로 두 열 `minmax(0, 7fr) minmax(0, 3fr)`로 바꿨다. 왼쪽이 그래프, 오른쪽이 질의 입력과 결과다. 폴백은 그대로.)
- vis 옵션 `layout.randomSeed = 42`, `physics.stabilization.iterations = 200`. `opacity` 옵션으로 흐림 처리하지 않는다(색 치환 + `baseColors` 복원).
- `index.html` 함수 이름 고정: `loadAsk, renderStats, renderRail, renderFilterChips, applyRelationFilter, renderDateStrip, renderGraph, highlightNodes, clearHighlight, showNodeDetail, renderFacts`. 전역 상태는 `state = { network, nodes, edges, baseColors, nodesById, graph }` 하나.
- 라벨 한글명: Team 팀, Player 선수, Champion 챔피언, Tournament 대회, League 리그, Match 경기, Staff 스태프, Coach 코치, Objective 오브젝트, Object 오브젝트, Entity 엔티티. 그 외 원문.
- 커밋 메시지·주석은 한국어. 산문에 대시(—) 금지. 각 커밋 끝에 실제로 그 커밋을 작성한 모델의 `Co-Authored-By` 트레일러를 넣는다(2026-10-11 사용자 결정. 처음 문구는 `Claude Fable 5.1` 고정이었다).
- `fixtures/*.json`과 `config.js`는 수정 금지.
- 테스트 명령은 `node --test "tests/*.test.js"`로 고정한다. Node 24에서 `node --test tests/`는 디렉터리를 모듈로 읽으려다 `Cannot find module`로 실패하고, 인자 없는 `node --test`는 `.claude/worktrees/` 아래 사본까지 주워 온다.

## Review Focus

1. `graph.nodes`가 빈 배열인 응답: 레일·칩·스트립·통계 모두 "없음" 문구를 내고 콘솔 에러 0. (Task 4·5·6·7 테스트 `*_empty_graph`)
2. `match_date`가 `null`인 Match 노드(백엔드가 날짜를 못 채운 경우): 스트립에서 제외하고 레일에는 `경기 · 날짜 없음`으로 표시. (Task 2 `dateStripLayout_skips_null_date`, `railSubtitle_match_without_date`)
3. `graph_facts`의 `source`·`target` 이름과 같은 이름의 노드가 2개 이상(동명이인): 첫 매치만 강조하고 에러 없이 끝난다. (Task 9 `factNodeIds_first_match_wins`)
4. `links`가 `nodes`에 없는 id를 가리키는 깨진 간선: `classifyRelation`의 라벨 규칙이 `undefined`를 만나도 던지지 않고 "기타"로 분류. (Task 2 `classifyRelation_dangling_endpoint_is_etc`)
5. `/node` 요청 실패(네트워크 오류, 404): 카드에 실패 문구 + 로컬 1홉 폴백, 그래프 포커스는 그대로 수행. (Task 8 수동 체크 + `localNodeDetail` 테스트)

---

## 실행 모델과 터미널 분할

메인 세션은 오케스트레이터다. Task 1(픽스처·플랜 커밋)은 오케스트레이터가 루트 `main`에서 직접 하고, Task 2~9는 터미널 1개(worktree 1개, 브랜치 `feat/graph-panel`)가 순서대로 한다. 모든 태스크가 `index.html` 한 파일을 고치므로 병렬 분할하지 않는다. 각 태스크 끝에 오케스트레이터가 리뷰하고, Task 9 뒤에 Opus 5.5 리뷰어가 브랜치 전체를 본다.

| 웨이브 | 태스크 | 실행자 | 산출 |
|---|---|---|---|
| W0 | Task 1 픽스처 + `.gitignore` + 플랜 커밋 | 오케스트레이터(main) | 기점 커밋 `<BASE>` |
| W1 | Task 2~9 | 터미널 1 (Sonnet 5.5) · worktree `Frontend/.claude/worktrees/lck-graph-panel` | 브랜치 `feat/graph-panel` |
| W2 | 전체 리뷰 → 수정 → `main` 머지 | 오케스트레이터 + 리뷰어(Opus 5.5) | 머지 커밋 |

사람 사전 조건 2줄: `cd Frontend && git log --oneline -1`이 Task 1 커밋인지, `git status --short`가 비어 있는지.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `index.html` | 마크업·스타일·DOM/vis 조작. `GraphUtils`를 호출만 한다 |
| `assets/graph-utils.js` | 순수 함수. 브라우저에서는 `window.GraphUtils`, Node에서는 `module.exports` |
| `fixtures/ask_sample.json` | `/ask` 응답 픽스처(스펙 4-4). 수정 금지 |
| `fixtures/node_sample.json` | `/node` 응답 픽스처 2건. 수정 금지 |
| `tests/fixtures.test.js` | 픽스처가 스펙 수치와 맞는지 |
| `tests/graph-utils.test.js` | 순수 함수 단위 테스트 |
| `README.md` | `?mock=1`, 테스트 명령, 읽는 응답 필드 표 |

`assets/graph-utils.js` 공개 함수(모두 Task 2에서 정의, 이후 태스크는 호출만):

```js
classifyRelation(link, nodesById, relGroups)  // -> 묶음 이름 문자열. REL_GROUPS 순서로 판정, 마지막은 "기타"
visibleSetForGroup(graph, groupName, relGroups) // -> { linkKeys: Set<"src|tgt|type">, nodeIds: Set<string> }. "전체"면 모두
sortNodesForRail(nodes)                       // -> degree desc, 같으면 name을 localeCompare("ko") asc
railSubtitle(node)                            // -> "선수 · 관계 2" | "경기 · 09.06" | "경기 · 날짜 없음"
labelKo(label)                                // -> 한글명 또는 원문
computeStats(data)                            // -> { seeds: string[], matchCount, linkCount, period: "2025.01 ~ 2025.09" | "-", articleCount }
dateStripLayout(nodes, width, pad)            // -> { points: [{id, x, date}], minLabel, maxLabel }  (match_date null·비Match 제외, 1개면 가운데)
localNodeDetail(nodeId, graph)                // -> 스펙 4-3 형태(record·match는 null, groups는 그래프 1홉으로)
factNodeIds(fact, nodes)                      // -> { sourceId, targetId } (이름 첫 매치, 없으면 null)
REL_GROUPS                                    // 스펙 4-2 표 순서의 배열 [{name, types: string[], labelRule?: ["Objective","Object"]}]
LABEL_KO                                      // 라벨 한글명 맵
```

---

### Task 1: 픽스처와 작업 공간 준비 (오케스트레이터, `main`)

**Files:**
- Create: `fixtures/ask_sample.json`, `fixtures/node_sample.json`, `tests/fixtures.test.js`, `docs/plans/2026-10-11-graph-panel-option1-frontend.md`(이 문서)
- Modify: `.gitignore`(`.claude/` 추가)

**Interfaces:**
- Produces: 픽스처 두 파일. id는 `"mock:1"`~`"mock:18"`. 아래 표가 계약이다.

픽스처 노드 18개 (`id | name | label | degree | is_seed | match_date | props`):

```
mock:1  | 한화생명 이스포츠            | Team       | 16 | true  | null | {}
mock:2  | 젠지 이스포츠                | Team       | 4  | false | null | {}
mock:3  | 제카                         | Player     | 2  | false | null | {}
mock:4  | 바이퍼                       | Player     | 2  | false | null | {}
mock:5  | 딜라이트                     | Player     | 1  | false | null | {}
mock:6  | 피넛                         | Player     | 2  | false | null | {}
mock:7  | 제우스                       | Player     | 1  | false | null | {}
mock:8  | 쵸비                         | Player     | 2  | false | null | {}
mock:9  | GEN vs HLE · 2025-09-06      | Match      | 5  | false | 2025-09-06 | {match_stage:"Playoffs", score_a:1, score_b:3, best_of:5, team_a_key:"TEAM_GEN", team_b_key:"TEAM_HLE", winner_key:"TEAM_HLE"}
mock:10 | HLE vs T1 · 2025-08-30       | Match      | 2  | false | 2025-08-30 | {match_stage:"Regular", score_a:2, score_b:1, best_of:3, team_a_key:"TEAM_HLE", team_b_key:"TEAM_T1", winner_key:"TEAM_HLE"}
mock:11 | HLE vs KT · 2025-04-20       | Match      | 2  | false | 2025-04-20 | {match_stage:"Regular", score_a:2, score_b:0, best_of:3, team_a_key:"TEAM_HLE", team_b_key:"TEAM_KT", winner_key:"TEAM_HLE"}
mock:12 | HLE vs DK · 2025-01-15       | Match      | 1  | false | 2025-01-15 | {match_stage:"Regular", score_a:1, score_b:2, best_of:3, team_a_key:"TEAM_HLE", team_b_key:"TEAM_DK", winner_key:"TEAM_DK"}
mock:13 | 아지르                       | Champion   | 1  | false | null | {}
mock:14 | 바루스                       | Champion   | 1  | false | null | {}
mock:15 | 오리아나                     | Champion   | 1  | false | null | {}
mock:16 | 김정수                       | Staff      | 1  | false | null | {}
mock:17 | 전령                         | Objective  | 2  | false | null | {}
mock:18 | LCK 2025 Summer              | Tournament | 2  | false | null | {}
```

픽스처 간선 24개 (`source → target | type | evidence`). 1~16은 `evidence: null`, 17~24는 evidence 객체(`article_key: "ARTICLE_MOCK_<번호>"`, `text`: 한 문장, `confidence: 1.0`):

```
 1 mock:3  → mock:1  | MEMBER_OF
 2 mock:4  → mock:1  | MEMBER_OF
 3 mock:5  → mock:1  | MEMBER_OF
 4 mock:6  → mock:1  | MEMBER_OF
 5 mock:7  → mock:1  | MEMBER_OF
 6 mock:8  → mock:2  | MEMBER_OF
 7 mock:16 → mock:1  | WORKED_FOR
 8 mock:1  → mock:9  | WON_MATCH
 9 mock:2  → mock:9  | LOST_MATCH
10 mock:1  → mock:10 | WON_MATCH
11 mock:1  → mock:11 | WON_MATCH
12 mock:1  → mock:12 | LOST_MATCH
13 mock:1  → mock:9  | PLAYED_MATCH
14 mock:2  → mock:9  | PLAYED_MATCH
15 mock:1  → mock:10 | PLAYED_MATCH
16 mock:1  → mock:11 | PLAYED_MATCH
17 mock:3  → mock:13 | PICKED_CHAMPION      | ev
18 mock:4  → mock:14 | PICKED_CHAMPION      | ev
19 mock:8  → mock:15 | PICKED_CHAMPION      | ev
20 mock:1  → mock:17 | CAPTURED             | ev
21 mock:1  → mock:2  | DEFEATED             | ev
22 mock:9  → mock:18 | PART_OF_TOURNAMENT   | ev
23 mock:1  → mock:18 | PARTICIPATED_IN      | ev
24 mock:6  → mock:17 | SECURED              | ev   (목록에 없는 타입. Objective 라벨 규칙으로 "전략·오브젝트"에 들어가야 한다)
```

`ask_sample.json`의 나머지 키: `question: "한화생명 우승 전략을 알려줘"`, `intent`, `graph_keyword: ["한화생명"]`, `kg_keywords: ["한화생명"]`, `answer`(두 문장 자리표시), `article_answer`, `graph_answer`, `rdb_answer`(각 한 문장), `answer_source: "hybrid"`, `related_chunks: []`, `article_chunks: ["기사 청크 1", "기사 청크 2", "기사 청크 3"]`, `graph_facts`: 간선 24개를 `{source(이름), source_label, relation, target(이름), target_label, evidence}`로 옮긴 24개, `rdb_entities: {players: [], teams: []}`, `rdb_facts: []`, `rdb_sql: null`.

`node_sample.json` (키 = 노드 id):
- `"mock:1"`: `name "한화생명 이스포츠", label "Team", degree 48, record {wins: 88, losses: 37}, match null, groups` = `MEMBER_OF in`(제카 MID, 바이퍼 BOT, 딜라이트 SUP, 피넛 JGL, 제우스 TOP: `role` 채움), `PLAYED_MATCH out`(mock:9, 10, 11), `WON_MATCH out`(mock:9, 10, 11), `LOST_MATCH out`(mock:12), `WORKED_FOR in`(김정수). 그룹 순서는 neighbors 수 내림차순이므로 MEMBER_OF(5) → PLAYED_MATCH(3) → WON_MATCH(3) → LOST_MATCH(1) → WORKED_FOR(1). 동수는 relation 이름 오름차순.
- `"mock:9"`: `name "GEN vs HLE · 2025-09-06", label "Match", degree 5, record null, match` = mock:9의 props 7키, `groups` = `PLAYED_MATCH in`(mock:1, mock:2), `LOST_MATCH in`(mock:2), `WON_MATCH in`(mock:1), `PART_OF_TOURNAMENT out`(mock:18).

- [ ] **Step 1: `.gitignore`에 `.claude/` 한 줄 추가**
- [ ] **Step 2: 위 표대로 `fixtures/ask_sample.json`, `fixtures/node_sample.json` 작성**
- [ ] **Step 3: 실패하는 테스트 작성 `tests/fixtures.test.js`**

```js
const test = require("node:test"); const assert = require("node:assert/strict");
const ask = require("../fixtures/ask_sample.json"); const nodeFx = require("../fixtures/node_sample.json");
test("fixture_counts", () => { assert.equal(ask.graph.nodes.length, 18); assert.equal(ask.graph.links.length, 24); assert.equal(ask.graph_facts.length, 24); assert.equal(ask.article_chunks.length, 3); });
test("fixture_degree_matches_links", () => { const d = {}; for (const l of ask.graph.links) { d[l.source] = (d[l.source]||0)+1; d[l.target] = (d[l.target]||0)+1; } for (const n of ask.graph.nodes) assert.equal(n.degree, d[n.id] || 0, n.id); });
test("fixture_single_seed_is_team", () => { const seeds = ask.graph.nodes.filter(n => n.is_seed); assert.equal(seeds.length, 1); assert.equal(seeds[0].label, "Team"); });
test("fixture_match_dates", () => { const dates = ask.graph.nodes.filter(n => n.label === "Match").map(n => n.match_date).sort(); assert.deepEqual(dates, ["2025-01-15","2025-04-20","2025-08-30","2025-09-06"]); });
test("fixture_claim_links_have_evidence", () => { const ev = ask.graph.links.filter(l => l.evidence); assert.equal(ev.length, 8); for (const l of ev) { assert.equal(typeof l.evidence.article_key, "string"); assert.equal(l.evidence.confidence, 1.0); } });
test("fixture_node_sample_has_team_and_match", () => { assert.equal(nodeFx["mock:1"].record.wins, 88); assert.equal(nodeFx["mock:9"].match.score_b, 3); assert.equal(nodeFx["mock:1"].groups[0].relation, "MEMBER_OF"); });
```

- [ ] **Step 4: `node --test "tests/*.test.js"` 실행, 6개 PASS 확인**
- [ ] **Step 5: 커밋 (main)**: `픽스처 추가: 안 1 프론트 개발용 /ask·/node 목 응답과 구현 계획`

---

### Task 2: `assets/graph-utils.js` 순수 함수 (TDD)

**Files:**
- Create: `assets/graph-utils.js`, `tests/graph-utils.test.js`

**Interfaces:**
- Produces: 파일 구조 절의 공개 함수 전부와 `REL_GROUPS`, `LABEL_KO`.
- 모듈 끝: `if (typeof module !== "undefined") module.exports = GraphUtils; else window.GraphUtils = GraphUtils;`

- [ ] **Step 1: 실패하는 테스트 작성 `tests/graph-utils.test.js`** (픽스처를 입력으로 쓴다)

```js
const G = require("../assets/graph-utils.js"); const ask = require("../fixtures/ask_sample.json");
const graph = ask.graph; const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
const link = (i) => graph.links[i - 1];
test("REL_GROUPS_order_matches_spec", () => assert.deepEqual(G.REL_GROUPS.map(g => g.name), ["소속·역할","승패","출전","픽","전략·오브젝트","기타"]));
test("classifyRelation_by_type", () => { assert.equal(G.classifyRelation(link(1), byId, G.REL_GROUPS), "소속·역할"); assert.equal(G.classifyRelation(link(8), byId, G.REL_GROUPS), "승패"); assert.equal(G.classifyRelation(link(13), byId, G.REL_GROUPS), "출전"); assert.equal(G.classifyRelation(link(17), byId, G.REL_GROUPS), "픽"); assert.equal(G.classifyRelation(link(20), byId, G.REL_GROUPS), "전략·오브젝트"); });
test("classifyRelation_label_rule_for_unknown_type_touching_objective", () => assert.equal(G.classifyRelation(link(24), byId, G.REL_GROUPS), "전략·오브젝트"));
test("classifyRelation_unknown_type_is_etc", () => assert.equal(G.classifyRelation(link(22), byId, G.REL_GROUPS), "기타"));
test("classifyRelation_dangling_endpoint_is_etc", () => assert.equal(G.classifyRelation({source:"x",target:"y",type:"FOO"}, byId, G.REL_GROUPS), "기타"));
test("visibleSetForGroup_membership", () => { const v = G.visibleSetForGroup(graph, "소속·역할", G.REL_GROUPS); assert.equal(v.linkKeys.size, 7); assert.deepEqual([...v.nodeIds].sort(), ["mock:1","mock:16","mock:2","mock:3","mock:4","mock:5","mock:6","mock:7","mock:8"]); });
test("visibleSetForGroup_all", () => { const v = G.visibleSetForGroup(graph, "전체", G.REL_GROUPS); assert.equal(v.linkKeys.size, 24); assert.equal(v.nodeIds.size, 18); });
test("sortNodesForRail_degree_then_name", () => { const s = G.sortNodesForRail(graph.nodes); assert.equal(s[0].id, "mock:1"); assert.equal(s[1].id, "mock:9"); assert.equal(s[2].id, "mock:2"); const deg2 = s.slice(3, 11).map(n => n.name); assert.deepEqual(deg2, [...deg2].sort((a, b) => a.localeCompare(b, "ko"))); });
test("railSubtitle_variants", () => { assert.equal(G.railSubtitle(byId["mock:3"]), "선수 · 관계 2"); assert.equal(G.railSubtitle(byId["mock:9"]), "경기 · 09.06"); assert.equal(G.railSubtitle({label:"Match", match_date:null, degree:1}), "경기 · 날짜 없음"); });
test("labelKo", () => { assert.equal(G.labelKo("Objective"), "오브젝트"); assert.equal(G.labelKo("Weird"), "Weird"); });
test("computeStats_fixture", () => assert.deepEqual(G.computeStats(ask), { seeds: ["한화생명 이스포츠"], matchCount: 4, linkCount: 24, period: "2025.01 ~ 2025.09", articleCount: 3 }));
test("computeStats_empty_graph", () => assert.deepEqual(G.computeStats({graph:{nodes:[],links:[]}, article_chunks:[]}), { seeds: [], matchCount: 0, linkCount: 0, period: "-", articleCount: 0 }));
test("dateStripLayout_positions", () => { const L = G.dateStripLayout(graph.nodes, 400, 20); assert.equal(L.points.length, 4); assert.equal(L.minLabel, "2025.01"); assert.equal(L.maxLabel, "2025.09"); assert.equal(L.points[0].x, 20); assert.equal(L.points[3].x, 380); assert.ok(L.points[1].x < L.points[2].x); });
test("dateStripLayout_skips_null_date_and_single_point_centered", () => { const L = G.dateStripLayout([{id:"a",label:"Match",match_date:null},{id:"b",label:"Match",match_date:"2025-05-01"},{id:"c",label:"Team",match_date:null}], 400, 20); assert.equal(L.points.length, 1); assert.equal(L.points[0].x, 200); });
test("localNodeDetail_groups_from_graph", () => { const d = G.localNodeDetail("mock:3", graph); assert.equal(d.name, "제카"); assert.equal(d.record, null); assert.equal(d.match, null); assert.deepEqual(d.groups.map(g => [g.relation, g.direction, g.neighbors.map(n => n.id)]), [["MEMBER_OF","out",["mock:1"]],["PICKED_CHAMPION","out",["mock:13"]]]); });
test("localNodeDetail_unknown_id_is_null", () => assert.equal(G.localNodeDetail("nope", graph), null));
test("factNodeIds_first_match_wins", () => { const nodes = [...graph.nodes, {id:"dup", name:"제카", label:"Player"}]; assert.deepEqual(G.factNodeIds({source:"제카", target:"아지르"}, nodes), {sourceId:"mock:3", targetId:"mock:13"}); assert.deepEqual(G.factNodeIds({source:"없는이름", target:"아지르"}, nodes), {sourceId:null, targetId:"mock:13"}); });
```

- [ ] **Step 2: `node --test "tests/*.test.js"` 실행, graph-utils 테스트가 `Cannot find module`로 FAIL 확인**
- [ ] **Step 3: `assets/graph-utils.js` 구현**
  - `REL_GROUPS`는 스펙 4-2 표를 배열로. "전략·오브젝트" 항목에 `labelRule: ["Objective", "Object"]`.
  - `classifyRelation`: 타입 목록 순회 → 매치 없으면 `labelRule` 있는 그룹에 대해 양끝 노드 라벨 검사(노드가 없으면 건너뜀) → "기타".
  - `visibleSetForGroup`: linkKey는 `${source}|${target}|${type}`. 보이는 간선의 양끝만 nodeIds에 넣는다.
  - `dateStripLayout`: Match 라벨이고 `match_date`가 문자열인 노드만 골라 날짜 오름차순으로 정렬한 뒤 x = pad + (t - tmin) / (tmax - tmin) * (width - 2*pad). 점이 1개이거나 tmax == tmin이면 x = width / 2. `points`는 그 정렬 순서, 라벨은 `YYYY.MM`.
  - `localNodeDetail`: direction은 `link.source === nodeId ? "out" : "in"`. 그룹은 `(relation, direction)`별, neighbors 수 내림차순, 동수는 relation 오름차순. neighbors는 이름 오름차순(`localeCompare("ko")`), 최대 20. `role`은 항상 null(그래프 응답에 간선 속성이 없다).
- [ ] **Step 4: `node --test "tests/*.test.js"` 실행, 전부 PASS**
- [ ] **Step 5: 커밋**: `그래프 유틸 추가: 관계 묶음 판정·레일 정렬·통계·날짜 스트립·로컬 상세 순수 함수`

---

### Task 3: 목 분기, 레이아웃, 배치 고정

**Files:**
- Modify: `index.html` (스타일 `.container`·`.panel`, `<script src="assets/graph-utils.js">` 추가, `askQuestion` → `loadAsk` 분리, `renderGraph` 옵션)

**Interfaces:**
- Consumes: `GraphUtils.LABEL_KO`
- Produces: `async loadAsk(question) -> data`(`?mock=1`이면 `fixtures/ask_sample.json`을 fetch, 아니면 `POST /ask`), `state` 전역, `renderGraph(graph)`가 `state.network/nodes/edges/baseColors/nodesById/graph`를 채움. `baseColors[id] = {background, border}`를 노드 생성 시 기록.

- [ ] **Step 1: `.container`를 `grid-template-columns: 300px minmax(0, 1fr) 380px`로, `.panel { min-width: 0; }` 추가**
- [ ] **Step 2: `const MOCK = new URLSearchParams(location.search).get("mock") === "1";` 와 `loadAsk` 작성. `askQuestion`은 `loadAsk`를 호출하고 렌더만 담당**
- [ ] **Step 3: `renderGraph` 옵션에 `layout: { randomSeed: 42 }`, `physics: { stabilization: { iterations: 200 } }`, `groups`에 Match `#fb7185`, Game `#cbd5e1`, Staff·Coach `#f97316`, Objective·Object `#14b8a6`, Entity `#9ca3af` 추가(배경색. 테두리는 같은 색 계열 한 단계 진하게). 범례 DOM과 CSS 제거**
- [ ] **Step 4: 수동 확인** `python3 -m http.server 5500` → `http://localhost:5500/index.html?mock=1` → 질문하기 → 그래프 18 노드가 뜨고 콘솔 에러 0. 새로고침 후 다시 질문해도 노드 위치 같음(체크리스트 11). 개발자 도구 기기 모드 1416px에서 `document.documentElement.scrollWidth === window.innerWidth`가 true(체크리스트 10)
- [ ] **Step 5: 커밋**: `프론트 목 모드와 그리드 보정: ?mock=1 픽스처 로드, 열 잘림 수정, 배치 시드 고정`

---

### Task 4: 통계 칩

**Files:**
- Modify: `index.html` (`.stats` 마크업 4칩 교체, `renderStats(data)`)

**Interfaces:**
- Consumes: `GraphUtils.computeStats(data)`
- Produces: `renderStats(data)`. 칩 id: `#statSeeds`, `#statMatches`, `#statPeriod`, `#statArticles`.

- [ ] **Step 1: 마크업 라벨을 `핵심 분석 대상`, `관련 경기 · 관계`, `분석 기간`, `참조 기사`로 교체**
- [ ] **Step 2: `renderStats`**: `seeds.slice(0,3).join(", ") || "-"`, `` `경기 ${matchCount} · 관계 ${linkCount}` ``, `period`, `articleCount`. 기존 `#chunkCount`·`#analysisState` 갱신 코드는 제거
- [ ] **Step 3: 수동 확인** 체크리스트 1: `한화생명 이스포츠`, `경기 4 · 관계 24`, `2025.01 ~ 2025.09`, `3`
- [ ] **Step 4: 커밋**: `통계 칩 분리: 핵심 대상·경기/관계 수·분석 기간·참조 기사`

---

### Task 5: 엔티티 레일과 흐림 처리

**Files:**
- Modify: `index.html` (그래프 본문을 `grid-template-columns: 150px minmax(0, 1fr)`로, `<aside id="rail">`, `renderRail`, `highlightNodes`, `clearHighlight`)

**Interfaces:**
- Consumes: `GraphUtils.sortNodesForRail`, `railSubtitle`, `labelKo`, `state.baseColors`
- Produces: `highlightNodes(ids: string[])`(ids와 그 사이 간선만 원래 색, 나머지 노드 `#e5e7eb`/`#f3f4f6`, 간선 `#e5e7eb`), `clearHighlight()`(`baseColors`로 복원, 간선 `#94a3b8`). 레일 항목 `data-id` 속성.

- [ ] **Step 1: 레일 마크업·스타일**: 항목 = 색 점(`.dot`, 라벨 그룹 색) + 이름 + `.sub`(railSubtitle). `is_seed`면 `.badge` "핵심". 12개 초과분은 `hidden` 클래스, `+ N개 더` 버튼이 토글
- [ ] **Step 2: `renderRail(graph)`**: mouseenter → `highlightNodes([id, ...인접 노드 id])`, mouseleave → `clearHighlight()`, click → `showNodeDetail(id)` + `state.network.focus(id, {scale: 1.2, animation: true})`. `graph.nodes`가 비면 "엔티티가 없습니다" 한 줄
- [ ] **Step 3: `highlightNodes`/`clearHighlight`**: `state.nodes.update([...])`, `state.edges.update([...])`로 색 치환. 간선 id는 Task 3에서 `${source}|${target}|${type}`로 부여해 둔다(없으면 지금 추가)
- [ ] **Step 4: 수동 확인** 체크리스트 2(12개 + `+ 6개 더`, 첫 항목 한화생명 `핵심`), 3(hover 강조·복원, 콘솔 에러 0)
- [ ] **Step 5: 커밋**: `엔티티 레일 추가: 중요도순 목록, hover 강조와 복원`

---

### Task 6: 관계 유형 필터 칩

**Files:**
- Modify: `index.html` (`<div id="filterChips">`, `renderFilterChips`, `applyRelationFilter`)

**Interfaces:**
- Consumes: `GraphUtils.REL_GROUPS`, `visibleSetForGroup`
- Produces: `applyRelationFilter(groupName)`. 활성 칩 `.active`. 현재 선택을 `state.filter`에 저장(기본 "전체").

- [ ] **Step 1: 칩 마크업**: `전체` + REL_GROUPS 6개. 각 칩 옆 작은 숫자 = 그 묶음 간선 수(0이면 칩 비활성화 `disabled`)
- [ ] **Step 2: `applyRelationFilter`**: `visibleSetForGroup` 결과로 `state.edges.update({id, hidden: !linkKeys.has(id)})`, `state.nodes.update({id, hidden: !nodeIds.has(id)})`. "전체"면 전부 `hidden: false`
- [ ] **Step 3: 수동 확인** 체크리스트 4(`소속·역할` → MEMBER_OF·WORKED_FOR 7개만, 노드 9개), 5(`전략·오브젝트`에 `SECURED` 간선 포함), `전체`로 복원
- [ ] **Step 4: 커밋**: `관계 유형 필터 칩 추가: 범례 대체, 묶음별 간선·노드 숨김`

---

### Task 7: 경기 날짜 스트립

**Files:**
- Modify: `index.html` (`<svg id="dateStrip" height="56">`, `renderDateStrip`)

**Interfaces:**
- Consumes: `GraphUtils.dateStripLayout(nodes, width, 24)`, `showNodeDetail`
- Produces: `renderDateStrip(graph)`. 점 `<circle r="5" data-id>`, 양끝 `<text>` 라벨.

- [ ] **Step 1: 캔버스 아래 SVG 배치, 너비는 `svg.clientWidth`(0이면 600). `window.resize`에 다시 그림**
- [ ] **Step 2: `renderDateStrip`**: 점 색 Match 그룹 배경색. click → `state.network.focus(id, {scale: 1.2, animation: true})`, `state.network.selectNodes([id])`, `showNodeDetail(id)`. 점 0개면 SVG 대신 "경기 노드가 없습니다"
- [ ] **Step 3: 수동 확인** 체크리스트 6(점 4개, `2025.01`·`2025.09`, 점 클릭 → 포커스 + 카드 `1:3 · Playoffs`)
- [ ] **Step 4: 커밋**: `경기 날짜 스트립 추가: match_date 기준 배치와 점 클릭 포커스`

---

### Task 8: 노드 상세 고정 카드

**Files:**
- Modify: `index.html` (오른쪽 열 첫 요소 `<section id="nodeDetail">`, `showNodeDetail`, `network.on("click")`)

**Interfaces:**
- Consumes: `GraphUtils.localNodeDetail`, `labelKo`, `state.graph`
- Produces: `async showNodeDetail(nodeId)`. 데이터 소스 순서: `MOCK`이면 `fixtures/node_sample.json`에서 id 조회 → 없으면 `localNodeDetail` / 실 모드면 `GET ${API_BASE_URL}/node?id=${encodeURIComponent(id)}` → 실패(throw 또는 `!ok`)면 실패 문구 + `localNodeDetail`.

- [ ] **Step 1: 카드 마크업**: 초기 문구 "그래프 노드나 레일 항목을 선택하면 상세가 여기에 표시됩니다." 제목(이름), 부제(labelKo), 요약 칩 3개(`관계 N`; Team/Player이고 record 있으면 `승 W · 패 L`; Match면 `${score_a}:${score_b} · ${match_stage}`), 그룹 칩 목록(`relation` + 이웃 이름 최대 5개 + `+N`)
- [ ] **Step 2: `showNodeDetail`** 위 소스 순서대로. 그룹 칩 안 이웃 이름 click → `showNodeDetail(neighbor.id)` + `focus`. `renderGraph`에서 `state.network.on("click", p => p.nodes[0] && showNodeDetail(p.nodes[0]))`
- [ ] **Step 3: 수동 확인** 체크리스트 7(Team 클릭 → `승 88 · 패 37`, MEMBER_OF 그룹 첫 번째), 8(이웃 `제카` 클릭 → 로컬 폴백으로 MEMBER_OF·PICKED_CHAMPION 두 그룹). 실 모드 폴백은 `?mock=1` 없이 백엔드를 끄고 노드 클릭 → 실패 문구 + 로컬 그룹이 뜨는지 확인(Review Focus 5)
- [ ] **Step 4: 커밋**: `노드 상세 고정 카드 추가: /node 조회와 로컬 1홉 폴백`

---

### Task 9: 근거 카드 hover 연동, README, 체크리스트 마감

**Files:**
- Modify: `index.html` (`renderFacts(facts)`가 `related_chunks` 대신 `graph_facts` 사용), `README.md`

**Interfaces:**
- Consumes: `GraphUtils.factNodeIds`, `highlightNodes`, `clearHighlight`

- [ ] **Step 1: `renderFacts`**: 카드 텍스트 `${source} -[${relation}]-> ${target}`, evidence 있으면 아래 작은 글씨로 `evidence.text`. mouseenter → `factNodeIds`로 두 id를 얻어 null 제외 후 `highlightNodes(ids)`(둘 다 null이면 아무 일 없음), mouseleave → `clearHighlight()`
- [ ] **Step 2: README 갱신**: 실행 절에 `?mock=1` 설명, `node --test "tests/*.test.js"` 명령, "화면에서 쓰는 응답 필드"를 스펙 4-1·4-3 키로 교체, `assets/graph-utils.js` 역할 한 줄
- [ ] **Step 3: `node --test "tests/*.test.js"` 전부 PASS 재확인**
- [ ] **Step 4: 체크리스트 11항목 전체 재수행**, 결과를 `/Users/doo._.hyun/Study/Project/lck/Frontend/.claude/reports/t2-checklist.md`에 항목별 통과/실패와 관찰로 기록(gitignore 경로)
- [ ] **Step 5: 커밋**: `근거 카드 hover 연동과 README 갱신`

---

## 실행 프롬프트 (터미널 1)

권장 실행 설정: 모델 Sonnet 5.5, 추론 수준 medium, 에이전트 종류 general-purpose. 프로젝트 루트 `/Users/doo._.hyun/Study/Project/lck/Frontend`에서 Claude Code를 열고 붙여 넣는다. Task 1이 `main`에 커밋된 뒤에만 유효하다.

```
[1단계: 작업 공간 만들기] 다른 무엇보다 먼저 이것부터 해라.
루트 /Users/doo._.hyun/Study/Project/lck/Frontend 에서 `git log --oneline -1` 을 실행해 기점 커밋 해시를 기록해라. 그 커밋 메시지가 "픽스처 추가: 안 1 프론트 개발용 /ask·/node 목 응답과 구현 계획" 이 아니면 중단하고 BLOCKED 로 보고해라. 그 해시를 <BASE> 라 부른다.
  git worktree add -b feat/graph-panel /Users/doo._.hyun/Study/Project/lck/Frontend/.claude/worktrees/lck-graph-panel <BASE>
를 실행한 뒤 EnterWorktree 도구에 path=/Users/doo._.hyun/Study/Project/lck/Frontend/.claude/worktrees/lck-graph-panel 를 넘겨 세션을 옮겨라.
진입 후 아래를 확인하고, 하나라도 어긋나면 중단하고 BLOCKED 로 보고해라:
  - pwd 가 /Users/doo._.hyun/Study/Project/lck/Frontend/.claude/worktrees/lck-graph-panel 인지
  - git log --oneline -1 이 <BASE> 인지
  - docs/plans/2026-10-11-graph-panel-option1-frontend.md 와 fixtures/ask_sample.json, fixtures/node_sample.json, tests/fixtures.test.js 가 존재하는지
  - 스펙 /Users/doo._.hyun/Study/Project/lck/docs/graph-panel-option1-spec.md 가 존재하는지(저장소 밖 절대 경로다)
  - git status --short 가 비어 있는지
  - node --version 이 v24 이상이고 `node --test "tests/*.test.js"` 가 6개 PASS 인지
  - python3 -m http.server 5500 을 백그라운드로 띄울 수 있는지(포트 충돌 시 5501 로 바꾸고 보고서에 적는다)

[2단계: 실행] 계획서 docs/plans/2026-10-11-graph-panel-option1-frontend.md 의 Task 2 부터 Task 9 까지 순서대로 수행한다. 역할: 프론트 구현자. 각 태스크의 Step 을 체크박스 순서대로 하고, 테스트 스텝은 실제로 실행해 출력으로 확인한다. 스펙 문서는 계획서가 가리키는 절만 읽는다.
허용 Files: index.html, README.md, assets/graph-utils.js, tests/graph-utils.test.js.
수정 금지: config.js, fixtures/ 아래 모든 파일, tests/fixtures.test.js, docs/ 아래, 그 외 모든 파일. npm install 을 비롯한 패키지 설치 금지.
공유 계약: 계획서 Global Constraints 와 "파일 구조" 절의 GraphUtils 함수 시그니처를 글자 단위로 지킨다. 테스트 코드는 계획서의 것을 그대로 쓰고 단언을 약화하지 않는다. 테스트가 틀렸다고 판단되면 고치지 말고 BLOCKED 로 보고한다.
검증: 각 태스크의 수동 확인 스텝은 브라우저에서 수행한다(Chrome 도구가 있으면 그것으로, 없으면 사용자에게 확인 요청 대신 스크린샷 없이 콘솔·DOM 상태를 javascript 로 읽어 기록). Task 9 Step 4 의 체크리스트 11항목 결과를 /Users/doo._.hyun/Study/Project/lck/Frontend/.claude/reports/t2-checklist.md 에 항목별로 적는다. 콘솔 에러는 0 이어야 한다.
커밋: 계획서의 각 태스크 마지막 Step 메시지로 태스크 단위 원자 커밋. 마지막 줄에 실제 작성 모델의 `Co-Authored-By` 트레일러를 넣는다. 산문에 대시(—) 를 쓰지 않는다.
보고서: /Users/doo._.hyun/Study/Project/lck/Frontend/.claude/reports/t2-report.md 에 태스크별 커밋 해시, `node --test "tests/*.test.js"` 최종 출력 원문, 체크리스트 파일 경로, 계획과 달리 한 결정(있다면)을 적는다.
완료 형식: 마지막 메시지는 `DONE T2 feat/graph-panel <HEAD 해시>` 한 줄과 보고서 경로. 실패나 막힘은 `BLOCKED T2 <사유>`.
```

## 통합 게이트 (오케스트레이터)

1. 각 태스크 커밋 뒤 diff 리뷰: 허용 파일 밖 변경 없음, GraphUtils 시그니처 일치, 테스트 단언 미변경.
2. Task 9 뒤 Opus 5.5 리뷰어에게 브랜치 전체와 체크리스트 파일을 넘겨 Review Focus 5항목을 중심으로 본다.
3. 수정 루프 후 `main`에 머지. 백엔드 계획(별도 문서)이 끝나면 `?mock=1` 없이 실 서버로 체크리스트 1~9를 다시 돈다.
