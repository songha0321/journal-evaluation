# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Batch evaluator for 시대인재 `<항해일지>` 9기 수기집. Each row of an Excel sheet is a Korean student admissions journal; an LLM scores it on 4 rubric criteria (정성·구체성 / 실용성 / 독창성 / 가독성), assigns a final 0–5 score (weighted mean), a 3-tier selection state (선별/예비/제외), an AI-authorship suspicion score, a reliability risk flag (없음/주의/높음), and a one-line comment. Results are written back into the same workbook.

**The canonical rubric/criteria doc is [`EVALUATION.md`](./EVALUATION.md)** — scoring scale, weights, selection thresholds, reliability check, and output schema all live there. The two scripts follow it; when they disagree, EVALUATION.md wins.

Two interchangeable backends live side-by-side:
- `evaluate.py` — Anthropic (`claude-sonnet-4-6`), uses prompt caching on the system prompt.
- `evaluate_openai.py` — OpenAI (`gpt-4o` by default, override via `OPENAI_MODEL`), uses `response_format=json_object`.

They share the same `SYSTEM_PROMPT`, column layout, JSON schema, retry logic, and CLI surface. **When changing rubric wording, scoring scale, or output schema, edit both files** — there is no shared module.

## Running

```bash
export ANTHROPIC_API_KEY=...   # for evaluate.py
export OPENAI_API_KEY=...      # for evaluate_openai.py

python evaluate.py                              # evaluate all unscored rows
python evaluate.py --limit 5                    # smoke test on 5 rows
python evaluate.py --start 100 --end 200        # row range (1-based, inclusive)
python evaluate.py --force                      # re-evaluate rows that already have a 최종 점수
python evaluate.py --workers 4                  # change concurrency (default 8)
python evaluate.py --input X.xlsx --output Y.xlsx
```

No test suite, no linter config. Dependencies are implicit: `anthropic`, `openai`, `openpyxl`.

## Resume / checkpoint behavior — important

- If `--output` already exists, the script **loads the output file, not `--input`**, so prior results survive.
- `load_jobs` skips rows where `COL_FINAL_SCORE` (column 14) is already non-null, unless `--force`.
- The workbook is saved every `SAVE_EVERY = 20` completions and once more at the end. A crash mid-run loses at most ~20 rows.
- Consequence: to truly start fresh, delete the `_evaluated.xlsx` file. Editing the input file alone is not enough.

## Excel layout (hard-coded, 1-based)

Sheet name `수기정리`. Inputs read from columns 1, 2, 3, 4, 5, 8 (name, apply_type, university, item, char_count, body). Outputs written to 14, 15, 16, 17, 18 (final_score, selection_state 선별/예비/제외, AI_usage, one_line, reliability_risk 없음/주의/높음). Column 15 is a status string (not O/X), and column 18 is new — confirm it is free in the target workbook and add a header. If the spreadsheet layout shifts, update `COL_*` constants in both scripts.

## Conventions worth preserving

- All Korean field names in prompts, JSON keys, and CLI output are intentional — the rubric and downstream consumers expect them.
- `parse_json_response` tolerates code fences and surrounding text; do not tighten it to strict JSON unless you also relax the model's freedom.
- The final score is recomputed from the four sub-scores as a **rounded weighted mean** (`WEIGHTS`: 정성·구체성 0.4, the other three 0.2 each), then **overwritten by the model's `최종_점수` if it returned one** (criterion 1 is marked `weight="최우선"`). Selection state is derived from the final score via `selection_status()` (≥4 선별 / 3 예비 / ≤2 제외), overridable by the model's `선별_상태`.
- `.xlsx` files are gitignored; the evaluated workbook is the artifact, not a committed result.

# CLAUDE.md

## Project Overview

This project is **시대인재J 관리자**, an internal admin tool for managing student essay/testimonial data, QnA answers, authors, submissions, and edited articles.

The goal is to build a practical SaaS-style admin dashboard inspired by Notion-like database views, but customized for 시대인재J’s workflow.

Claude Code should treat this document as the handoff guide and read the `/docs` directory before making implementation decisions.

---

## Current Project Structure

Expected local structure:

```txt
/project-root
  /docs
    sdij_design.md
    product_requirements.md
    database_schema.md
  /src
    /components
    /pages
    /styles
  CLAUDE.md
```

### Important docs

* `/docs/sdij_design.md`

  * Main design system document.
  * Should define visual style, tone, layout, colors, typography, and logo usage.
  * Font should be **Pretendard** across the product.
  * Logo-related references should use the provided 시대인재 / 시대인재J logo assets, not generic placeholders.
  * Design tone should be practical admin SaaS, not overly decorative.

* `/docs/product_requirements.md`

  * Product requirements for the admin dashboard.
  * Should describe core screens, workflows, data entities, and feature priorities.

