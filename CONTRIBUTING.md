# Internal Contribution Guidelines — CodeLabEdu

> **CONFIDENTIAL & PROPRIETARY**  
> CodeLabEdu is a closed-source, proprietary coding assessment platform developed strictly for authorized educational and institutional use. Public forks, external pull requests, and unauthorized distributions are strictly prohibited. Access to this repository is restricted to designated developers, faculty administrators, and authorized institutional personnel.

---

## Table of Contents
1. [Technology Stack](#1-technology-stack)
2. [Prerequisites & Local Setup](#2-prerequisites--local-setup)
3. [Git Branching & Workflow Strategy](#3-git-branching--workflow-strategy)
4. [Commit Message Standards](#4-commit-message-standards)
5. [Architectural Rules & Security Guardrails](#5-architectural-rules--security-guardrails)
6. [Database Schema & Migrations](#6-database-schema--migrations)
7. [Internal Pull Request (PR) Checklist](#7-internal-pull-request-pr-checklist)

---

## 1. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Vite |
| **Backend** | Node.js, Express.js, TypeScript |
| **Database** | Turso, SQLite, LibSQL |
| **ORM** | Drizzle ORM |
| **Authentication** | JSON Web Tokens (JWT) |
| **Version Control & Tooling** | Git, GitHub (Private), npm |

---

## 2. Prerequisites & Local Setup

Ensure your development machine has the following installed:
- **Node.js** (v18.x LTS or higher)
- **npm** (v9.x or higher)
- **Git**
- **VS Code** (Recommended IDE)

### Step-by-Step Installation

1. **Clone the private repository:**
   ```bash
   git clone <PRIVATE_GITHUB_REPOSITORY_URL>
   cd Codelabedu
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and populate it with your development credentials (obtain these from the project maintainer):
   ```env
   DATABASE_URL=your_turso_database_url
   DATABASE_AUTH_TOKEN=your_turso_auth_token
   JWT_SECRET=your_jwt_secret
   ```
   > **Warning:** Never commit `.env` files, Turso tokens, or JWT secrets to Git.

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

5. **Verify Production Build:**
   ```bash
   npm run build
   npm start
   ```

---

## 3. Git Branching & Workflow Strategy

Direct pushes to `main` are restricted. All changes must go through an internal Pull Request and code review.

### Branch Naming Conventions
- `feature/<feature-name>` — New student or faculty functionality (e.g., `feature/question-duplication`)
- `fix/<bug-name>` — Bug fixes (e.g., `fix/timer-drift-calculation`)
- `refactor/<scope>` — Code restructuring without changing external behavior
- `docs/<scope>` — Documentation and internal guide updates
- `hotfix/<issue>` — Urgent production fixes

### Development Workflow
1. Pull the latest changes from `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a new branch for your task:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Stage and commit your changes:
   ```bash
   git add .
   git commit -m "feat(module): concise summary of changes"
   ```
4. Push the branch to the private remote repository:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a Pull Request against `main` and request review from a project lead.

---

## 4. Commit Message Standards

Follow the **Conventional Commits** specification for clear project history:

```text
<type>(<scope>): <short description>
```

### Allowed Types & Scopes
- **Types:** `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`
- **Scopes:** `auth`, `student`, `faculty`, `timer`, `eval`, `analytics`, `db`

### Examples
- `feat(timer): support applying updated duration to active sessions`
- `fix(eval): handle edge cases in Merge Sort test case execution`
- `refactor(db): optimize submission_statistics query indexing`

---

## 5. Architectural Rules & Security Guardrails

When working on CodeLabEdu, strictly follow these engineering rules:

### 1. Server-Side Timing Authority (3,500+ Concurrent Students)
- All assessment deadlines (`deadline_at = started_at + duration_minutes`) must be calculated and persisted on the server inside `assessment_sessions`.
- Never allow client-side clock manipulation, page refreshes, or question switching to reset or extend a student's timer.
- Frontend timers must synchronize against `serverOffsetMs` and trigger visual alerts at **5 minutes** and **1 minute** remaining.
- Expired session sweeps (`processExpiredSessions`) must evaluate auto-saved code drafts (`assessment_sessions.drafts`) idempotently without holding in-memory timers.

### 2. Code Evaluation & Anti-Cheat Controls
- Preserve copy-paste restrictions inside `src/pages/CodingPage.tsx` during live assessments.
- Ensure student submissions (`POST /api/student/submit`) and code runs (`POST /api/student/run`) validate against an active, non-expired `assessment_session`.

### 3. Role-Based Access Control (RBAC)
- All routes in `src/routes.ts` must enforce JWT validation via `src/middleware/authMiddleware.ts`.
- Strictly isolate student endpoints (`/api/student/*`) from faculty/admin endpoints (`/api/faculty/*`, `/api/admin/*`, `/api/analytics/*`).

---

## 6. Database Schema & Migrations

Database tables are managed through **Drizzle ORM** in `src/db/schema.ts` and deployed on **Turso (SQLite/LibSQL)**.

### Core Tables Reference
- **Student & Submissions:** `students`, `test_completions`, `submissions`, `submission_statistics`
- **Faculty & Tests:** `faculty`, `tests`, `questions`, `test_cases`, `test_analytics`
- **Timing & Sessions:** `assessment_timer_configs`, `assessment_sessions`

### Updating the Schema
1. Edit table definitions in `src/db/schema.ts`.
2. Push changes to your development database:
   ```bash
   npx drizzle-kit push
   ```
3. Coordinate with the lead maintainer before applying schema updates to the production Turso database.

---

## 7. Internal Pull Request (PR) Checklist

Before marking a Pull Request ready for review, verify the following:

- [ ] `npm run build` succeeds with zero TypeScript or Vite bundling errors.
- [ ] No `.env` credentials, tokens, or sensitive student data are committed.
- [ ] Protected routes use `authMiddleware.ts` with proper role verification.
- [ ] Timer and session modifications respect server-side `deadline_at` authority.
- [ ] Database schema changes (`src/db/schema.ts`) are documented in the PR description.