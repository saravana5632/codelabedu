import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import { LogOut, PlayCircle, CheckCircle } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db as firestoreDb } from "../lib/firebase.ts";

export default function StudentDashboard() {
  const [tests, setTests] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchData();
    
    // Listen to changes in the "tests" collection in Firestore
    // as requested, so when an admin updates isPublished/isActive,
    // the dashboard refreshes automatically.
    const unsubscribe = onSnapshot(
      collection(firestoreDb, "tests"), 
      () => {
        console.log("Firestore 'tests' collection updated. Fetching latest data from API...");
        fetchData();
      },
      (error) => {
        console.error("Firestore listener error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      const [testsRes, subsRes] = await Promise.all([
        api.get("/student/tests"),
        api.get("/student/submissions")
      ]);
      setTests(testsRes.data);
      setSubmissions(subsRes.data);
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

  const handleStartTest = (testId: number) => {
    navigate(`/coding/${testId}`);
  };

  

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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Tests</h2>
          {tests.length > 0 ? (
            <div className="space-y-4">
              {tests.map(activeTest => (
                <div key={activeTest.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{activeTest.title}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Subject: <span className="font-medium text-gray-900">{activeTest.subject}</span></p>
                        <p>Duration: <span className="font-medium text-gray-900">{activeTest.duration} Minutes</span></p>
                        <p>Total Marks: <span className="font-medium text-gray-900">{activeTest.totalMarks || 100}</span></p>
                        <p>Number of Questions: <span className="font-medium text-gray-900">{activeTest.questionCount || 0}</span></p>
                        <p>Status: <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-1">Available</span></p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartTest(activeTest.id)}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                      <PlayCircle className="w-5 h-5" />
                      Start Test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
              No Programming Tests Available
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Completed Tests / Submissions</h2>
          {submissions.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {submissions.map((sub, idx) => (
                  <li key={idx} className="p-4 sm:px-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Submission #{sub.id}</p>
                      <p className="text-xs text-gray-500 mt-1">Language: {sub.language}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {new Date(sub.submittedAt).toLocaleString()}
                      <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500 text-sm">
              You haven't submitted any tests yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