* `/docs/database_schema.md`

  * Database schema reference.
  * Should be used before creating, editing, or migrating tables.
  * Current DB direction may involve moving from Supabase-style SQL toward Cloudflare DB / D1-compatible SQL. Be careful about SQL dialect differences.

---

## Product Purpose

The app manages student-written success stories and related editorial data.

Core use cases:

1. View all submitted student data.
2. Manage authors.
3. Review QnA answers by author and question.
4. Evaluate authors based on all submitted material.
5. Detect low-quality or AI-suspicious submissions.
6. Assign ratings or scholarship results.
7. Convert raw submissions into edited articles.
8. Track editorial progress across submissions and articles.

---

## Main Data Concepts

### 1. Authors

Represents each student / writer. **Deployed schema (after migrations 0003 & 0004):**

```txt
id                    TEXT PK, default 'author_' || hex(randomblob(8))
name                  TEXT NOT NULL
cohort                INTEGER CHECK (cohort >= 5)
student_type          TEXT CHECK IN ('성적우수','성적향상','포레스트','우선선발')
hall                  TEXT
class_name            TEXT
admission_score       TEXT
final_university      TEXT
ai_evaluation_grade   TEXT   -- AI 자동 평가 등급
manual_rating         TEXT   -- 수기 수동 등급
memo                  TEXT
created_at, updated_at TEXT  default CURRENT_TIMESTAMP
-- added by 0003 (form export PII)
phone                 TEXT
sex                   TEXT CHECK IN ('남','여')
birthdate             TEXT          -- ISO YYYY-MM-DD
korean_subject        TEXT
math_subject          TEXT
sci1_subject          TEXT
sci2_subject          TEXT
```

Notes:

* ID pattern is **prefixed hex**: `author_<16-char hex>`. Not UUID. All entities follow the same `prefix_hex` convention — preserve it.
* Author-level evaluation lives in the separate `evaluations` table, **not** as columns here. `ai_evaluation_grade` / `manual_rating` are summary labels only.
* **Scholarship (용역비) lives on `authors.scholarship_amount`** (INTEGER 원, NOT NULL DEFAULT 0) as of migration 0006 — moved here by product decision because 장학금 is a student-level attribute, not a per-review one. (Earlier convention kept it on `evaluations`; that column is being retired.)
* `student_type` distinguishes the admission track and **also tells you which source sheet the row came from** (one Google Form per track). New track values must be added to the CHECK first (see migration 0004 pattern).

---

### 2. Submissions

Represents raw submitted material. **Deployed schema (after migration 0003):**

```txt
id                  TEXT PK, default 'submission_' || hex(randomblob(8))
author_id           TEXT NOT NULL  FK → authors(id) ON DELETE CASCADE
source_type         TEXT DEFAULT 'form'              -- ETL sets 'google_form'
raw_text            TEXT                              -- unused so far (Q/A goes into qna)
original_file_name  TEXT
status              TEXT NOT NULL DEFAULT 'received'
                    CHECK IN ('received','reviewing','selected','rejected','archived')
file_url            TEXT          -- Google Drive link to the uploaded 답안지
submitted_at, created_at, updated_at TEXT
```

Notes:

* `author_id` cascades on delete — removing an author wipes their submissions.
* `raw_text` is currently empty; structured Q/A is in `qna`.
* `file_url` is the 답안지 Drive URL. Some sheets also have a separate timetable upload column — the ETL ignores that one. If you need it later, add another column or a separate `attachments` table.

---

### 3. Questions + QnA (normalized as of migration 0002)

Question metadata lives in its own `questions` table; `qna` only holds the answer + FK refs. Cohorts have **different question sets**, so `questions.cohort` is NOT NULL.

**`questions` schema:**

```txt
id              TEXT PK, default 'question_' || hex(randomblob(8))
cohort          INTEGER NOT NULL CHECK (cohort >= 5)
question_key    TEXT            -- optional, for matching "same question" across cohorts
question_text   TEXT NOT NULL
category        TEXT
sort_order      INTEGER NOT NULL DEFAULT 0
is_active       INTEGER NOT NULL DEFAULT 1 CHECK IN (0,1)
created_at, updated_at TEXT
```

Indexes: `(cohort, sort_order)`, `(question_key)`.

**`qna` schema (rebuilt by 0002):**

```txt
id            TEXT PK, default 'qna_' || hex(randomblob(8))
author_id     TEXT NOT NULL  FK → authors(id)     ON DELETE CASCADE
submission_id TEXT           FK → submissions(id) ON DELETE SET NULL
question_id   TEXT NOT NULL  FK → questions(id)   ON DELETE RESTRICT
answer_text   TEXT
created_at, updated_at TEXT
```

Indexes on each FK.

Notes:

