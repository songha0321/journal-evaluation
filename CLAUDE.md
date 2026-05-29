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

Represents each student / writer.

Likely fields:

```txt
id
name
cohort
student_type
hall
class_name
admission_score
final_university
ai_evaluation_grade
created_at
```

Notes:

* `id` should be clean, stable, and DB-friendly.
* Prefer UUID or well-structured generated IDs.
* Avoid messy manually typed IDs.
* Author-level evaluation is important because one author may have multiple QnA answers and submissions.

---

### 2. Submissions

Represents raw submitted material.

Likely fields:

```txt
id
author_id
created_at
```

Notes:

* A submission belongs to one author.
* Deleting an author should probably cascade to submissions, unless product requirements say otherwise.

---

### 3. QnA

Represents question-answer data from students.

Likely fields:

```txt
id
submission_id
author_id
question
answer
question_order
category
created_at
updated_at
```

Notes:

* QnA answers are central to evaluation.
* The UI should support viewing QnA by author, by question, and by submission.

---

### 4. Articles

Represents edited or publishable manuscripts.

Likely fields:

```txt
id
author_id
submission_id
title
body
status
editor_notes
created_at
updated_at
```

Possible statuses:

```txt
draft
editing
review
complete
published
archived
```

---

### 5. Evaluation / Scholarship

Evaluation should support strict screening.

Important criteria:

* Specificity of story
* Consistency across answers
* Concrete study methods
* Evidence of real experience
* Emotional authenticity
* Usefulness to future students
* Suspicion of AI-generated or generic writing

Scholarship-related data may be added as a column, for example:

```txt
scholarship_rank
scholarship_amount
scholarship_label
evaluation_reason
```

Scholarship logic used previously:

```txt
1명: 50만원
5명: 20만원
14명: 10만원
```

When implementing this, make the ranking and amount explicit and editable rather than hardcoded only in UI.

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

## Database Notes

Be careful with SQL compatibility.

If using Cloudflare D1:

* D1 is SQLite-based.
* Avoid PostgreSQL-only syntax such as:

  * `UUID` type
  * `gen_random_uuid()`
  * `TIMESTAMP WITH TIME ZONE`
  * PostgreSQL enum syntax
* Prefer:

  * `TEXT PRIMARY KEY`
  * generated UUIDs from application code, or SQLite-compatible ID generation
  * `TEXT` timestamps in ISO format
  * `CHECK` constraints where supported

Example D1-friendly direction:

```sql
CREATE TABLE authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cohort INTEGER CHECK (cohort >= 5),
  student_type TEXT CHECK (student_type IN ('성적우수', '성적향상', '포레스트')),
  hall TEXT,
  class_name TEXT,
  admission_score TEXT,
  final_university TEXT,
  ai_evaluation_grade TEXT,
  scholarship_rank INTEGER,
  scholarship_amount INTEGER,
  evaluation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Do not blindly paste Supabase/PostgreSQL SQL into Cloudflare D1.

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
7. Do not assume the project uses Supabase unless files confirm it.
8. Do not assume the project uses Cloudflare D1 unless config or user instruction confirms it.

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

1. Confirm actual framework and package manager.
2. Create or verify the `/docs` files.
3. Add `CLAUDE.md` to project root.
4. Build base admin shell.
5. Implement Dashboard page.
6. Implement Authors table and Author detail page.
7. Align schema with the selected database target.
8. Add QnA and Article database views.
9. Add evaluation and scholarship fields.
10. Connect real DB after schema is stable.

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
