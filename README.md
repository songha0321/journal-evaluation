# 항해일지 AUTO

시대인재 편집국의 항해일지 원고 제작 도구. Next.js(OpenNext) + Cloudflare Workers + D1.

- 라이브: https://sdij-journal.gracesongha.workers.dev
- 문서: `PRD.md`(요구사항) · `PROCESS.md`(진행 단계) · `DESIGN.md`(디자인 규칙) · `QA.md`(수정 기록·검증) · `CLAUDE.md`(작업 지침)

## 로컬 실행

```bash
npm install
cp .dev.vars.example .dev.vars   # AUTH_DEV_BYPASS=1 → 로그인 없이 개발
npm run dev                      # http://localhost:3000/ax
```

로컬 D1은 `.wrangler/state`에 있다. 스키마 변경은 `migrations/`에 파일을 추가하고 로컬·원격에 각각 적용한다.

```bash
npx wrangler d1 execute sdij-journal --local  --file migrations/0013_app_users.sql
npx wrangler d1 execute sdij-journal --remote --file migrations/0013_app_users.sql
```

## 로그인 설정 (Google, 허가 계정만)

> 2026-09-14 설정 완료: GCP 프로젝트 `sdij-journal`(gracesongha@gmail.com 계정), 앱 "항해일지 AUTO", 게시 상태 "테스트 중"(외부). 테스트 모드에서는 **테스트 사용자로 등록된 Google 계정만** 로그인 화면을 통과하므로, 새 편집자를 추가할 때는 ① GCP 콘솔 > Google 인증 플랫폼 > 대상 > 테스트 사용자에 이메일 추가, ② 아래 3단계의 `app_users` INSERT 둘 다 필요하다.

로그인은 Google OIDC로 이메일을 확인하고 D1 `app_users`에 등록된 계정만 통과시킨다. 아래 3단계를 마쳐야 라이브에서 동작한다. 그 전에는 로그인 페이지가 "설정 대기" 상태로 뜬다.

1. **Google Cloud 콘솔** → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기(웹 애플리케이션).
   - 승인된 리디렉션 URI: `https://sdij-journal.gracesongha.workers.dev/api/auth/callback` (로컬 시험 시 `http://localhost:3000/api/auth/callback` 추가)
   - OAuth 동의 화면은 "내부"(Workspace) 또는 "외부 + 테스트 사용자"로 두고, 범위는 `openid email profile`.
2. **Worker secret 등록** (값은 콘솔에서 발급한 것, AUTH_SECRET은 32자 이상 임의 문자열):
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put AUTH_SECRET      # 예: openssl rand -base64 32
   ```
3. **허가 계정 등록** — 원격 D1에 `migrations/0013_app_users.sql` 적용(첫 계정 포함). 추가 계정은:
   ```bash
   npx wrangler d1 execute sdij-journal --remote --command \
     "INSERT INTO app_users (email, name, role) VALUES ('someone@example.com', '이름', '원고작업자')"
   ```
   역할: `원고작업자` · `운영관리자` · `디자인검수자`. 차단은 `is_active = 0`.

`AUTH_DEV_BYPASS`는 로컬 `.dev.vars` 전용이다. 프로덕션 secret에 넣지 않는다.

## 배포

```bash
npm run deploy   # opennextjs-cloudflare build + deploy
```