* **Insertion order**: insert a cohort's `questions` rows first, then `qna` rows reference them. ETL must seed `questions` before loading answers.
* `ON DELETE RESTRICT` on `question_id` — you cannot delete a question that has answers. Use `is_active = 0` to retire a question instead.
* "Same question across cohorts" view = `GROUP BY question_key` joined back to `qna`.
* Don't put `question_text` or `category` on `qna` — edit those on `questions` only.

---

### 4. Articles

Represents edited or publishable manuscripts. **Deployed schema:**

```txt
id               TEXT PK, default 'article_' || hex(randomblob(8))
author_id        TEXT NOT NULL  FK → authors(id) ON DELETE CASCADE
submission_id    TEXT           FK → submissions(id) ON DELETE SET NULL
title            TEXT
draft_content    TEXT
edited_content   TEXT
final_content    TEXT
article_status   TEXT NOT NULL DEFAULT 'draft'
                 CHECK IN ('draft','editing','review','final','published','archived')
editor_name      TEXT
editor_note      TEXT
created_at, updated_at, published_at TEXT
```

Notes:

* **Three content fields** (`draft_content` / `edited_content` / `final_content`) preserve editorial history — do not collapse into a single `body`.
* Status enum is `final`, not `complete`, and field name is `article_status` (not `status`) — the `submissions.status` shares no enum.
* Single `editor_note` (singular), single `editor_name`.

---

### 5. Evaluations (separate table)

Evaluation is its **own table**, not columns on `authors`. **Deployed schema:**

```txt
id                  TEXT PK, default 'evaluation_' || hex(randomblob(8))
author_id           TEXT NOT NULL  FK → authors(id) ON DELETE CASCADE
submission_id       TEXT           FK → submissions(id) ON DELETE SET NULL
evaluator_type      TEXT NOT NULL DEFAULT 'ai' CHECK IN ('ai','manual')

total_score         INTEGER CHECK 0–100
specificity_score   INTEGER CHECK 0–10
authenticity_score  INTEGER CHECK 0–10
narrative_score     INTEGER CHECK 0–10
usefulness_score    INTEGER CHECK 0–10

ai_suspicion_level  TEXT CHECK IN ('low','medium','high')
ai_suspicion_reason TEXT
evaluation_summary  TEXT
evidence            TEXT

scholarship_amount  INTEGER DEFAULT 0
created_at          TEXT
```

**Critical mismatch with `evaluate.py`** — the Python script emits Korean keys on a 0–5 scale; the DB column names are English on a 0–10 scale plus a 0–100 total. ETL has to map both name *and* scale:

| `evaluate.py` JSON (0–5) | DB column (0–10) |
| --- | --- |
| `정성_구체성` | `specificity_score` |
| `독창성` | `authenticity_score` *(or `narrative_score` — confirm with product before loading)* |
| `가독성` | `narrative_score` |
| `실용성_타겟적합성` | `usefulness_score` |
| `AI_사용도` (0–5) | `ai_suspicion_level` (`low`/`medium`/`high`) |
| `한줄평` | `evaluation_summary` |
| `최종_점수` (0–5) | derive `total_score` (likely `*20` to hit 0–100) |

The 독창성 ↔ authenticity vs narrative mapping is ambiguous — **ask before running a bulk load.** Don't silently pick.

Scholarship (용역비) moved to **`authors.scholarship_amount`** (migration 0006); `evaluations.scholarship_amount` is deprecated/being dropped. Read/write 장학금 on `authors`. (Historical: it used to live here; the 2026-06-06 dedup of 8·9기 dual-review rows + the move to authors fixed double-counting in SUM.) Amount is per-student 실지급액 (원); keep editable, not hardcoded.

---

### 6. Activity Logs

Audit trail. Schema:

```txt
id           TEXT PK, default 'log_' || hex(randomblob(8))
entity_type  TEXT NOT NULL   -- e.g. 'author','submission','evaluation'
entity_id    TEXT NOT NULL
action       TEXT NOT NULL   -- e.g. 'create','update','evaluate'
description  TEXT
actor        TEXT DEFAULT 'system'
created_at   TEXT
```

Append-only. Write on mutating actions in the admin UI/API.

---

## Core Screens

### 1. Dashboard

Purpose: overview of current database and project status.

Should include:

* Total authors
* Total submissions
* Total QnA answers
* Articles by status
* Current round / cohort progress
* Recently edited authors or submissions
* Alerts for missing data or suspicious submissions

---

### 2. Authors DB

Notion-like table view for authors.

Important features:

* Search authors by name
* Filter by cohort, hall, class, student type, rating, university
* Open author detail page
* Show aggregate evaluation status
* Show scholarship status if applicable

Author detail should show:

* Basic profile
* All submissions
* All QnA answers
* AI / editorial evaluation
* Notes
* Final rating
* Scholarship result
* Related article draft

