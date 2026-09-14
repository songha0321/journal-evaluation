# QA.md — 항해일지 AUTO (AX MVP) 수정 기록·검증 지침

> **2026-09-14부터 프론트엔드·백엔드(API·러너·DB)를 고치는 모든 작업은 이 문서에 기록한다.**
> 한 회차 = 한 배포 단위. 회차마다 "무엇을 고쳤고, 어떻게 확인했고, 어디까지 배포됐는지"를 남긴다.
> 요구사항은 [`PRD.md`](./PRD.md), 진행 단계 정의는 [`PROCESS.md`](./PROCESS.md), 디자인 규칙은 [`DESIGN.md`](./DESIGN.md)를 따른다.

| 항목 | 내용 |
| --- | --- |
| 대상 | `journal-evaluation` — Next.js(OpenNext) + Cloudflare Workers + D1 `sdij-journal` + 로컬 러너 `scripts/ax-runner.mjs` |
| 라이브 | https://sdij-journal.gracesongha.workers.dev (루트 → `/ax`) |
| 브랜치 | `mvp` (main 미병합) |
| 로컬 | `npm run dev` → http://localhost:3000/ax — 로컬 D1(`.wrangler/state`)에 프로덕션 스냅샷(2026-09-14, 12테이블) 적재됨. 갱신은 원격 SELECT 덤프 → sqlite3 적재(export API는 토큰 권한 없음) |
| 배포 | `npm run deploy` (= opennextjs-cloudflare build + deploy). 빌드가 stale하면 `rm -rf .wrangler/state` |
| 최종 갱신 | 2026-09-14 (5회차 — 원문 비교·댓글) |

## 표기 규칙

- **ID** — `R{회차}-{번호}` 수정 항목 · `G-{번호}` 전역 회귀 항목 · `S{1..6}` 는 PROCESS.md 트랙 B 단계 코드.
- **영역** — FE(화면·컴포넌트) · BE(API 라우트·lib) · DB(마이그레이션·D1 데이터) · RUN(로컬 러너·스크립트) · DOC(문서만, 배포 없음).
- **우선순위** — P0(출시 차단) · P1(중요) · P2(개선).
- **상태** — ☐ 미확인 · ⏳ 진행 · ✅ 통과 · ❌ 실패 · — 폐기.
- **검증** — 무엇으로 확인했는지 적는다. 예: `빌드`, `curl /api/ax/toc`, `헤드리스 1440px`, `실브라우저`, `D1 쿼리`. 확인 안 했으면 `미검증`이라고 쓴다.
- **기기** — 데스크톱(≥1280px) 기준. 관리자 도구라 모바일은 가로 넘침만 막는다.

## 기록 규칙

