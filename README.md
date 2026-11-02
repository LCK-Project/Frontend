# LCK Knowledge Graph Frontend

LCK(리그 오브 레전드 챔피언스 코리아) 지식그래프 질의응답 대시보드의 프론트엔드입니다.
빌드 도구 없이 동작하는 단일 HTML 페이지이며, 백엔드([LCK-Project/Backend](https://github.com/LCK-Project/Backend))의
`POST /ask` API를 호출해 답변, 관계 그래프(vis-network), RDB 통계를 화면에 그리고,
그래프에서 고른 노드의 상세는 `GET /node` API로 가져옵니다.

## 빠른 시작(Docker)

```bash
docker compose up --build
```

브라우저에서 `http://localhost:5500` 에 접속합니다. 컨테이너가 뜰 때 `API_BASE_URL` 값으로 `config.js` 를 새로 만들어 nginx 가 정적 파일과 함께 서빙합니다.

`API_BASE_URL` 은 컨테이너 안에서가 아니라 사용자 브라우저에서 닿는 백엔드 주소여야 합니다(기본값 `http://localhost:8000`).

| 변수 | 기본값 | 용도 |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8000` | 브라우저가 호출할 백엔드 주소 |
| `WEB_HOST_PORT` | `5500` | 대시보드를 여는 호스트 포트 |

```bash
API_BASE_URL=http://localhost:9000 WEB_HOST_PORT=8080 docker compose up --build
```

## 구성

```text
Frontend/
├── index.html             # 대시보드 전체 (마크업 + 스타일 + DOM·vis-network 조작)
├── assets/graph-utils.js  # 관계 묶음 판정·레일 정렬·통계·날짜 스트립·로컬 상세를 계산하는 순수 함수
├── assets/chat-store.js   # 질문·답변 턴, 활성 답변, 채팅/분석 모드를 관리하는 순수 상태 모듈
├── config.js              # 백엔드 API 주소 설정
├── fixtures/              # 목 모드에서 읽는 /ask·/node 응답 픽스처
├── tests/                 # Node 내장 테스트 러너용 단위 테스트
└── README.md
```

## 화면 구성

왼쪽은 지식그래프 패널(통계, 엔티티 레일, 관계 필터, 그래프, 날짜 스트립)로 고정이고, 오른쪽은 "채팅"과 "분석" 두 모드를 오갑니다.

- **채팅**: 질문과 답변이 말풍선으로 아래에 쌓입니다. 답변을 기다리는 동안은 입력이 잠깁니다. 각 답변의 "분석 보기"를 누르면 분석 모드로 바뀌고 왼쪽 그래프도 그 답변의 데이터로 바뀝니다.
- **분석**: 활성 답변의 선택한 노드, 답변 / 지식그래프 근거 / RDB 근거 탭을 보여줍니다. 새 답변이 오면 그 답변이 활성이 되지만 모드는 바뀌지 않습니다.
- **범위 되묻기**: "T1의 전략이 궁금해"처럼 시즌·대회가 빠진 질문에는 백엔드가 `type: "clarify"` 응답을 돌려주고, 채팅에 되묻는 문장과 대회·시즌 선택지 칩이 뜹니다. 칩을 누르면 원래 질문에 범위를 붙인 질문(예: `T1의 전략이 궁금해 (2025 LCK Cup 기준)`)이 `skip_clarify: true` 로 다시 전송돼 답변이 옵니다. 되묻기는 질문당 한 번입니다. 목 모드에서는 질문에 연도가 없으면 `fixtures/clarify_sample.json` 을 돌려줍니다.

백엔드 `POST /ask` 는 이전 대화를 받지 않으므로, 대화가 쌓여도 각 질문은 독립적으로 처리됩니다. 설계는 `docs/specs/2026-11-03-chat-mode-design.md` 에 있습니다.

## 실행 방법

### 1. 백엔드 먼저 실행

백엔드 레포의 README를 따라 FastAPI 서버를 띄웁니다. 기본 주소는 `http://localhost:8000` 입니다.

### 2. API 주소 설정

`config.js` 에서 백엔드 주소를 지정합니다. 로컬 개발이면 기본값 그대로 두면 됩니다.

```js
window.API_BASE_URL = "http://localhost:8000";
```

### 3. 정적 서버로 열기

브라우저에서 `index.html` 을 직접 열어도 되지만(file://), CORS 문제를 피하려면 간단한 정적 서버를 권장합니다.

```bash
# Python 내장 서버
python -m http.server 5500

# 또는 Node 가 있다면
npx serve .
```

브라우저에서 `http://localhost:5500` 에 접속한 뒤 질문을 입력하면 됩니다.

### 4. 백엔드 없이 열기 (목 모드)

주소 뒤에 `?mock=1` 을 붙이면 백엔드를 호출하지 않고 픽스처를 읽습니다.
`http://localhost:5500/index.html?mock=1` 에서 아무 질문이나 입력하고 "전송"을 누르면
`fixtures/ask_sample.json` 이 응답으로 쓰이고, 노드 상세는 `fixtures/node_sample.json` 에서 같은 id 를 찾습니다.
픽스처에 없는 노드는 현재 그래프의 1홉 이웃으로 상세를 만듭니다. 입력한 질문 내용은 무시됩니다.

## 테스트

`assets/graph-utils.js`, `assets/chat-store.js` 의 순수 함수와 픽스처는 Node 내장 테스트 러너로 검증합니다. 패키지 설치는 필요 없습니다(Node 24 이상).

```bash
node --test "tests/*.test.js"
```

## 백엔드 연동

- 호출 API
  - `POST {API_BASE_URL}/ask`, 본문 `{ "question": "..." }`
  - `GET {API_BASE_URL}/node?id=<노드 id>` (노드 상세 카드). 요청이 실패하면 카드에 실패 문구를 띄우고 현재 그래프의 1홉 이웃으로 대신 그립니다.
- 백엔드는 `CORS_ORIGINS` 환경변수로 허용 origin 을 제어합니다. 로컬에서는 기본값(`*`)이면 충분합니다.

### 화면에서 쓰는 응답 필드

`POST /ask`

| 필드 | 쓰는 곳 |
|---|---|
| `answer` | AI 답변 |
| `graph.nodes[]`: `id`, `name`, `label`, `degree`, `is_seed`, `match_date` | 그래프, 엔티티 레일, 통계 칩, 날짜 스트립 |
| `graph.nodes[].props` | 응답 계약에는 있지만 화면은 아직 읽지 않습니다(경기 점수는 `/node` 의 `match` 에서 읽습니다) |
| `graph.links[]`: `source`, `target`, `type` | 그래프 간선, 관계 필터 칩, 통계 칩 |
| `graph.links[].evidence` | 응답 계약에는 있지만 화면은 읽지 않습니다(근거 문장은 `graph_facts[].evidence.text` 에서 읽습니다) |
| `graph_facts[]`: `source`, `relation`, `target`, `evidence.text` | 지식그래프 근거 카드와 hover 강조 |
| `article_chunks` | 통계 칩 "참조 기사" 개수 |
| `rdb_answer`, `rdb_facts`, `rdb_entities`, `rdb_sql` | RDB 통계 근거 |

`GET /node`

| 필드 | 쓰는 곳 |
|---|---|
| `name`, `label`, `degree` | 카드 제목, 라벨, "관계 N" 칩 |
| `record`: `wins`, `losses` | Team·Player 의 "승 W · 패 L" 칩 |
| `match`: `score_a`, `score_b`, `match_stage` | Match 의 "점수 · 스테이지" 칩 |
| `groups[]`: `relation`, `direction`, `neighbors[]`(`id`, `name`, `role`) | 관계 그룹 칩과 이웃 이동 |

## 외부 의존성

- [vis-network](https://visjs.github.io/vis-network/) (CDN, 그래프 시각화)