---

### 3. Submissions DB

Raw submissions management.

Important features:

* Submission list
* Author link
* Submission date
* Completion status
* Raw content preview
* Missing field indicators
* Link to related QnA and article

---

### 4. QnA DB

Question-answer database.

Important views:

* By author
* By question
* By category
* By evaluation quality

Important features:

* Long text reading layout
* Highlight generic / suspicious answers
* Mark useful excerpts
* Add editorial notes

---

### 5. Articles DB

Editorial manuscript management.

Important features:

* Article status tracking
* Editor notes
* Draft body
* Link to original author and QnA
* Progress filters
* Export or copy final article text

---

## Design Direction

Use `/docs/sdij_design.md` as the source of truth.

Current design decisions:

* Font: **Pretendard**
* Tone: practical internal admin SaaS
* Inspired by Notion-style data views, but should feel more customized and polished
* Avoid consumer-app decoration
* Use dense but readable tables
* Prioritize clarity, filtering, and editing speed

Visual principles:

```txt
Clean
Structured
Fast to scan
Editorially useful
Database-first
Minimal but not empty
```

Avoid:

```txt
Overly playful UI
Unnecessary gradients
Generic startup landing-page style
Excessive animations
Hardcoded dummy branding
```

---

## Implementation Priorities

### Phase 1: Foundation

1. Confirm framework and package setup.
2. Create route structure.
3. Add global styles and Pretendard font.
4. Create reusable layout shell.
5. Create sidebar navigation.
6. Create basic table component.
7. Connect or mock database schema.

---

### Phase 2: Database Views

Build the following pages:

```txt
/dashboard
/authors
/authors/[id]
/submissions
/qna
/articles
```

Each database page should initially support:

* Table view
* Search
* Basic filters
* Row detail navigation
* Empty state
* Loading state
* Error state

---

### Phase 3: Evaluation Workflow

Add author-level evaluation tools:

* Rating field
* Evaluation notes
* AI-suspicion flag
* Scholarship amount / rank
* Evidence summary
* Final decision field

Evaluation UI should make it easy to compare multiple students.

---

### Phase 4: Editorial Workflow

Add article drafting and editing flow:

* Create article from author/submission
* Pull useful QnA excerpts
* Track article status
* Save editor notes
* Mark final manuscript complete

---

## D1 & Wrangler (live connection)

The database is **already provisioned** on Cloudflare D1 and bound in `wrangler.toml` at the repo root.

```toml
name = "sdij-journal"
compatibility_date = "2026-05-29"

[[d1_databases]]
binding = "DB"            # access as env.DB from Workers/Pages
database_name = "sdij-journal"
database_id = "3e276372-dc16-4e3a-97c8-bf352115d87e"
```

Account: `gracesongha@gmail.com` (account ID `c73ae656f8a2faccc7ad1b11e5d36ea3`).

Wrangler is installed **locally** as a devDependency (`npx wrangler ...`), not globally.

Common commands:

```bash
npx wrangler d1 execute DB --remote --command "SELECT ..."   # query prod
npx wrangler d1 execute DB --local  --command "..."          # query local replica
npx wrangler d1 execute DB --remote --file ./migrations/0002_x.sql
npx wrangler d1 migrations apply DB --remote                  # if migrations/ folder is set up
```

Always pass `--remote` when you mean the live DB. Default is local — easy to footgun.

Migrations live in `migrations/` as numbered `.sql` files:

* `0001_init.sql` — snapshot of the original 6 tables created out-of-band on 2026-05-29 (kept for replayability).
* `0002_questions.sql` — adds `questions` table, rebuilds `qna` with `question_id` FK (destructive — assumes empty `qna`).
* `0003_pii_and_file_url.sql` — adds `authors` PII columns (phone, sex, birthdate, 4 subject choices) + `submissions.file_url`.
* `0004_student_type_check.sql` — relaxes `student_type` CHECK to include `'우선선발'`. SQLite can't ALTER CHECK in place, so the migration rebuilds `authors` (disable FK enforcement, create new table, copy, drop, rename, re-enable FK). Use this pattern for any future enum/check change. Also backfills the existing 33 cohort-9 rows to `'우선선발'`.

For future changes, add `000N_<name>.sql` and apply with `npx wrangler d1 execute DB --remote --file ./migrations/000N_<name>.sql`. The `wrangler d1 migrations` framework (with its own tracking table) is not set up yet — if you need automated apply-pending, configure `migrations_dir` in `wrangler.toml` first.

**Constraints D1 imposes that ordinary SQLite doesn't:**

* No `BEGIN TRANSACTION` / `COMMIT` in user SQL — each statement autocommits. Wrap migrations defensively (idempotent `IF EXISTS` checks, separate idempotent UPDATE backfills).
* `PRAGMA foreign_keys` does work but each `wrangler d1 execute` call resets session state; keep the PRAGMA toggling in the same `--file` batch as the dependent statements.

