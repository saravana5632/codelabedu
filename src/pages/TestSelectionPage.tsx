import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api.ts";
import { CheckSquare, Square, ChevronRight } from "lucide-react";

export default function TestSelectionPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    // Check if locked out
    const malpracticeCount = parseInt(sessionStorage.getItem(`malpractice_test_${user.id}_${testId}`) || "0", 10);
    if (malpracticeCount > 10) {
      alert("You have been locked out of this test due to excessive malpractice violations.");
      navigate("/student", { replace: true });
      return;
    }

    // If they already selected, maybe just redirect them?
    const existingSelection = sessionStorage.getItem(`selectedQuestions_${user.id}_${testId}`);
    if (existingSelection) {
      const parsed = JSON.parse(existingSelection);
      if (parsed.length === 2) {
        navigate(`/test/${testId}/solve`, { replace: true });
        return;
      }
    }
    fetchTestDetails();
  }, [testId, navigate]);

  const fetchTestDetails = async () => {
    try {
      const res = await api.get(`/student/tests/${testId}`);
      setTest(res.data);
    } catch (err) {
      console.error(err);
      navigate("/student");
    }
  };

  const toggleSelection = (questionId: number) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter(id => id !== questionId));
    } else {
      if (selectedQuestions.length < 2) {
        setSelectedQuestions([...selectedQuestions, questionId]);
      }
    }
  };

  const handleStartTest = () => {
    if (selectedQuestions.length === 2) {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      sessionStorage.setItem(`selectedQuestions_${user.id}_${testId}`, JSON.stringify(selectedQuestions));
      navigate(`/test/${testId}/solve`);
    }
  };

  if (!test) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
          <p className="text-gray-600 mt-2">
            Please select exactly <strong>2</strong> problems out of {test.questions.length} to attempt. 
            Once you start the test, you will not be able to change your selection.
          </p>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {test.questions.map((q: any) => {
              const isSelected = selectedQuestions.includes(q.id);
              return (
                <div 
                  key={q.id}
                  onClick={() => toggleSelection(q.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors flex items-start gap-4 ${
                    isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="mt-1 flex-shrink-0 text-blue-600">
                    {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{q.title}</h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800 mt-2 uppercase">
                      {q.difficulty}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              Selected: <span className={`font-bold ${selectedQuestions.length === 2 ? 'text-green-600' : 'text-gray-900'}`}>{selectedQuestions.length}</span> / 2
            </span>
            <button
              onClick={handleStartTest}
              disabled={selectedQuestions.length !== 2}
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Test <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
