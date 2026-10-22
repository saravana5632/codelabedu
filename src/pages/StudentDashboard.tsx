import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import {
  LogOut,
  PlayCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

export default function StudentDashboard() {
  const [tests, setTests] = useState<any[]>([]);
  const [completedTests, setCompletedTests] = useState<any[]>([]);

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const testsRes = await api.get("/student/tests");
      setTests(
        Array.isArray(testsRes.data?.available)
          ? testsRes.data.available
          : Array.isArray(testsRes.data)
          ? testsRes.data
          : []
      );
      setCompletedTests(
        Array.isArray(testsRes.data?.completed) ? testsRes.data.completed : []
      );
    } catch (err) {
      if ((err as any).response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout network error
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const formatDurationLabel = (test: any) => {
    if (test.timerEnabled === false) {
      return "Untimed (Timer Disabled)";
    }
    const mins = Number(test.durationMinutes ?? test.duration ?? 60);
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m (${mins} Minutes)`;
    if (hrs > 0) return `${hrs}h (${mins} Minutes)`;
    return `${mins} Minutes`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">CodeLab</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">
              {user.name} ({user.rollNumber})
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-900"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Assessments
          </h2>
          {tests.length > 0 ? (
            <div className="space-y-4">
              {tests.map((test) => {
                const isInProgress = test.sessionStatus === "active";
                return (
                  <div
                    key={test.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {test.title}
                        </h3>
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          <p>
                            Subject:{" "}
                            <span className="font-medium text-gray-900">
                              {test.subject}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-blue-600" />
                            Duration:{" "}
                            <span className="font-mono tabular-nums font-semibold text-gray-900">
                              {formatDurationLabel(test)}
                            </span>
                          </p>
                          <p>
                            Status:{" "}
                            <span
                              className={`font-semibold ${
                                isInProgress
                                  ? "text-blue-700"
                                  : "text-emerald-700"
                              }`}
                            >
                              {isInProgress
                                ? "In Progress (Timer Running)"
                                : "Available"}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/test/${test.id}/selection`)}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none whitespace-nowrap"
                      >
                        <PlayCircle className="w-5 h-5" />
                        {isInProgress ? "Resume Test" : "Start Test"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No Programming Tests Available
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Completed Assessments
          </h2>
          {completedTests.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <ul className="divide-y divide-gray-200">
                {completedTests.map((t, idx) => (
                  <li
                    key={idx}
                    className="p-4 sm:px-6 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Subject: {t.subject} · Duration:{" "}
                        {t.durationMinutes ?? t.duration} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-xs font-semibold text-gray-700">
                        {t.sessionStatus === "expired"
                          ? "Auto-Submitted (Time Expired)"
                          : "Completed"}
                      </span>
                      <CheckCircle className="w-5 h-5 text-green-500 ml-1" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-sm text-gray-500">
              No completed assessments yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