## ETL from Google Sheets (`etl_sheet_to_d1.py`)

The cohort-9 data lives in Google Forms exports — one form (and one sheet) per `student_type`. The ETL script generates a `.sql` file you then apply with wrangler; it never writes to D1 directly. That makes runs reviewable and re-runnable.

```bash
# 우선선발 sheet (gid=0 has the canonical tab; default tab is a different one)
python3 etl_sheet_to_d1.py \
  --sheet-id 18x1IccHWOxymBPoK4ISqGlqJq13Yh69HUim6RwsDPhc --gid 0 \
  --student-type 우선선발 --out out/load_priority.sql

# 성적우수 sheet
python3 etl_sheet_to_d1.py \
  --sheet-id 17F06ElPfpLCPfprt3HcQPTv4fvpI1ttVBb1vUqNR1wc \
  --student-type 성적우수 --out out/load_sjus.sql

npx wrangler d1 execute DB --remote --file out/load_<name>.sql
```

How it handles cross-sheet drift (the two forms differ in column count, order, and header row):

* **Header row** auto-detected by looking for the literal `이름` cell in row 0 or row 1.
* **Column lookup** is by header substring (`find_col`), not by index.
* **`file_url` detection** is layered: header containing `'답안지'` → empty header with mostly Drive URLs → last column of mostly Drive URLs. Forms with two upload columns (timetable + 답안지) keep 답안지 by preferring the later/empty-header one.
* **Question dedup across sheets** is by full `question_text` (queried from D1 before generating SQL). Two columns sharing a `question_key` like `[3-1]` (전체 / 종류별 / 이유) stay distinct because their text differs.

**Sheet sources and their `(cohort, student_type)` mapping:**

| Sheet ID | tab | cohort | student_type | n | form variant | ETL script |
| --- | --- | --- | --- | --- | --- | --- |
| `1bnNHm_lI7cZlFZ6fhE5NUBHiWhwwDG6TYY7mx70-1p0` | default | 5 | 포레스트 | 22 | 5기 file-only form (no questions, no evaluations) | `etl_5gi.py` |
| `1mswtrOw_Se2ZX4a7s0j3HV24AwySXhIF5VOtpAil-3g` | default | 5 | 성적향상 | 21 | 5기 mixed-track sheet — filtered by self-class | `etl_5gi.py --require-self-class '성적향상자'` |
| `1mswtrOw_Se2ZX4a7s0j3HV24AwySXhIF5VOtpAil-3g` | default | 5 | 성적우수 | 56 | same sheet, complement filter | `etl_5gi.py --exclude-self-class '성적향상자'` |
| `1oSpcV-TSNXWySBjBflXKP0tnxbapP-9wJU2j1eFLz4c` | default | 7 | 성적우수 | 102 | 7기 single-reviewer form (20 Q) | `etl_sheet_to_d1.py` |
| `1otAR9jLZDUMW9FiSimuAPd9eewRQxZ7voDZsWgdXQic` | default | 8 | 성적향상 | 24 | 8기 short form (17 Q) | `etl_sheet_to_d1.py` |
| `1vElhfl-Bc0XBH4Z3XtJINe4_2qdwCzEJ4GQ2poCfLjg` | default | 8 | 성적우수 | 45 | 8기 long form (44 Q) | `etl_sheet_to_d1.py` |
| `1413Y5B6GiyE_hVNa8vDcse4uNP1a3NSYNjfmgMY9BJA` | default | 8 | 우선선발 | 75 | 8기 우선선발 long form (42 Q) — added 2026-07-19 (was missed) | `etl_sheet_to_d1.py --cohort 8` |
| `18x1IccHWOxymBPoK4ISqGlqJq13Yh69HUim6RwsDPhc` | `gid=0` | 9 | 우선선발 | 33 | 9기 long form (41 Q) — shared with 9기 성적우수 | `etl_sheet_to_d1.py` |
| `17F06ElPfpLCPfprt3HcQPTv4fvpI1ttVBb1vUqNR1wc` | default | 9 | 성적우수 | 59 | 9기 long form (41 Q) | `etl_sheet_to_d1.py` |
| `1rmEVGPnBkaE3zOD8700kW12SxOAuLmu4xLCIMOuy3vQ` | `재종RAW` | 9 | 성적향상 | 19 | 9기 재종 long form (43 Q), 사람 평가 없음 → AI 평가 | `etl_sugi_ai_eval.py` |
| `1rmEVGPnBkaE3zOD8700kW12SxOAuLmu4xLCIMOuy3vQ` | `기숙RAW` | 9 | 성적향상 | 4 | 9기 기숙 long form (44 Q, 관 없음/[7-6] 추가) | `etl_sugi_ai_eval.py` |

