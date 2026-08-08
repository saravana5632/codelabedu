import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import { LogOut, PlayCircle, CheckCircle } from "lucide-react";

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
      setTests(Array.isArray(testsRes.data?.available) ? testsRes.data.available : (Array.isArray(testsRes.data) ? testsRes.data : []));
      setCompletedTests(Array.isArray(testsRes.data?.completed) ? testsRes.data.completed : []);
    } catch (err) {
      if ((err as any).response?.status === 401) {
        navigate("/login");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const activeTest = tests[0]; // For simplicity, take the latest published test

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">CodeLab</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">{user.name} ({user.rollNumber})</span>
            <button onClick={handleLogout} className="text-gray-500 hover:text-gray-900">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Available Test</h2>
          {activeTest ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{activeTest.title}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>Subject: <span className="font-medium text-gray-900">{activeTest.subject}</span></p>
                    <p>Duration: <span className="font-medium text-gray-900">{activeTest.duration} Minutes</span></p>
                    <p>Status: <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">Available</span></p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/test/${activeTest.id}/selection`)}
                  className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                >
                  <PlayCircle className="w-5 h-5" />
                  Start Test
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No Programming Tests Available
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed Tests</h2>
          {completedTests.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <ul className="divide-y divide-gray-200">
                {completedTests.map((t, idx) => (
                  <li key={idx} className="p-4 sm:px-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500 mt-1">Subject: {t.subject}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        Completed
                      </span>
                      <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
