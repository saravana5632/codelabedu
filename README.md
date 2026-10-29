# CodeLabEdu

> A web-based coding assessment platform for conducting programming tests, managing coding questions, evaluating student submissions, and analyzing test performance.

## Overview

**CodeLabEdu** is an online coding assessment system designed for educational institutions. It provides separate interfaces for **students** and **faculty**, allowing faculty members to create coding tests and students to solve programming problems through an online coding environment.

The platform supports automated code evaluation using test cases and provides faculty with submission results and analytics.

---

## Features

### Student Module

* Student authentication using roll number and date of birth
* View available coding tests
* View coding questions
* Online code editor
* Run code during assessments
* Submit solutions
* Automated test-case evaluation
* View submission status
* Track completed tests
* Copy-paste restrictions during tests

### Faculty Module

* Faculty authentication
* Faculty dashboard
* Create coding tests
* Add coding questions
* Update test details
* Publish and manage tests
* Archive tests
* Duplicate existing tests
* Delete tests
* View student submissions
* View test results
* Manage student information
* View test analytics

### Coding Assessment

The platform currently supports algorithm-based programming questions such as:

* Binary Search
* Merge Sort
* Quick Sort

Each coding problem can be evaluated against multiple test cases to determine whether the submitted solution is correct.

---

## Technology Stack

| Category        | Technologies                    |
| --------------- | ------------------------------- |
| Frontend        | React, TypeScript, Vite         |
| Backend         | Node.js, Express.js, TypeScript |
| Database        | Turso, SQLite, LibSQL           |
| ORM             | Drizzle ORM                     |
| Authentication  | JWT                             |
| Version Control | Git, GitHub                     |
| Package Manager | npm                             |

---

## System Architecture

```text
                    CodeLabEdu
                        |
          +-------------+-------------+
          |                           |
       Student                      Faculty
          |                           |
          +-------------+-------------+
                        |
                 React Frontend
                        |
                    REST APIs
                        |
              Node.js + Express
                        |
        +---------------+---------------+
        |               |               |
 Authentication   Test Management   Evaluation
        |               |               |
        +---------------+---------------+
                        |
                   Drizzle ORM
                        |
                 Turso / SQLite
```

---

## Main Modules

### 1. Authentication

Provides secure login and role-based access for:

* Students
* Faculty

JWT tokens are used to authenticate protected API requests.

### 2. Test Management

Faculty members can:

* Create tests
* Update tests
* Publish tests
* Archive tests
* Duplicate tests
* Delete tests

### 3. Question Management

Faculty can add programming questions containing:

* Question title
* Description
* Constraints
* Input format
* Output format
* Sample input
* Sample output
* Difficulty level
* Starter code
* Driver code

### 4. Code Evaluation

Student submissions are evaluated against test cases.

Example:

```text
Question: Binary Search

Test Case 1    ✓ Passed
Test Case 2    ✓ Passed
Test Case 3    ✗ Failed
Test Case 4    ✓ Passed
Test Case 5    ✓ Passed

Result: 4 / 5 Test Cases Passed
```

### 5. Analytics

Faculty can view:

* Total students
* Test participation
* Submission count
* Pass/fail statistics
* Average score
* Highest score
* Lowest score
* Average execution time

---

## Database Schema

The project uses the following major tables:

```text
students
    |
    +---- test_completions
    |
    +---- submissions
              |
              +---- submission_statistics


faculty
    |
    +---- tests
              |
              +---- questions
              |       |
              |       +---- test_cases
              |
              +---- test_analytics
```

### Main Tables

| Table                   | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `students`              | Stores student information               |
| `faculty`               | Stores faculty information               |
| `tests`                 | Stores coding test information           |
| `questions`             | Stores coding questions                  |
| `test_cases`            | Stores test inputs and expected outputs  |
| `submissions`           | Stores student code submissions          |
| `submission_statistics` | Stores execution and scoring information |
| `test_completions`      | Tracks completed tests                   |
| `test_analytics`        | Stores test performance statistics       |
| `assessment_timer_configs` | Stores authoritative per-assessment timer settings (`timer_enabled`, `duration_minutes`, `grace_period_seconds`, `auto_submit_on_expiry`, `updated_at`, `updated_by`) |
| `assessment_sessions`   | Tracks individual student assessment sessions, server-calculated deadlines (`started_at`, `deadline_at`, `submitted_at`, `status`), selected questions, and auto-saved code drafts |

---

## Dynamic Assessment Timer Architecture

1. **Faculty/Admin Control (`/faculty/timer` & Dashboard):**
   - Configure assessment duration in hours and minutes, quick presets (`15`, `30`, `45`, `60`, `90`, `120` minutes), or custom total minutes.
   - Toggle timer enforcement on/off (`timer_enabled`).
   - Choose session scope policy:
     - **Future Sessions Only (Default):** Existing active students keep their recorded server deadline; new students receive the updated duration.
     - **Apply to Active & Future Sessions:** Recalculates `deadline_at` on the server for active sessions based on their recorded `started_at` (with explicit confirmation).
