/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.tsx";
import StudentDashboard from "./pages/StudentDashboard.tsx";
import CodingPage from "./pages/CodingPage.tsx";
import FacultyLayout from "./pages/faculty/FacultyLayout.tsx";
import DashboardHome from "./pages/faculty/DashboardHome.tsx";
import TestManagement from "./pages/faculty/TestManagement.tsx";
import TestAnalytics from "./pages/faculty/TestAnalytics.tsx";
import StudentManagement from "./pages/faculty/StudentManagement.tsx";

import TestSelectionPage from "./pages/TestSelectionPage.tsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student" element={<StudentDashboard />} />
        
        {/* Faculty Routes */}
        <Route path="/faculty" element={<FacultyLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="tests" element={<TestManagement />} />
          <Route path="analytics/:id" element={<TestAnalytics />} />
          {/* Placeholders for other nav items */}
          <Route path="analytics" element={<div className="p-4">Please select a test from the Tests tab to view analytics.</div>} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="reports" element={<div className="p-4">Reports Coming Soon</div>} />
          <Route path="settings" element={<div className="p-4">Settings Coming Soon</div>} />
        </Route>

        <Route path="/test/:testId/selection" element={<TestSelectionPage />} />
        <Route path="/test/:testId/solve" element={<CodingPage />} />
      </Routes>
    </Router>
  );
}