6기는 의도적으로 건너뜀 (loaded order: 5, 7, 8, 9). 9기 성적향상은 재종+기숙 = 23명 (마지막 적재).

**9기 성적향상 — AI 평가 경로 (`etl_sugi_ai_eval.py`)**: 다른 기수/전형은 시트에 사람 평가(`수기평1/2`)가 있어 `etl_sheet_to_d1.py`가 `evaluator_type='manual'`(total만)로 적재한다. 9기 성적향상은 사람 평가가 없어, Claude가 EVALUATION.md 기준으로 평가한 결과(`out/sugi_evals.json`류)를 받아 `evaluator_type='ai'` + 4개 세부점수 + AI 의심도까지 적재한다. 원본 두 탭은 이름 기반 gviz CSV(`gviz/tq?tqx=out:csv&sheet=<name>`, gid 불필요)로 읽으며, 소스 시트는 익명 export가 막혀 있어 **링크공유 '뷰어'** 상태여야 한다. 세부점수 매핑·스케일(sub=5점×2, total=5점×20)은 스크립트 docstring 참고. 평가 감사본은 이 시트의 `for claude` 탭(gid=0)에 있다.

There is no single "form per cohort." 8기 alone ran two different forms — short for 성적향상, long for 성적우수. 7기 used a third form with **only one reviewer column** (`수기평` / `평가자` / `비고` — all singular). 9기 collapsed back to a single shared form. `questions` rows are scoped per `(cohort, form variant)` in practice; even within one cohort, two different forms produce disjoint question rows. Cross-cohort or cross-form comparison must use `question_key` (e.g. `'3-1'`), not `question_text` or `id`.

**Form-variant handling in `etl_sheet_to_d1.py`**:

* **Space-insensitive `find_col`** (added 2026-07-19): internal spaces are squashed on both header and needle before comparing. The 8기 우선선발 form spells reviewer/score headers *with* a space (`수기평 2` / `평가자 1`) where 9기 uses none (`수기평2` / `평가자1`); one needle spelling now matches both. Only structural column lookup is affected — stored `question_text` still uses the raw `norm()` (spaces preserved), so cross-sheet question dedup is unchanged.
* **8기 우선선발 column order is inverted**: scores come *before* reviewer names (`수기평 1` / `수기평 2` / `평가자 1` / `평가자 2`), whereas 8기/9기 put reviewer-name columns immediately before the scores. The positional reviewer fallback (`score_1 - 2`) would land out of range here, but with space-insensitive matching the `평가자1`/`평가자2` needles hit directly, so the fallback never fires. It also carries a single shared `비고` column (not per-reviewer) — mapped to reviewer_1's eval via the bare `비고` needle in the two-reviewer branch, so notes on rows only reviewer 송 scored land as a NULL-score, NULL-evidence note row.
* **Single vs. multi-reviewer**: the script branches on `score_2` presence. If only one score column exists (7기 pattern: `수기평` / `평가자`), it skips reviewer_2 entirely and uses lax needle matching for reviewer_1 (no second-reviewer column to confuse).
* **Reviewer-header overwriting**: when both score columns exist but reviewer headers are missing or relabeled (e.g. 8기 성적우수's col 0 = "거센 파도를 지나며" book title), reviewer columns are inferred as the two slots immediately before score_1.
* **Substring vs. exact match**: column names like `관` and `반` need `exact=True` in `find_col` because 7기 has nearby `관반` and `반수반?` columns that would otherwise greedy-match as substrings. The longer/section-title style needles (e.g. `재원 기수`, `비고_평가자1`) stay on substring matching.
* **Column-name variants collected so far** (extend `find_col(...)` needles, don't branch the script):
  * `수기평1` (9기) / `평가1` (8기) / `수기평` (7기, single).
  * `재원 기수` (9기) / `기수` (8기 성적향상) / `재원 시작 + 재원 기수` (8기 성적우수).
  * `비고_평가자1` (9기) / `비고1` (8기) / `비고` (7기, single).
  * `탐구 1선택` (9기) / bare `탐구1` (8기 성적향상) / `탐구1 선택` (8기 성적우수). All match the `탐구1` substring.

**Misleading column names worth flagging:**

* `sci1_subject` / `sci2_subject` actually hold *전체 탐구과목* — 8기 성적우수 and 7기 include 사탐 students whose values are `경제`, `사문`, etc. Stored as free TEXT, so loads fine; just don't infer "science-only" from the column name.

**`final_university` policy** — graduated cohorts treat the sheet as authoritative, current cohorts treat the admin as authoritative:

* 5기 / 7기 sheets carry a `최종 진학 대학` / `최종대학` column. Both INSERT and UPDATE write the sheet value into `authors.final_university`, but the UPDATE clause uses `COALESCE(NULLIF(<sheet>, ''), final_university)` so an empty sheet cell never clobbers a value an admin already entered.
* 8기 성적향상/성적우수 and 9기 sheets do not have a 최종대학 column at all. The cell lookup returns empty, the COALESCE preserves whatever's in D1, and admins keep control.
* **Exception: 8기 우선선발** carries a `최종대학` column, so its INSERT seeds `authors.final_university` from the sheet, like 5기/7기. But 54/75 cells were the Sheets formula-error literal `#N/A` (only 19 real values: 서울대 의예 ×16, (지균) ×3); `cell()` now filters `SHEET_ERROR_VALUES` to empty so they never persist (the already-loaded #N/A were UPDATEd to NULL afterward). UPDATE still uses `COALESCE(NULLIF(...))`, so an empty cell never clobbers an admin edit.
* Other genuinely admin-only columns (`memo`, `manual_rating`, `ai_evaluation_grade`, `admission_score`) are still left untouched on UPDATE — those have no sheet counterpart.

### 5기 form is its own thing (`etl_5gi.py`)

The 5기 form predates the long question-by-question survey and only carries a 답안지 Drive URL per student. There are no per-question text answers and no reviewer scores. To avoid forcing all the optional-everything branching into the main script, 5기 has its own short ETL:

* Schema touched: `authors` + `submissions` only. `questions`/`qna`/`evaluations` stay empty for cohort 5.
* `소속` column (포레스트 sheet — 편집부 / 기획부) and the self-classification tag (col 4 — e.g. `정시 면접 참여 (C3 답변자)`, `성적향상자 (질문지에 적힌 기준에 따라)`) are concatenated into `authors.memo` as `소속: X / 자가분류: Y`.
* `최종 진학 대학` → `authors.final_university` on INSERT only (same admin-editable policy as 7기).
* **Idempotency key is `submissions.file_url`**, not `(name, phone)`. 5기 sheets have homonyms (8 pairs in 1mswtrOw_…) and no phone column, so name-based matching is ambiguous. Drive URL is unique per upload and stable across re-runs.
* `--student-type` is required per sheet; one sheet ≡ one track. Future 5기 sheets for `성적우수` / `성적향상` go through the same script with the matching flag.

**Splitting a mixed-track sheet** (e.g. the original 5기 sheet `1mswtrOw_…` carries both 성적우수 and 성적향상 students in one tab): use `--require-self-class <substr>` and `--exclude-self-class <substr>` to filter rows on col-4 self-classification. The two complementary runs partition the sheet without overlap, and `file_url` idempotency keeps reruns safe. Rows with an empty col-4 fall on the `--exclude` side (no substring match), which lands them in 성적우수 by current convention.

**Name normalization** (applied by both ETLs on read). Trailing 반/조 latin letters (`김동건B` → `김동건`) and trailing parenthetical comments (`김현일(자료를 잘못 보내…)` → `김현일`) are stripped before matching and writing. The same `normalize_name` rule lives in `etl_sheet_to_d1.py` and `etl_5gi.py`; if you change it in one, change both. `scripts/normalize_names.py` was the one-off backfill that cleaned 24 pre-existing rows in D1.

**Idempotent on re-run.** Repeating an ETL load for the same `(cohort, student_type)` is safe:

* **`authors`**: UPSERTed by `(name, phone)` first, falling back to name when only one DB row has that name. Form-sourced fields (`name, cohort, student_type, hall, class_name, phone, sex, birthdate, *_subject`) are overwritten with the current sheet values; admin-edited fields (`memo, manual_rating, ai_evaluation_grade, admission_score, final_university`) are left untouched.
* **`submissions` / `qna` / `evaluations`**: for every matched existing author, the script emits `DELETE … WHERE author_id IN (…)` before re-inserting from the sheet, so these tables never accumulate stale copies.
* **`questions`**: matched by full `question_text`; only genuinely-new texts get a new row.
* **Authors absent from the sheet are untouched.** The script does not prune authors whose names disappeared from a re-export — admins clean those manually if needed.
* **Homonym detection**: if the same name appears multiple times in D1 and the sheet phone doesn't disambiguate, the row is inserted as a new author and a warning is printed to stderr. Don't silently ignore the warning.

**Intentionally skipped from the sheets:**

* `항해일지①` classification columns (mostly empty) — these are publication-binning metadata and would belong on `articles`, not the raw form ingest.
* Timetable file upload column when present (separate from 답안지).
* `재제출` flag column — the form admins clean stale rows out before export, so the export is treated as authoritative.

## SQL dialect reminders (D1 = SQLite)

* No `UUID` type, no `gen_random_uuid()`, no `TIMESTAMP WITH TIME ZONE`, no Postgres `ENUM`.
* IDs are `TEXT PRIMARY KEY DEFAULT ('<prefix>_' || lower(hex(randomblob(8))))` — keep this pattern for any new table.
* Timestamps are `TEXT` in ISO format with `DEFAULT CURRENT_TIMESTAMP`.
* Use `CHECK (col IN (...))` for enums.
* Do not blindly paste Supabase/PostgreSQL SQL into D1.

---

## Coding Guidelines

General:

* Keep code simple and maintainable.
* Prefer clear component names.
* Avoid over-abstraction too early.
* Build reusable admin UI components only after patterns repeat.
* Keep business terms in Korean where they are user-facing.
* Keep code identifiers in English unless Korean naming is clearly better.

Recommended component examples:

```txt
AppShell
SidebarNav
PageHeader
DataTable
FilterBar
SearchInput
StatusBadge
AuthorProfileCard
EvaluationPanel
QnaAnswerCard
ArticleStatusSelect
```

---

## UI Language

The actual admin UI should primarily use Korean labels.

Examples:

```txt
대시보드
작성자 DB
제출물 DB
질의응답 DB
원고 DB
평가
장학금
상태
최근 수정
최종 대학
AI 의심
편집 메모
```

Internal documentation and code comments may use English where useful.

---

## Data Quality / Evaluation Rules

Evaluation should be strict.

Flag submissions that are:

* Too generic
* Repetitive
* Lacking concrete study details
* Written in overly polished AI-like language
* Inconsistent with other answers
* Missing verifiable personal context
* Full of broad motivational clichés

Strong submissions usually include:

* Specific timeline
* Specific teachers, classes, or study methods
* Concrete failure and recovery moments
* Exam-day or real classroom details
* Useful advice future students can actually apply
* Consistent personal voice

---

## Known Context From Previous Work

Previous work included:

* Designing a Notion-inspired admin dashboard
* Changing the product tone to practical admin SaaS
* Replacing generic font usage with Pretendard
* Replacing generic logo references with 시대인재 / 시대인재J logo assets
* Drafting database tables for authors, submissions, QnA, and articles
* Considering cleaner DB IDs
* Adding scholarship result columns after evaluating top student stories
* Moving or preparing DB setup toward Cloudflare

When uncertain, preserve these decisions unless the user explicitly asks to change them.

---

## Claude Code Working Instructions

Before coding:

1. Read this file.
2. Read `/docs/sdij_design.md`.
3. Read `/docs/product_requirements.md`.
4. Read `/docs/database_schema.md`.
5. Inspect the existing source tree.
6. Identify the current framework and package manager.
7. Do not assume the project uses Supabase — it does not.
8. The project **uses Cloudflare D1** (`sdij-journal`), bound as `DB` in `wrangler.toml`. Treat the deployed schema as source of truth.

When editing:

* Make small, coherent commits/changes.
* Do not rewrite unrelated files.
* Do not delete design or requirements docs.
* Preserve existing Korean business terminology.
* Keep UI consistent with `sdij_design.md`.
* If schema and implementation conflict, pause and summarize the conflict before changing the schema.

When generating code:

* Prefer production-ready structure over throwaway prototypes.
* Avoid fake data unless needed for UI scaffolding.
* Put mock data in a clearly named file, such as `mockData.ts`.
* Keep DB access isolated from UI components.
* Add types for core entities.

Suggested type names:

```ts
Author
Submission
QnaItem
Article
Evaluation
ScholarshipResult
```

---

## Immediate Next Tasks

Recommended next steps:

1. Bootstrap Next.js on Cloudflare Pages (chosen stack); wire `@cloudflare/next-on-pages`.
2. Create or verify the `/docs` files.
3. Add a `migrations/` folder and capture the current deployed schema as `0001_init.sql` for replayability.
4. Build base admin shell.
5. Implement Dashboard page.
6. Implement Authors table and Author detail page.
7. Add QnA and Article database views.
8. Build evaluation view wired to the `evaluations` table (do not duplicate scores onto `authors`).
9. ETL: load `_evaluated.xlsx` → `authors` / `submissions` / `qna` / `evaluations`, resolving the Korean→English + 0–5→0–10 mapping per the table above.

---

## Important Warnings

Do not do the following:

* Do not hardcode scholarship winners into UI only.
* Do not use PostgreSQL-only SQL in Cloudflare D1.
* Do not overwrite the design direction with a generic template.
* Do not remove Pretendard.
* Do not replace the 시대인재J brand with placeholder branding.
* Do not flatten author/submission/QnA/article into one giant table unless explicitly requested.
* Do not make evaluation lenient; the screening standard should be strict.

---

## Product Summary In One Sentence

Build a clean, strict, Notion-like but custom admin dashboard for 시대인재J to manage student submissions, QnA, author evaluation, scholarship decisions, and article editing.
