/**
 * Firebase Firestore is a NoSQL document database, so it doesn't use SQL schemas.
 * Instead, data is stored in Collections and Documents.
 * 
 * Here is the equivalent structure for the CodeLab app:
 * 
 * Collection: "users"
 * Document ID: Auto-generated or Firebase Auth UID
 * Fields:
 * - name (string)
 * - email (string)
 * - role (string: 'student' | 'faculty')
 * - createdAt (timestamp)
 * 
 * Collection: "tests"
 * Document ID: Auto-generated
 * Fields:
 * - title (string)
 * - startTime (timestamp)
 * - endTime (timestamp)
 * - createdBy (reference to users document or UID string)
 * 
 * Collection: "questions"
 * Document ID: Auto-generated
 * Fields:
 * - testId (reference to tests document or test ID string)
 * - title (string)
 * - description (string)
 * - constraints (string)
 * - sample_io (string)
 * 
 * Collection: "submissions"
 * Document ID: Auto-generated
 * Fields:
 * - questionId (reference to questions document)
 * - userId (reference to users document)
 * - code (string)
 * - language (string)
 * - verdict (string)
 * - score (number)
 * - submittedAt (timestamp)
 */