1. 코드를 고치기 전에 이 문서의 [실행 기록](#실행-기록)에 새 회차 표를 만들고 항목 ID를 먼저 부여한다.
2. 항목 한 줄에 **영역 · 화면(경로) · 변경 내용 · 파일 · 검증 · 상태**를 모두 적는다. 파일은 `src/…` 상대 경로.
3. 회차가 끝나면 **커밋 해시 · 배포 여부(라이브 Version ID)** 를 회차 머리에 적는다. 커밋만 하고 배포 안 했으면 그렇게 쓴다.
4. 해결 안 된 것은 [미해결 항목](#미해결-항목)으로 올리고, 해결되면 그 표에서 지운다(근거는 회차 기록에 남는다).
5. MVP 수정은 **계획 제시 → 컨펌 → 실행** 순서다. 컨펌 전 실행 금지. 번호별 요청은 번호마다 반영 여부를 보고한다.
6. 사용자 노출 문구에 중간 점(·)을 쓰지 않는다. 나열은 쉼표.

---

## 화면·API 기준선 (2026-09-14, 커밋 `11e9839`)

### 화면 (FE)

| 코드 | 경로 | 내용 | 주요 컴포넌트 |
| --- | --- | --- | --- |
| AX-HOME | `/ax` | 홈 · 목차 목록 · 진행률 | `StageStepper` |
| AX-ISSUES | `/ax/issues` | 호차(issue) 목록 · 추가 | `AddIssueButton` |
| AX-ISSUE | `/ax/issues/[issueId]` | 호차 상세 · 6단계 GNB 셸 | `GnbTabs` |
| S1 | `/ax/issues/[issueId]/toc-input` | [GNB1] 목차 입력 | `TocInputEditor` |
| S2·S3 | `/ax/issues/[issueId]/ai-select` | [GNB2] AI 후보 검토 · 편집자 수기 확정 | `SelectBoard`, `RunnerNotice` |
| S4·S5 | `/ax/issues/[issueId]/revise` | [GNB3] 탈고 진입 | — |
| TOC | `/ax/toc/[tocId]` | 목차별 원고 보드 · export | `ManuscriptBoard` |
| MS | `/ax/toc/[tocId]/[msId]` | 원고 교정 승인 편집기 | `RevisionEditor` |
| MY | `/my` | 마이페이지(계정 정보, 로그아웃) | `Avatar` |
| PUB | `/ax/published`, `/ax/published/[issueId]`, `/ax/published/[issueId]/[articleId]` | 편집 완료 항해일지(발행 호차, 게재 원고 목록, 원고 읽기) | `IssueHero`, `DataTable` |
| LEGACY | `/`, `/dashboard`, `/evaluations`, `/essays/*`, `/articles/*` | 1차 FE(평가 데이터 조회) | — |

### API (BE)

| 경로 | 역할 |
| --- | --- |
| `POST /api/ax/issue` | 호차 생성 |
| `POST /api/ax/toc` | 목차 생성·수정 |
| `POST /api/ax/shortlist` | AI 선별 큐 등록 (러너가 처리) |
| `POST /api/ax/confirm` | 편집자 수기 확정 → `ax_manuscript` 생성 |
| `POST /api/ax/revise` | 탈고 큐 등록 (러너가 처리) |
| `GET/POST /api/ax/manuscript` | 원고 조회·교정 승인 저장 |
| `POST /api/ax/finalize` | 원고 확정(`status='final'`) |
| `POST /api/ax/generate` | AI 생성(소제목·comment) |
| `GET /api/ax/export/[tocId]` | Word용 .doc(HTML) export |

### 러너 (RUN)

`scripts/ax-runner.mjs` — 로컬에서 D1 큐를 폴링해 `shortlist`(S2)·`revise`(S4)를 처리. LLM 미연결 시 규칙 기반 폴백. 공용 규칙 `src/lib/revision.ts`(applyEdits)와 동일해야 한다.

---

## 미해결 항목

이 표만 보면 지금 열려 있는 것이 전부다.

| ID | 상태 | 내용 | 막고 있는 것 |
| --- | --- | --- | --- |
| R0-QA | ☐ | 0회차(커밋 `11e9839`) 화면 QA 미실행 — 빌드·배포 성공만 확인. S4·S5 탈고 흐름(러너 → `/ax/toc/[tocId]/[msId]` 교정 승인 → finalize → export) 실브라우저 통과 여부 미확인 | QA 실행 |
| R0-UI | ✅ | AX 웹 UI 개편 — 1~4회차로 완료(포인트 컬러·표·검색/드롭다운·단계 줄·대시보드). 남은 것은 실브라우저 클릭 검증 | — |
| R0-DS | ☐ | `src/app/globals.css` 토큰이 DESIGN.md v2.0(차콜 크롬 + 코랄, `#0077C1`) 기준 — v3.3 브랜드 팔레트와 불일치. UI 개편 때 DESIGN.md §6.2 재매핑표대로 교체 | R0-UI |
| R1-AUTH | ⏳ | **Google 로그인 연결 완료(2026-09-14)**: GCP 프로젝트 `sdij-journal`(gracesongha@gmail.com), 앱 "항해일지 AUTO", 외부·테스트 모드(테스트 사용자 apsongpark·gracesongha), 웹 클라이언트 "항해일지 AUTO 웹"(리디렉션 라이브+localhost), Worker secret 3개 등록, 원격 D1 0013·0014 적용, 허가 계정 2개. 남은 것: **실제 로그인 왕복 검증**(사용자가 직접 Google 동의 클릭)  그 전까지 라이브는 로그인 페이지에서 "설정 대기" 안내 | OAuth 발급(콘솔 작업) |
| R2-PUB | ⏳ | 편집 완료 항해일지는 R3-18로 구현됨. 남은 것: 1차 `/articles/*` 페이지와 StubButton 5개 삭제(중복), `ax_issue.published_at`이 전부 NULL이라 발행일 열이 비어 있음(백필 필요), 2027 1호차는 `editing`인데 articles 48편이 이미 적재돼 있어 상태 정합 확인 | 데이터 확인 |
| R2-NAME | ☐ | D1 `authors`에 이름이 **"ㅋㅋ"**인 8기 성적우수 작성자가 있음(수기 DB 8기 목록 첫 행). ETL 원본 시트 확인 후 정정 필요 | 데이터 확인 |
| R2-C6 | ☐ | D1 `authors`에 **6기 81명**이 있는데 PROCESS.md는 "6기 발간 없음, 적재 5·7·8·9기"라고 적혀 있음. 어느 쪽이 맞는지 확인 필요(데이터 대시보드 기수별 준비율에 6기 표시됨) | 데이터 확인 |

---

## 전역 회귀 (Global)

FE를 고친 회차는 아래를 매번 다시 본다.

| ID | 항목 | 기대 동작 (Pass 조건) | 우선 |
| --- | --- | --- | --- |
| G-1 | 빌드 | `npm run build` 경고 외 오류 0. 타입 오류 0 | P0 |
| G-10 | 인증 | `.dev.vars` 바이패스를 끈 상태에서 `/ax`가 `/login`으로 가고, `/api/ax/*`는 401. 바이패스 값이 프로덕션 secret에 없다 | P0 |
| G-2 | 콘솔 무오류 | `/ax` → 호차 → S1~S6 → 원고 편집기 클릭스루 중 콘솔 에러 0건 | P1 |
| G-3 | 서비스명 | 사이드바·타이틀이 **"항해일지 AUTO"**. 내부 코드명("AX")은 사용자 노출 텍스트에 없다 | P1 |
| G-4 | 서체 | 전 화면 Pretendard(설치 시) 또는 시스템 한글 폰트 폴백. 원격 `@import` 없음 | P1 |
| G-5 | 반응형 | 1280·1440px에서 가로 스크롤 없음. 표는 자체 `overflow-x` | P1 |
| G-6 | 문구 | 사용자 노출 문구에 중간 점(·) 없음 | P2 |
| G-7 | 진행 단계 | 6단계 스테퍼 상태가 PROCESS.md §3.1 데이터 판정 조건과 일치(D1 실데이터로 확인) | P1 |
| G-8 | D1 | API가 프로덕션 D1(`sdij-journal`)을 읽고 쓴다. mock 모드 잔재 없음 | P0 |
| G-9 | 배포 | `npm run deploy` 성공 + 라이브 URL 첫 화면 200 | P0 |

---

## 실행 기록

### 5회차 — 2026-09-14 원문 비교(게재 원고 ↔ qna) + 교정별 댓글 (배포)

정식 제작 프로세스의 단계가 아니라 탈고 규칙을 관찰하기 위한 기능. 컨펌된 4항목.

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R5-01 | LIB | 비교 | `src/lib/compare.ts` — 유사도(문자 3-gram 자카드 50% + 어절 LCS 비율 50%), 어절 LCS diff(추가/삭제/치환 묶기, 문단은 ¶ 토큰), 규칙 자동 분류 5종(typo: 어절 안 편집거리 ≤34% 또는 부호·띄어쓰기만 / sensitive: 삭제 구절에 키워드 / term: 시험·콘텐츠 용어 / structure: 8어절 이상 또는 문장 단위 / flow: 나머지), 여러 원문을 탈고문 등장 순서로 이어 붙이는 `mergeSources` | `compare.ts` | 실데이터 1편 27건 분류 확인 | ✅ |
| R5-02 | DB | 0015·0016 | `ax_edit_comment`(원고·변경 키·작성자·본문), `ax_edit_label`(편집자가 고친 규칙), `articles.qna_ids_json`(원문 여러 개). 로컬·원격 적용 | `migrations/0015_*.sql`, `0016_*.sql` | 원격 실행 확인 | ✅ |
| R5-03 | BE | `/api/ax/compare/{source,comments,label}` | 원문 확정(여러 개), 댓글 추가·삭제(본인만), 규칙 라벨 upsert. 전부 로그인 필요 | `src/app/api/ax/compare/**` | tsc | ✅ |
| R5-04 | FE | `/ax/published/[issueId]/[articleId]/compare` | 원문 후보 5건(점수·질문·미리보기, 체크 여러 개, 확정됨 배지, 원문 전체 보기) → 확정 버튼 / 범례(규칙별 건수, 켜고 끄기) / 탈고문 본문에 번호·규칙색 배경·삭제 취소선·추가 밑줄·치환 굵게, 댓글 있으면 말풍선 / 오른쪽 고정 패널: 규칙 드롭다운(저장), 원문·탈고문 대조, 댓글 목록·입력(Cmd+Enter). 원고 읽기 히어로에 "원문 비교" 링크 | `CompareView.tsx`, `compare/page.tsx`, `queries/compare.ts`, `globals.css` | 스크린샷. **클릭·댓글 동작은 실브라우저 확인 필요** | ⏳ |
| R5-05 | FE | `/ax/toc/[tocId]/[msId]` | **탈고 편집기에 같은 표기 적용** — 교정 목록 카드와 원문/탈고문 두 칸을 없애고, 원문 위에 러너 교정을 인라인으로(번호, 규칙색, 반영 항목은 취소선+교정, 미반영은 점선), 범례(규칙별 건수, 켜고 끄기), 오른쪽 패널(규칙 배지, 반영/되돌리기, 원문·교정 대조, 댓글). 댓글은 같은 테이블(`ax_edit_comment`, article_id 자리에 원고 id, edit_key = 교정 id). 밑줄·직접 편집·저장·확정·검수 그대로 | `RevisionEditor.tsx`, `[msId]/page.tsx`, `globals.css` | 스크린샷. 교정 있는 원고 실브라우저 확인 필요 | ⏳ |
| R5-06 | FE | 게재 원고 표·히어로 | 학생 칼럼에 섞여 있던 관 정보를 별도 "관" 열로 분리, 히어로 메타도 이름·관·반 각각 | `published/[issueId]/page.tsx`, `[articleId]/page.tsx` | 스크린샷 | ✅ |
| R5-07 | DB+BE+FE | 권한 | **역할 2종**(0017: 관리자/편집자, 기존 운영관리자→관리자, 기본값 편집자, 옛 쿠키 호환). 관리자 화면 `/admin/users`(계정 추가·역할 변경·차단, 자기 자신 보호) + API `/api/admin/users`. 편집자는 데이터 관리 중 **수기 DB만** 열리고 데이터 대시보드·질문지·작성자·평가 DB는 사이드바 자물쇠 + 잠금 안내(용역비 정보는 전부 잠긴 화면에만 있음). 원고 관리는 편집자도 전부 사용. 관리자 2명(apsongpark·gracesongha), 편집자 5명(shnelbom·chaykim1208·sonhyeonchae·suhyi055·backhansu) D1 등록 + GCP 테스트 사용자 등록 | `migrations/0017_roles.sql`, `auth.ts`, `api/admin/users`, `admin/users/page.tsx`, `UsersAdmin.tsx`, `Locked.tsx`, `SidebarNav.tsx`, data 페이지 5개 | tsc, 원격 D1 확인. **편집자 계정 실로그인 확인 필요** | ⏳ |
| R5-08 | FE | `/admin/users` | 표 안 역할 드롭다운(셀 넘침 숨김 때문에 안 열리고 36px로 큼) → 역할 배지 + "관리자로/편집자로" 밑줄 링크 토글(표 안 동작 규칙). 상단 계정 추가 줄의 드롭다운은 표 밖이라 유지 | `UsersAdmin.tsx` | 스크린샷 | ✅ |
| 한계 | — | — | 비교는 매번 계산이라 본문이 바뀌면 변경 키가 바뀌어 댓글이 떨어질 수 있음(게재 원고는 고정이라 실사용 문제 없음). 동명이인은 같은 기수 이름 일치로 후보에 포함. 문장 순서를 바꾼 편집은 삭제+추가로 잡힘 | — | — | — |

### 4회차 — 2026-09-14 원고 대시보드 고도화·역대 표지·진행률 검정 (미커밋)

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R4-01 | FE+BE | `/ax` | **원고 대시보드 고도화**(컨펌 7항목). KPI 4칸(편집 중 호차·전체 진행률·확정 수기/원고 확정·검수 필요) / 왼쪽: 호차별 진행 카드(진행률 + 3단계 막대 + 목차 행에 현재 단계·담당) + 최근 편집 원고 10건 표(교정 편집기 링크) / 오른쪽: 할 일(확정 대기 목차·검수 필요·탈고 대기·원고 확정 대기·EXPORT 가능, 0건은 숨김) · AI 러너 상태(3분 무신호면 "꺼짐" + 실행 명령) · 데이터 준비 현황(기수별 막대) · 발행 요약. 신규 쿼리 `listRecentManuscripts` | `src/app/(app)/ax/page.tsx`, `src/lib/ax.ts`, `globals.css` | 스크린샷 1440px | ✅ |
| R4-02 | FE | 전 화면 | **진행률 바 전부 검정**(`--text`) — 0%·100%·검수 경고 색 구분 폐지, 대시보드 3단계·기수 막대 포함 | `globals.css` | grep 확인 | ✅ |
| R4-03 | 자산 | 표지 | **역대 표지 확보**. ① `archive/cover` 별칭 → iCloud `2025 Designs/Archive (~2024)` 표지 PDF(펼침) 앞표지: 2021-final, 2023-2/3/4, 2025-1/2 ② 2026 2호차 컬러 인서트 갤러리 썸네일(저해상 대체): 2023-1, 2023-final, 2025-3, 2026-1/2 ③ 기존 2027-1/2. `Final호차` 키 `<연도>-final` 지원. 없음: 2026 3~5호차 | `public/covers/*.jpg`(13장), `src/lib/covers.ts` | 확인 시트 | ✅ |
| R4-04 | FE | 셸 | **맨 위로 버튼** — 600px 이상 내려가면 오른쪽 아래 40px 버튼(ArrowUp), 부드러운 스크롤 | `src/components/ui/ScrollTop.tsx`, `AppShell.tsx`, `globals.css` | 코드 검토. **스크롤 동작 실브라우저 미확인** | ⏳ |
| R4-05 | FE | `/ax` | 대시보드 2컬럼만 — KPI 4칸을 왼쪽 컬럼 맨 위로, 할 일을 오른쪽 컬럼 최상단으로(첫 섹션 윗선 제거) | `ax/page.tsx`, `globals.css` | 스크린샷 | ✅ |
| R4-06 | FE | 표 헤더 | 필터 아이콘 정리 — 모든 열에 붙던 위아래 화살표(ChevronsUpDown) 삭제, 정렬 중인 열에만 화살표. 깔때기는 셀 오른쪽 끝 고정 위치에 호버·활성 시만. 필터 패널 폭 260, 패딩 12/14px, 글자 13px로 통일 | `DataTable.tsx`, `globals.css` | tsc. 실브라우저 확인 필요 | ⏳ |
| R4-07 | FE | `/ax` | 대시보드 **구분선 규칙 통일** — 선은 섹션 시작(제목 위)에만, 각 컬럼 첫 섹션은 없음. KPI 카드·첫 호차 카드의 윗선 제거, 호차 카드 사이만 선. 표는 표 규칙 그대로 | `ax/page.tsx`, `globals.css` | 스크린샷 | ✅ |
| R4-08 | DB | 2027 1호차 목차 | **1호차 목차 6개 생성**(게재 원고 구조 기준): Part 1 지난 항해를 돌아보며(1) / Part 2 Ch1 1년 공부몰입도(6) / Ch2 하루 공부몰입도(9) / Part 3 6평을 위한 항해지도(10) / Part 4 상반기 추천 콘텐츠(15) / Part 5 실수 보완법(7). 한마디는 게재 원고의 목차 리드문, 목차내용은 편집 브리프로 작성. 데모 목차 toc_test01은 Part 2 Ch1로 바꿔 확정 수기 3편 보존. **로컬 D1만 적용**, 원격은 `scripts/seed/2027-1_toc.sql` | `scripts/seed/2027-1_toc.sql` | 목차 입력 화면 6개 표시 | ✅(로컬) |
| R4-09 | 자산 | 히어로 | 넣어두신 `항해일지 배경.png`(iCloud 1호차 폴더, 돛단배 8개 모티프) 확인 → 표지 없는 호차의 히어로 기본 배경 `public/hero-bg.jpg` | `IssueHero.tsx`, `public/hero-bg.jpg` | 2026 3호차 히어로 | ✅ |
| R4-10 | FE | 표 헤더 | 필터 아이콘 → 아래로 좁아지는 세 줄(`ListFilter`) | `DataTable.tsx` | — | ✅ |
| R4-11 | FE | `/settings` | **환경설정** 메뉴(사이드바 "설정" 섹션) — 포인트 컬러: 기본 마크 블루 + 브랜드 프리셋 5(블루 블랙·네이비·틸·퍼플·딥 그레이) + 직접 지정(hex·컬러 피커) + 기본값 복원 + 미리보기. 진한색·wash 2단계·포커스 링을 선택 색에서 계산. 브라우저 localStorage 저장, 셸에서 첫 렌더 후 적용 | `src/lib/theme.ts`, `src/components/settings/PointColorSettings.tsx`, `src/components/shell/ThemeInit.tsx`, `settings/page.tsx`, `SidebarNav.tsx`, `globals.css` | 스크린샷. **색 변경 실브라우저 미확인** | ⏳ |
| R4-12 | FE | `/ax` 할 일 | 숫자 배지 24px 정방형, 숫자 중앙(100 이상은 가로 확장) | `globals.css`, `ax/page.tsx` | 스크린샷 | ✅ |
| R4-13 | FE | 목차 입력 | 목차내용·한마디 입력창 높이 통일(88px) | `TocInputEditor.tsx`, `globals.css` | 스크린샷 | ✅ |
| R4-14 | FE | 상세 화면 전부 | **뒤로가기·히어로 제목 규칙 통일** — 공통 `Hero`: 뒤로가기는 "‹ 상위 화면의 제목" 그대로(호차→편집 중 항해일지, 목차→2027 항해일지 1호차, 원고→목차명, 게재 원고→호차명, 작성자→작성자 DB), 제목은 현재 객체 전체 이름 한 줄, eyebrow 삭제, 메타는 간격 구분(중간 점 없음). 작성자 상세의 [목록] 버튼 → 뒤로가기 | `src/components/ui/Hero.tsx`, `IssueHero.tsx`, toc/ms/article/author 페이지 | 스크린샷 3장 | ✅ |
| R4-15 | FE | 전 화면 | 사용자 노출 문구의 중간 점(·) 15곳 제거 → 쉼표·괄호·간격(G-6) | 12개 파일 | grep 0건 | ✅ |
| R4-16 | FE | 표 전부 | 행 높이 기본 40px로 통일(compact/comfortable 지정 전부 제거, 예외 시만 사용). 헤더의 정렬 화살표와 필터 아이콘은 **열 오른쪽 끝**에 모아 정렬 | `DataTable.tsx`, `globals.css`, 페이지 4개 | 스크린샷 | ✅ |
| R4-17 | FE | `/settings` | 환경설정 재구성 — **항목형 목록**(왼쪽 이름·설명, 오른쪽 컨트롤, 항목 사이 윗선). 포인트 컬러는 **한 항목**(현재 색 박스 + 프리셋 드롭다운 + "직접 지정" 시 hex·피커·적용, 기본값 버튼, 아래 미리보기 줄 여유 있게). 컬러 피커는 안쪽 여백 없이 박스를 가득 채움. 추가 항목: 사이드바 기본 상태, 수기 DB 한 화면 행 수(25/50/100, 쿠키로 서버 반영), 정렬·필터 기억(준비 중, 비활성), AI 러너 꺼짐 판정(3/10/30분, 대시보드 반영), 계정(마이페이지·로그아웃), 모든 설정 초기화. 저장은 localStorage + 쿠키 `hj.settings` | `src/lib/settings.ts`, `SettingsForm.tsx`, `settings/page.tsx`, `AppShell.tsx`, `qna/page.tsx`, `ax/page.tsx`, `queries/data.ts`, `globals.css` | 스크린샷. **드롭다운·피커 실브라우저 미확인** | ⏳ |
| R4-18 | FE | 표 전부 | 헤더 바탕 wash-2(진하게) + 글자 포인트 진한색으로 행 hover(wash-1)와 구분. **모든 헤더 좌측 정렬**(숫자 열도 헤더는 왼쪽, 셀만 오른쪽), 필터 패널도 왼쪽 기준 | `globals.css` | 스크린샷 | ✅ |
| R4-19 | 배포 | 라이브 | 커밋 `ace5885` 푸시, 원격 D1 0013·0014·1호차 목차 시드 적용, `npm run deploy` 성공. 라이브는 로그인 게이트 활성(미로그인 → /login) | — | curl 307/200 | ✅ |
| R4-20 | 인증 | Google | GCP `sdij-journal` 프로젝트에 Google 인증 플랫폼 구성(외부·테스트), OAuth 웹 클라이언트 발급, Worker secret GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET·AUTH_SECRET 등록, 테스트 사용자·허가 계정 2개. `/api/auth/google`이 accounts.google.com으로 307 확인 | GCP 콘솔, wrangler secret | curl. **로그인 왕복은 사용자 확인 대기** | ⏳ |
| R4-21 | BE+FE | 인증·마이페이지 | 세션 쿠키 복호화 버그(atob 결과를 UTF-8로 안 풀어 한글 이름·역할 깨짐) 수정. 마이페이지 **이름 바꾸기**(인라인 편집 → `PATCH /api/me`, app_users.name 갱신 + 세션 재발급). 배포 완료 | `src/lib/auth.ts`, `src/app/api/me/route.ts`, `NameEditor.tsx`, `my/page.tsx` | tsc, 배포. 실브라우저 확인 대기 | ⏳ |
| 회귀 | — | — | G-1 tsc ✅ · G-9 배포 ✅ | — | — | ⏳ |

### 3회차 — 2026-09-14 포인트 컬러·표 통일·검색/드롭다운·사이드바 접기 (미커밋)

컨펌된 8개 + 추가 지시 3개(검색창 UI, 커스텀 드롭다운, 오류 시 사이드바 유지).

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R3-01 | FE | 셸 | 사이드바 접기/펼치기 — 브랜드 줄 오른쪽 토글, 접으면 56px 아이콘만 + 툴팁, 상태 localStorage(`hj.sidebar.collapsed`). AppShell을 클라이언트 컴포넌트로 | `src/components/shell/AppShell.tsx`, `SidebarNav.tsx`, `globals.css` | 스크린샷(펼침). 접힘은 헤드리스에서 미확인 → 실브라우저 확인 필요 | ⏳ |
| R3-02 | FE | 셸 | 사용자 이름 옆 28px 아바타 — Google 사진(`picture`), 없으면 이름 첫 글자 wash-2 바탕 | `src/components/ui/Avatar.tsx` | 스크린샷(개발 바이패스 "로") | ✅ |
| R3-03 | FE | 표 전부 | `DataTable` 단일 규격 — 13px, 헤더 32px wash-1, 행 32px, 숫자 우측 정렬, hover wash-1, 두 줄 금지(clip). 적용: 데이터 대시보드 2표, 작성자 DB, 수기 DB, 질문지 DB, 평가 DB, 호차 목록, 탈고 목록, 원고 보드, 선별 보드 | `src/components/ui/DataTable.tsx` + 9개 파일 | 스크린샷 4장, 행 높이 32px | ✅ |
| R3-04 | FE | 전 화면 | 포인트 컬러 `#0074D2`(파비콘 실측) — 코랄·`#0077C1`·인디고 삭제, 활성 메뉴·주요 버튼·링크·진행바·포커스 링·단계 표시 통일. 작은 글자용 `#005BA8` | `globals.css` | `grep coral|0077c1` 0건 | ✅ |
| R3-05 | FE | 전 화면 | wash 2단계 `#EAF3FC`·`#D5E7F8` — 표 헤더·행 hover·배지 바탕·드롭다운 hover·아바타 | `globals.css` | 스크린샷 | ✅ |
| R3-06 | FE | 표 전부 | 행 높이 3단계 규칙(`density`): compact 32(데이터 대시보드 요약표 2개) / default 40(작성자·질문지·호차·탈고·선별) / comfortable 48(수기 DB, 평가 DB, 원고 보드). 배지 20px, 표 안 버튼 24px. 수기 DB 이름 아래 유형 → 별도 열, 답변은 한 줄 말줄임. 처음 32px 일괄 적용은 "너무 좁다" 피드백으로 철회 | `DataTable.tsx`, `globals.css`, 적용 4개 파일 | 스크린샷 | ✅ |
| R3-07 | FE | `/ax`, `/data` | 카드 그리드 아래 구분선 삭제(윗선만) | `globals.css` | 스크린샷 | ✅ |
| R3-08 | FE | 표 전부 | 헤더 클릭 정렬(오름 → 내림), 아이콘 표시, 숫자·문자·빈값 혼합 정렬, 표시값과 정렬값 분리(`sortKey`). 수기 DB는 현재 화면(50건) 안에서만 정렬 — 서버 정렬은 후속 | `DataTable.tsx` | 코드 검토. **클릭 동작은 실브라우저 미확인** | ⏳ |
| R3-09 | FE | 필터 바 | 검색창 `SearchInput` — 연한 바탕, 돋보기, placeholder 채움("이름으로 검색", "최종대학으로 검색", "답변 본문이나 작성자 이름으로 검색"), Enter 확정, 지우기 X | `src/components/ui/SearchInput.tsx`, `FilterBar.tsx` | 스크린샷 | ✅ |
| R3-10 | FE | 필터 바·호차 추가 | 커스텀 드롭다운 `Dropdown` — 기본 `<select>` 전부 교체(필터 3곳, 호차 추가 모달), 화살표 오른쪽 끝 고정, 패널 그림자·hover·체크, Esc/바깥 클릭 닫힘 | `src/components/ui/Dropdown.tsx`, `FilterBar.tsx`, `AddIssueButton.tsx` | `grep '<select'` 0건. **열림 동작 실브라우저 미확인** | ⏳ |
| R3-11 | FE | 오류·404 | 셸 안 404(`/ax/published` 등)와 페이지 오류가 사이드바를 유지 — `(app)/not-found.tsx` + `[...rest]` catch-all + `(app)/error.tsx` 재작성. 셸 밖 404는 로그인 스타일 | `src/app/(app)/[...rest]/page.tsx`, `(app)/not-found.tsx`, `(app)/error.tsx`, `src/app/not-found.tsx` | `/ax/published` 스크린샷(사이드바 유지) | ✅ |
| R3-12 | FE | 표 전부 | 셀 밖으로 글이 넘치던 문제 — 링크형 셀(질문지 DB 질문 등)이 말줄임 없이 옆 열로 침범. `td`에 overflow hidden + 유연 열은 항상 clip span으로 감쌈. 1280px에서 질문지 DB 9기·수기 DB 8기 확인 | `DataTable.tsx`, `globals.css` | 스크린샷 1280px | ✅ |
| R3-13 | FE | `/my` | 마이페이지 신설 — 아바타 64px, 이름·이메일·역할·로그인 방식·최근 로그인·등록일·상태 키-값 표, 로그아웃. 사이드바 프로필 블록이 링크(활성 시 포인트색) | `src/app/(app)/my/page.tsx`, `SidebarNav.tsx`, `globals.css` | 200, 스크린샷 | ✅ |
| R3-14 | FE | `/ax/issues/[issueId]` | 호차 주소가 브라우저 측 리다이렉트(스트리밍 200 + NEXT_REDIRECT)라 빈 화면이 먼저 보이던 문제 — 리다이렉트 제거, 현재 단계 탭 화면을 서버에서 바로 렌더. GNB 탭은 인덱스에서 현재 단계 탭 활성, 스테퍼 6단계는 각 탭 링크(완료 단계로 되돌아가기 가능) | `[issueId]/page.tsx`, `layout.tsx`, `GnbTabs.tsx`, `StageStepper.tsx`, `ax-progress.ts` | curl 200 + NEXT_REDIRECT 0건, 스크린샷 | ✅ |
| R3-15 | FE | 셸 | 사이드바 토글 아이콘 단순화 — 패널 아이콘 → 홑화살표(ChevronLeft/Right) | `SidebarNav.tsx` | 스크린샷 | ✅ |
| R3-16 | FE | `/ax/issues/[issueId]` | 단계 UI 재설계 — 원형 스테퍼 + 3탭 두 줄을 **6단계 한 줄**로 통합. 1차 셀 구분선 방식은 "탭 선택·구분선 두께 이상" 피드백으로 철회 → 세로선·박스 없이 **열린 화면에 속한 단계 아래에만 2px 포인트 밑줄**, 22px 번호 배지(완료 = 포인트 채움 체크, 현재 = 포인트 테두리 + wash), 미래 단계 회색. `StageStepper`·`GnbTabs` 삭제 | `src/components/ax/StageTabs.tsx`, `layout.tsx`, `globals.css` | 스크린샷 | ✅ |
| R3-17 | FE | 호차 히어로 | 표지 이미지 — iCloud `2026 Design/2027 항해일지 N호차/*_표지_인쇄용*.pdf`(뒷·앞표지 펼침 인쇄용)에서 앞표지만 150dpi로 잘라 `public/covers/2027-1.jpg`·`2027-2.jpg`(1000px, 컬러바·재단선 제외). 썸네일 → "그라데이션으로 히어로 전체" → "너무 확대하지 말 것" 피드백을 거쳐 **오른쪽에 히어로 높이 2배 크기(표지 상단 절반)로 두고 왼쪽 46%는 바탕색, 오른쪽으로 투명해지는 그라데이션**. 제목은 "2027 항해일지 1호차" 한 줄 h1(eyebrow 삭제). 매핑 규약 `<연도>-<호차번호>`는 `src/lib/covers.ts` | `IssueHero.tsx`, `covers.ts`, `public/covers/*` | 스크린샷(1호차·2호차) | ✅ |
| R3-18 | FE | `/ax/published`, `/ax/published/[issueId]`, `/ax/published/[issueId]/[articleId]` | **편집 완료 항해일지 신설(articles DB 기준)** — 발행 호차 13개 + 게재 원고 수 표, 호차별 게재 원고 표(Part·Chapter·목차/구획·소제목·학생·진학·글자·원본), 원고 읽기(본문 15px/1.9 + 목차 한마디·comment·출처, 원본 수기 링크). 히어로에 표지 | `src/lib/queries/published.ts`, `src/app/(app)/ax/published/**`, `globals.css` | curl 200 × 3, 스크린샷 3장 | ✅ |
| R3-19 | FE | `/ax/issues/[issueId]/toc-input` | **"이전 단계를 볼 수 없다"의 진짜 원인** — 목차 입력 화면이 열리자마자 큐를 조회해 선별 완료 목차가 하나라도 있으면 즉시 [AI 수기 선별]로 밀어냈음. 이 화면에서 실행 중(queued/running)을 본 뒤 끝났을 때만 넘기도록 수정(`sawActive`). 완료된 1단계를 다시 열어 편집 가능 | `TocInputEditor.tsx` | `/toc-input` 스크린샷에 목차 편집기 표시 | ✅ |
| R3-20 | FE | 호차 히어로 | 표지 재작업 3차 — 배경 방식(직사각형 테두리 노출) 철회. `<img>`를 오른쪽 34%(최대 420px)에 `object-fit: cover`로 두고 **왼쪽 가장자리를 마스크 그라데이션으로 녹여** 테두리가 안 보이게. 확대 없음(원본보다 축소) | `IssueHero.tsx`, `globals.css` | 스크린샷 | ✅ |
| R3-21 | FE | 단계 줄 | 단계 **하나만** 선택 — 주소에 `?step=<stage key>`를 붙여 6단계 중 하나에만 밑줄. step이 없으면 인덱스는 현재 단계, 화면 주소는 그 화면의 현재 단계(없으면 첫 단계). 같은 화면에 묶인 2·3 / 4·5·6 단계는 내용이 같음(후속: 단계별 내용 분리 검토) | `StageTabs.tsx` | 스크린샷 3장(1·3·4 선택) | ✅ |
| R3-22 | FE | 세 단계 화면 | 다음 단계 버튼 위치 통일 — `StageBar`(단계 줄 바로 아래, 왼쪽 요약·보조, **오른쪽 끝 주요 버튼 하나**, 아래 구분선 없음 — "쓸데없는 구분선" 피드백으로 삭제). 목차 입력 [AI 수기 선별 시작 →], 수기 선별 [AI 원고 탈고로 →], 원고 탈고 [원고 EXPORT](전 원고 확정 + 목차 1개일 때만 활성) | `StageBar.tsx`, `TocInputEditor.tsx`, `SelectBoard.tsx`, `revise/page.tsx` | 스크린샷 3장 | ✅ |
| R3-23 | FE | 목차 입력 | 목차 카드 박스 → 윗선만(`.toc-card`). 휴지통 버튼 → 케밥(⋯) 메뉴 [위로 이동 / 아래로 이동 / 삭제]. 순서 변경은 이웃 목차와 Part·Chapter 번호를 맞바꿔 둘 다 저장(정렬 기준이 번호) | `KebabMenu.tsx`, `TocInputEditor.tsx`, `globals.css` | 스크린샷. **케밥 클릭·이동 동작은 실브라우저 미확인** | ⏳ |
| R3-24 | FE | 목차 입력 | **목차 미리보기** 모달 — 액션 바 왼쪽 [목차 미리보기]. Part로 묶고 Chapter 순, 한마디·선별 편수, 합계. 번호 없는 목차는 맨 뒤 | `TocInputEditor.tsx`(`TocPreview`), `globals.css` | 코드 검토. **모달 열기는 실브라우저 미확인** | ⏳ |
| R3-25 | FE | 단계 줄 | 같은 화면을 쓰는 단계 통합 → **3단계**: 1 목차 입력 / 2 수기 선별과 확정 / 3 원고 탈고와 확정. 부제에 묶인 세부 단계 중 현재 단계와 분수("편집자 수기 확정 0/1"), 완료면 "완료", 미래면 세부 단계 나열. `?step=` 방식 폐기 | `StageTabs.tsx` | 스크린샷 | ✅ |
| R3-26 | BE+DB | 수기 확정 | **확정자·확정 일시** — `migrations/0014_toc_confirmed_by.sql`(ax_toc.confirmed_by, 로컬 적용, 원격은 배포 시), confirm API가 현재 사용자 이름 기록, 선별 화면 표에 확정자·확정 일시 열 | `migrations/0014_*.sql`, `api/ax/confirm/route.ts`, `SelectBoard.tsx`, `lib/ax.ts` | tsc, 스크린샷(기존 확정 건은 확정자 NULL → "-") | ✅ |
| R3-27 | FE | 표 전부 | 표 안 버튼 → **밑줄 링크 버튼**(`.tbl-link`, 포인트 진한색, 박스·아이콘 없음). 이동하기·원고 보기·원고 작업·편집·후보 검토 | `DataTable.tsx`, `ManuscriptBoard.tsx`, `SelectBoard.tsx`, `globals.css` | 스크린샷 | ✅ |
| R3-28 | FE | 표 전부 | 표 바깥 **세로 테두리 제거**(위아래 선만). 필터 패널이 잘리지 않도록 `.table-wrap` overflow visible | `globals.css` | 스크린샷 | ✅ |
| R3-29 | FE | 표 전부 | **열 필터**(스프레드시트 방식) — 헤더 호버 시 깔때기, 클릭 → 값 목록 체크(개수 표시, 9개 이상이면 값 검색, "보이는 값 모두 선택", 지우기). 배지는 한글 라벨·금액은 원 표기. 여러 열 AND. 활성 필터는 표 위 칩 줄(개별 ×, 모두 지우기), 결과 0건이면 안내 + 지우기. 긴 글(clip)·진행률·버튼 열은 제외. 현재 화면의 행 안에서만 동작(수기 DB는 50건 페이지 안) | `DataTable.tsx`, `globals.css` | tsc. **패널 열기·체크 동작은 실브라우저 미확인** | ⏳ |
| R3-30 | FE | 버튼 | 버튼 아이콘 규칙 통일 — 실행 동작은 앞 아이콘 하나, 이동은 뒤 화살표 하나, 둘 다 금지. 위반 1건("AI 수기 선별 시작" 앞 Sparkles + 뒤 화살표) 수정, 아이콘 여백 보정 | `TocInputEditor.tsx`, `globals.css`, DESIGN.md | 스캔 스크립트로 2개 아이콘 버튼 0건 | ✅ |
| 회귀 | — | — | G-1 tsc ✅ `next build` ✅(개발 서버 정지 후) · G-2 dev.log 오류 0 · G-5 ✅ · G-9 미배포 | — | curl 11경로 200 | ⏳ |

### 2회차 — 2026-09-14 라운드 제거·데이터 관리 D1 연결 (미커밋)

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R2-01 | FE | 전 화면 | 둥근 모서리 제거 — 토큰을 DESIGN.md §5.5 실측으로: xs 0, sm 2(버튼), md 3(입력), lg 5(textarea·모달). 카드·표·배지·알림·진행바·후보 카드·diff 항목·내비 항목·점수 칩은 0. 원형(마크·단계 번호)만 유지 | `src/app/globals.css` | 남은 radius 값 = 0, 2px, 50%, 토큰 4종 | ✅ |
| R2-02 | FE | `/data` | 1차 `/dashboard` 이동 + "기수별 준비율" 표(작성자·제출·AI 평가·선별·준비율 바) 추가 | `src/app/(app)/data/page.tsx` | 200, 실데이터 | ✅ |
| R2-03 | FE | `/data/authors`, `/data/authors/[id]` | 1차 `/essays` 이동. 제목 "작성자 DB". StubButton(수기 업로드·자동 탈고) 삭제 | `src/app/(app)/data/authors/**` | 200 | ✅ |
| R2-04 | FE | `/data/qna` | **신규** 수기 DB — 기수·질문·검색어 필터, 50건 페이징, 답변 220자 미리보기, 작성자 상세 링크 | `src/app/(app)/data/qna/page.tsx`, `src/lib/queries/data.ts` | 9기 4,705건 | ✅ |
| R2-05 | FE | `/data/questions` | **신규** 수기 질문지 DB — 기수 필터, key·분류·답변 수·평균 글자, 질문 클릭 → 수기 DB 필터 | `src/app/(app)/data/questions/page.tsx` | 194개 | ✅ |
| R2-06 | FE | `/data/evaluations` | 1차 `/evaluations` 이동. 제목 "작성자 평가 DB". StubButton 3개와 가짜 in-memory 선택 체크박스 삭제, AI 의심 열 추가 | `.../data/evaluations/page.tsx`, `src/components/EvaluationSelectionTable.tsx` | 200 | ✅ |
| R2-07 | BE | 쿼리 | **mock 모드 삭제** — `mockData.ts` 제거, 4개 쿼리 모듈의 `USE_MOCK` 분기 제거, `next.config.ts`는 항상 Cloudflare 바인딩 초기화(G-8 충족) | `src/lib/queries/*.ts`, `next.config.ts` | `grep USE_MOCK` 0건, tsc | ✅ |
| R2-08 | FE | 리다이렉트 | `/dashboard`→`/data`, `/essays`→`/data/authors`, `/essays/[id]`→`/data/authors/[id]`, `/evaluations`→`/data/evaluations` (308 영구) | `next.config.ts` | curl 308 확인 | ✅ |
| 회귀 | — | — | G-1 tsc ✅ · G-5 ✅ · G-8 ✅ · G-2·G-7 미실행 · G-9 미배포 | — | curl·스크린샷 | ⏳ |

### 1회차 — 2026-09-14 서비스명·파비콘·아이콘·구분선 카드·로그인 와꾸 (미커밋)

컨펌된 6개 항목. 로컬 `http://localhost:3000`에서 확인했고 커밋·배포는 지시 대기.

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R1-01 | FE | 전 화면 | 서비스명 **"항해일지 AUTO"** — `<title>`, 사이드바 브랜드(부제 "항해일지 AX 시스템" 삭제) | `src/app/layout.tsx`, `src/components/shell/SidebarNav.tsx` | curl `<title>` 확인, `grep '시대인재 AUTO' src` 0건 | ✅ |
| R1-02 | FE | 파비콘·로고 | `favicon.ico.png`(279px) → `src/app/icon.png`(파비콘 자동), `apple-icon.png`(180), `public/logo-mark.png`(128). 사이드바 24px 마크 + 로그인 64px 마크 | `src/app/icon.png`, `src/app/apple-icon.png`, `public/logo-mark.png` | HTML `rel=icon`·`apple-touch-icon` 출력, 스크린샷 | ✅ |
| R1-03 | FE | 전 화면 | 아이콘 단일 규격 `Icon` 래퍼 — lucide, 크기 sm12/md16/lg20, 선 1.5px 고정(absoluteStrokeWidth), currentColor, aria-hidden. 14개 파일의 개별 size/strokeWidth 지정 전부 제거 | `src/components/ui/Icon.tsx` + 14개 tsx | `grep strokeWidth= src` 0건(래퍼 제외), tsc | ✅ |
| R1-04 | FE | AX-HOME `/ax` | 카드 → 구분선. `.issue-card`·`.stat-card` 박스 보더·radius 제거, 위 1px 선 + 그리드 아래 선, 상하 패딩 20/16px, 열 간격 24px, 호버 윗선 검정 | `src/app/globals.css` | 스크린샷 1440px | ✅ |
| R1-05 | FE | `/login` | 로그인 페이지(마크 + 이름 + 안내 + Google 버튼 §7.4 규격 42px/radius 2). 오류 3종(`unauthorized`/`oauth`/`config`) 문구, 미설정 시 버튼 비활성 | `src/app/login/page.tsx`, `globals.css` | 스크린샷, `?error=` 분기 | ✅ |
| R1-06 | BE | 인증 | Google OIDC 직접 구현(의존성 없음): state 쿠키 → 토큰 교환 → tokeninfo 검증(aud·email_verified) → `app_users` 허가 확인 → HMAC 서명 세션 쿠키 `hj_session`(7일) | `src/lib/auth.ts`, `src/lib/auth-google.ts`, `src/app/api/auth/{google,callback,logout}/route.ts` | 미설정 시 `/api/auth/google` → `/login?error=config` 확인. **실 Google 왕복은 미검증**(클라이언트 미발급) | ⏳ |
| R1-07 | FE | 전 화면 | 라우트 그룹 `(app)` 신설 — 기존 페이지 전부 이동(URL 불변), 그룹 레이아웃이 세션 검증 후 셸 렌더, 실패 시 `/login`. `middleware.ts`는 쿠키 없으면 즉시 리다이렉트(API는 401). 개발 모드·`AUTH_DEV_BYPASS=1`은 통과 | `src/app/(app)/layout.tsx`, `src/middleware.ts` | 바이패스 끄고 `/ax`→307 `/login`, `/login` 200, 복구 후 `/ax` 200 | ✅ |
| R1-08 | FE | 사이드바 | 하단 사용자 블록(이름·역할·로그아웃 링크) | `SidebarNav.tsx`, `globals.css` | 스크린샷 | ✅ |
| R1-09 | DB | `app_users` | 허가 계정 테이블 마이그레이션 + 첫 계정(apsongpark@gmail.com, 운영관리자). **로컬만 적용**, 원격은 배포 시 | `migrations/0013_app_users.sql` | 로컬 D1 `SELECT` 1행 | ✅(로컬) |
| R1-10 | DOC | — | `.dev.vars.example`, README 로그인 설정 절차, DESIGN.md §6.2.3 규칙(서비스명·아이콘·카드), QA.md 이 표 | `README.md`, `DESIGN.md`, `.dev.vars.example` | — | ✅ |
| 회귀 | — | — | G-1 tsc ✅ `next build` ✅ · G-3 ✅ · G-4 ✅ · G-5 1440px ✅ · G-10 ✅ · G-2 콘솔·G-7·G-8 미실행 · G-9 미배포 | — | 빌드·curl·스크린샷 | ⏳ |

### 0회차 — 2026-09-14 기준선 (커밋 `11e9839`, 배포 Version `c5570faa`)

이 문서를 만들기 직전까지의 상태다. 검증은 빌드·배포 성공까지만 했고 화면 QA는 [미해결 R0-QA](#미해결-항목)로 남긴다.

| ID | 영역 | 화면·경로 | 변경 내용 | 파일 | 검증 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| R0-01 | RUN | S4 탈고 | `REVISE_SYS` 프롬프트 · 규칙 기반 폴백 교정 5종(연속 공백, 과다 줄바꿈, 문장부호 앞 공백, ㅋㅋ/ㅎㅎ 삭제, 반복 감탄부호) · `revise` 큐 처리 | `scripts/ax-runner.mjs` | 미검증(실행 안 함) | ☐ |
| R0-02 | BE | 공용 | `applyEdits` — 승인된 교정만 원문에 반영(러너와 동일 규칙) | `src/lib/revision.ts` | 빌드 | ✅ |
| R0-03 | BE | `/api/ax/revise` | 탈고 큐 등록 라우트 신설 | `src/app/api/ax/revise/route.ts` | 빌드 | ✅ |
| R0-04 | BE | `/api/ax/finalize` | 원고 확정 라우트 신설 | `src/app/api/ax/finalize/route.ts` | 빌드 | ✅ |
| R0-05 | BE | `/api/ax/manuscript`, `/api/ax/export/[tocId]` | 교정 승인 저장 · export 보강 | `src/app/api/ax/manuscript/route.ts`, `src/app/api/ax/export/[tocId]/route.ts` | 빌드 | ✅ |
| R0-06 | FE | TOC `/ax/toc/[tocId]` | 원고 보드 신설 | `src/app/ax/toc/[tocId]/page.tsx`, `src/components/ax/ManuscriptBoard.tsx` | 빌드 | ✅ |
| R0-07 | FE | MS `/ax/toc/[tocId]/[msId]` | 교정 승인 편집기 신설 | `src/app/ax/toc/[tocId]/[msId]/page.tsx`, `src/components/ax/RevisionEditor.tsx` | 빌드 | ✅ |
| R0-08 | DOC | — | PROCESS.md·CLAUDE.md 단계 정의 현행화, 아카이브 파서·적재 스크립트 소폭 수정 | `PROCESS.md`, `CLAUDE.md`, `scripts/parse_print_pdf.py`, `scripts/load_articles.py` | — | ✅ |
| 회귀 | — | — | G-1 빌드 ✅ · G-9 배포 ✅ · G-2~G-8 미실행 | — | 빌드·배포 | ⏳ |

---

*이 문서는 `PRD.md`·`PROCESS.md`·`DESIGN.md`에 종속된다. 기준 문서가 바뀌면 관련 항목 ID를 함께 갱신한다.*
