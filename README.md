CodeLabEdu

A web-based online coding assessment and test management platform designed for students and faculty. Faculty can create and manage coding tests, while students can access questions, write and execute code, submit solutions, and receive evaluation results.

Features
Student
Student login using roll number and date of birth
View available coding tests
View coding questions
Online code editor
Run code against test cases
Submit solutions
Automatic code evaluation
View submission status and results
Test completion tracking
Copy-paste prevention during tests
Faculty
Faculty login
Faculty dashboard
Create and manage coding tests
Add coding questions
Update test details
Publish, archive, duplicate, or delete tests
View student submissions
View test results
Student management
Test analytics
Coding Evaluation

The platform supports algorithm-based programming questions such as:

Binary Search
Merge Sort
Quick Sort

Questions can be evaluated using multiple test cases, including hidden test cases, to verify the correctness of student submissions.

Technology Stack
Frontend
React
TypeScript
Vite
HTML
CSS
Backend
Node.js
Express.js
TypeScript
Database
Turso
SQLite
LibSQL
Drizzle ORM
Authentication
JWT Authentication
Role-based authorization
Development Tools
Git
GitHub
npm
PowerShell
System Architecture
Student / Faculty
       │
       ▼
 React + TypeScript Frontend
       │
       │ REST API
       ▼
 Node.js + Express Backend
       │
       ├── Authentication
       ├── Student Management
       ├── Test Management
       ├── Question Management
       ├── Code Execution
       ├── Submission Evaluation
       └── Analytics
       │
       ▼
 Drizzle ORM
       │
       ▼
 Turso / SQLite Database
Database Structure

The project uses the following major tables:

students
faculty
tests
questions
submissions
test_completions
test_analytics
submission_statistics
test_cases
Relationship
Faculty
   │
   └── Tests
         │
         └── Questions
                │
                └── Test Cases
                       │
                       └── Student Submissions
API Endpoints
Authentication
POST /api/login
GET  /api/me
Student
GET  /api/student/tests
GET  /api/student/tests/:id
GET  /api/student/questions/:id
POST /api/student/run
POST /api/student/submit
GET  /api/student/submissions
Faculty
GET    /api/faculty/students
GET    /api/faculty/tests
POST   /api/faculty/tests
PUT    /api/faculty/tests/:id
DELETE /api/faculty/tests/:id
GET    /api/faculty/tests/:id/check-submissions
POST   /api/faculty/tests/:id/duplicate
POST   /api/faculty/questions
GET    /api/faculty/results/:testId
Analytics
GET /api/analytics/dashboard
GET /api/analytics/test/:testId
Example Coding Test
Binary Search

Students are given a sorted array and a target value.

The solution is evaluated using multiple test cases:

Test Case 1 → PASS
Test Case 2 → PASS
Test Case 3 → PASS
Test Case 4 → FAIL
Test Case 5 → PASS

The system calculates the final score based on the test cases passed.

Local Development
1. Clone the repository
git clone <YOUR_REPOSITORY_URL>
cd Codelabedu
2. Install dependencies
npm install
3. Configure environment variables

Create a .env file:

DATABASE_URL=your_turso_database_url
DATABASE_AUTH_TOKEN=your_turso_auth_token
JWT_SECRET=your_jwt_secret
4. Start the development server
npm run dev

The application will be available at the local development URL shown in the terminal.

Database

The project uses Turso as the production database.

Drizzle ORM is used for database schema management and queries.

Typical database commands:

npx drizzle-kit push

For local development, the project can also use a SQLite database.

Build

Create a production build:

npm run build

Run the production server:

npm start
Security

The platform includes:

JWT-based authentication
Role-based access control
Separate student and faculty permissions
Protected API endpoints
Hidden test-case evaluation
Copy-paste restrictions during assessments
Server-side submission evaluation

Note: Client-side copy/paste prevention should be treated as an assessment-control feature rather than a complete security boundary. Code evaluation and test-case validation should remain server-side.

User Roles
Role	Responsibilities
Student	Attend tests, solve coding problems, run and submit code
Faculty	Create tests, add questions, manage students and evaluate results
Admin/Database	Maintain application and database infrastructure
Current Coding Problems
#	Problem	Difficulty
1	Binary Search	Easy
2	Merge Sort	Medium
3	Quick Sort	Medium
Future Enhancements
More programming languages
Advanced code execution sandbox
Real-time test monitoring
Leaderboard
Plagiarism detection
Detailed performance analytics
Question bank management
Automated test generation
More advanced faculty analytics
Email/notification system
Deployment

The application is deployed and running successfully in its production environment.

The production database is hosted using Turso, while the application uses a React frontend and Node.js/Express backend.

Contributing
Fork the repository.
Create a new branch.
git checkout -b feature/your-feature
Make your changes.
Commit your changes.
git add .
git commit -m "Add your feature"
Push the branch.
git push origin feature/your-feature
Create a Pull Request.
License

This project is developed for educational and academic purposes.