2. **Server-Side Timing Authority & Scale (3,500+ Concurrent Students):**
   - When a student starts an assessment (`POST /api/assessments/:id/start`), the server calculates `deadline_at = started_at + duration_minutes` using the server clock and persists it in `assessment_sessions`.
   - Page refreshes, question switching (`Q1` ↔ `Q2`), or reconnections return the original `deadline_at` without resetting the clock.
   - The frontend computes the visual countdown (`Time Remaining: HH:MM:SS` / `MM:SS`) against the server-synchronized deadline (`serverOffsetMs`) to prevent drift, showing warnings at **5 minutes** and **1 minute** remaining.
   - Code drafts are automatically persisted to `assessment_sessions.drafts`. A single lightweight periodic sweep (`processExpiredSessions`) and on-demand checks finalize expired sessions and evaluate saved drafts idempotently without holding thousands of in-memory timers.

---

## API Endpoints

### Authentication

```text
POST /api/login
GET  /api/me
```

### Dynamic Assessment Timer & Session APIs

```text
GET  /api/admin/assessments/timers
GET  /api/admin/assessments/:id/timer
PUT  /api/admin/assessments/:id/timer
POST /api/assessments/:id/start
GET  /api/assessment-sessions/:sessionId/timer
PUT  /api/assessment-sessions/:sessionId/draft
POST /api/assessment-sessions/:sessionId/submit
```

### Student APIs

```text
GET  /api/student/tests
GET  /api/student/tests/:id
GET  /api/student/questions/:id
POST /api/student/run
POST /api/student/submit
GET  /api/student/submissions
```

### Faculty APIs

```text
GET    /api/faculty/students
GET    /api/faculty/tests
POST   /api/faculty/tests
PUT    /api/faculty/tests/:id
DELETE /api/faculty/tests/:id
GET    /api/faculty/tests/:id/check-submissions
POST   /api/faculty/tests/:id/duplicate
POST   /api/faculty/questions
GET    /api/faculty/results/:testId
```

### Analytics APIs

```text
GET /api/analytics/dashboard
GET /api/analytics/test/:testId
```

---

## Project Structure

```text
Codelabedu/
│
├── src/
│   │
│   ├── controllers/
│   │   ├── auth.ts
│   │   ├── student.ts
│   │   ├── faculty.ts
│   │   └── analytics.ts
│   │
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts
│   │
│   ├── middleware/
│   │   └── authMiddleware.ts
│   │
│   ├── pages/
│   │   ├── faculty/
│   │   │   ├── DashboardHome.tsx
│   │   │   ├── FacultyLayout.tsx
│   │   │   ├── StudentManagement.tsx
│   │   │   ├── TestAnalytics.tsx
│   │   │   └── TestManagement.tsx
│   │   │
│   │   ├── CodingPage.tsx
│   │   └── TestSelectionPage.tsx
│   │
│   ├── App.tsx
│   └── routes.ts
│
├── data/
│
├── dist/
│
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Git
* VS Code Studio

### Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Codelabedu
```

### Install Dependencies

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=your_turso_database_url
DATABASE_AUTH_TOKEN=your_turso_auth_token
JWT_SECRET=your_jwt_secret
```

### Run Development Server

```bash
npm run dev
```

### Build the Project

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

---

## Database Setup

The application uses **Turso** for the production database.

Drizzle ORM is used to manage the database schema.

```bash
npx drizzle-kit push
```

---

## Coding Questions

The current assessment includes:

| No. | Question      | Algorithm     |
| --: | ------------- | ------------- |
|   1 | Binary Search | Binary Search |
|   2 | Merge Sort    | Merge Sort    |
|   3 | Quick Sort    | Quick Sort    |

Each question can contain multiple test cases for automated evaluation.

---

## Test Evaluation Flow

```text
Student selects test
        ↓
Student opens question
        ↓
Student writes code
        ↓
Student runs code
        ↓
Code is executed
        ↓
Output is compared with test cases
        ↓
Student submits solution
        ↓
All test cases are evaluated
        ↓
Score is calculated
        ↓
Submission result is stored
        ↓
Faculty can view results
```

---

## Security

CodeLabEdu implements:

* JWT authentication
* Role-based authorization
* Protected API routes
* Separate student and faculty access
* Server-side submission processing
* Test-case based evaluation
* Copy-paste restrictions during assessments

---

## Deployment

The application has been successfully deployed and is running in the production environment.

The production setup uses:

```text
Frontend
React + Vite

Backend
Node.js + Express

Database
Turso

ORM
Drizzle ORM
```

---

## Future Enhancements

* Support for additional programming languages
* Advanced code execution sandbox
* Real-time exam monitoring
* Leaderboard
* Plagiarism detection
* Question bank
* Automated question generation
* Advanced performance analytics
* Email notifications
* More detailed student performance reports

---


## CodeLabEdu

**Online Coding Assessment & Test Management Platform**

Built with **React, TypeScript, Node.js, Express, Drizzle ORM, SQLite, and Turso**.
