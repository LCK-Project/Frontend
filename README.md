# LCK Knowledge Graph Frontend

LCK(리그 오브 레전드 챔피언스 코리아) 지식그래프 질의응답 대시보드의 프론트엔드입니다.
빌드 도구 없이 동작하는 단일 HTML 페이지이며, 백엔드([LCK-Project/Backend](https://github.com/LCK-Project/Backend))의
`POST /ask` API를 호출해 답변, 관계 그래프(vis-network), RDB 통계를 화면에 그립니다.

## 구성

```text
Frontend/
├── index.html   # 대시보드 전체 (마크업 + 스타일 + 스크립트)
├── config.js    # 백엔드 API 주소 설정
└── README.md
```

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

## 백엔드 연동

- 호출 API: `POST {API_BASE_URL}/ask`, 본문 `{ "question": "..." }`
- 백엔드는 `CORS_ORIGINS` 환경변수로 허용 origin 을 제어합니다. 로컬에서는 기본값(`*`)이면 충분합니다.
- 화면에서 쓰는 응답 필드: `answer`, `graph`(nodes/edges), `related_chunks`, `rdb_answer`, `rdb_facts`, `rdb_sql`

## 외부 의존성

- [vis-network](https://visjs.github.io/vis-network/) (CDN, 그래프 시각화)
