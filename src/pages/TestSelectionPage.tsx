import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import { CheckSquare, Square, ChevronRight, Clock, AlertCircle } from "lucide-react";

export default function TestSelectionPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    fetchTestDetails(user);
  }, [testId, navigate]);

  const fetchTestDetails = async (user: any) => {
    try {
      const res = await api.get(`/student/tests/${testId}`);
      setTest(res.data);

      const availableQs = Array.isArray(res.data.questions)
        ? res.data.questions
        : [];
      const requiredCount = Math.min(2, Math.max(1, availableQs.length));

      // Clear stale local state if backend was reset
      const wasStaleSubmitted =
        sessionStorage.getItem(`submitted_test_${user.id}_${testId}`) ===
        "true";
      if (wasStaleSubmitted) {
        sessionStorage.removeItem(`submitted_test_${user.id}_${testId}`);
        sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
        sessionStorage.removeItem(`malpractice_test_${user.id}_${testId}`);
      }

      // If server already has an active session with selected questions, recover seamlessly
      if (
        res.data.activeSession &&
        Array.isArray(res.data.activeSession.selectedQuestions) &&
        res.data.activeSession.selectedQuestions.length >= requiredCount
      ) {
        sessionStorage.setItem(
          `selectedQuestions_${user.id}_${testId}`,
          JSON.stringify(res.data.activeSession.selectedQuestions)
        );
        sessionStorage.setItem(
          `assessmentSessionId_${user.id}_${testId}`,
          String(res.data.activeSession.sessionId)
        );
        navigate(`/test/${testId}/solve`, { replace: true });
        return;
      }

      // Auto-select if the test has <= 2 questions
      if (availableQs.length > 0 && availableQs.length <= 2) {
        setSelectedQuestions(availableQs.map((q: any) => q.id));
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.completed) {
        sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
      }
      navigate("/student");
    }
  };

  const requiredCount = test?.questions
    ? Math.min(2, Math.max(1, test.questions.length))
    : 2;

  const toggleSelection = (questionId: number) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter((id) => id !== questionId));
    } else {
      if (selectedQuestions.length < requiredCount) {
        setSelectedQuestions([...selectedQuestions, questionId]);
      }
    }
  };

  const handleStartTest = async () => {
    if (selectedQuestions.length < requiredCount) return;
    setStarting(true);
    setErrorMessage("");
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const res = await api.post(`/assessments/${testId}/start`, {
        selectedQuestions,
      });

      sessionStorage.setItem(
        `selectedQuestions_${user.id}_${testId}`,
        JSON.stringify(selectedQuestions)
      );
      if (res.data?.sessionId) {
        sessionStorage.setItem(
          `assessmentSessionId_${user.id}_${testId}`,
          String(res.data.sessionId)
        );
      }
      navigate(`/test/${testId}/solve`);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message ||
          "Unable to start assessment session. Please try again."
      );
      if (err.response?.status === 403 && err.response?.data?.completed) {
        setTimeout(() => navigate("/student"), 1500);
      }
    } finally {
      setStarting(false);
    }
  };

  if (!test)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;

  const durationMinutes = Number(test.durationMinutes ?? test.duration ?? 60);
  const timerEnabled = test.timerEnabled !== false;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Select <strong>{requiredCount}</strong> problem
              {requiredCount > 1 ? "s" : ""} out of {test.questions.length} to
              attempt. Once you start, your server countdown begins immediately.
            </p>
          </div>
          <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg shrink-0 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div className="text-xs">
              <span className="block text-gray-500">Configured Timer</span>
              <span className="font-mono tabular-nums font-bold text-gray-900">
                {timerEnabled ? `${durationMinutes} Minutes` : "Untimed"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {test.questions.map((q: any) => {
              const isSelected = selectedQuestions.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelection(q.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors flex items-start gap-4 ${
                    isSelected
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="mt-1 flex-shrink-0 text-blue-600">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {q.title}
                    </h3>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span className="font-semibold uppercase">
                        Difficulty: {q.difficulty}
                      </span>
                      {q.topic && (
                        <>
                          <span>·</span>
                          <span>{q.topic}</span>
                        </>
                      )}
                      {q.maxMarks && (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {q.maxMarks} Marks
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Selected:{" "}
              <span
                className={`font-mono tabular-nums font-bold ${
                  selectedQuestions.length === requiredCount
                    ? "text-green-600"
                    : "text-gray-900"
                }`}
              >
                {selectedQuestions.length}
              </span>{" "}
              / {requiredCount}
            </span>
            <button
              onClick={handleStartTest}
              disabled={selectedQuestions.length < requiredCount || starting}
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? "Starting Session..." : "Start Test"}{" "}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
