import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../lib/api.ts";
import { Play, Send, RefreshCw, ChevronLeft } from "lucide-react";

export default function CodingPage() {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState<any>(null);
  const [language, setLanguage] = useState("Python");
  const [code, setCode] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchQuestion();
  }, [questionId]);

  const fetchQuestion = async () => {
    try {
      const res = await api.get(`/student/questions/${questionId}`);
      setQuestion(res.data);
      // Set some boilerplate code based on language
    } catch (err) {
      console.error(err);
      navigate("/student");
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await api.post("/student/run", {
        source_code: code,
        language,
        input: customInput
      });
      setOutput(res.data.stdout || res.data.stderr || res.data.compile_output || "Execution completed.");
    } catch (err) {
      setOutput("Error connecting to compiler service.");
    }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.post("/student/submit", {
        question_id: parseInt(questionId || "0"),
        source_code: code,
        language,
        output: "Submitted successfully",
        status: "Submitted"
      });
      alert("Code submitted successfully!");
      navigate("/student");
    } catch (err) {
      alert("Failed to submit code.");
    }
    setIsSubmitting(false);
  };

  if (!question) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/student")} className="text-gray-500 hover:text-gray-900 mr-2">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">C</div>
          <span className="font-semibold text-lg tracking-tight">CodeLab <span className="text-gray-400 font-normal ml-2">| {question.title}</span></span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase font-semibold">Student</span>
            <span className="text-sm font-medium">{user.name || "Test User"}</span>
          </div>
          <div className="h-10 w-[1px] bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase font-semibold">Time Remaining</span>
              <span className="text-sm font-mono font-bold text-red-600">--:--</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Question Description */}
        <div className="w-[40%] border-r border-gray-200 flex flex-col bg-white overflow-hidden">
          <div className="p-6 overflow-y-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">{question.title}</h1>
              <div className="flex gap-2 mb-4">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">{question.difficulty}</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                {question.description}
              </p>
            </div>
            
            <div className="space-y-6">
              {question.inputFormat && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Input Format</h3>
                  <p className="text-sm text-slate-700">{question.inputFormat}</p>
                </div>
              )}
              
              {question.outputFormat && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Output Format</h3>
                  <p className="text-sm text-slate-700">{question.outputFormat}</p>
                </div>
              )}

              {question.constraints && (
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Constraints</h3>
                  <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                    {question.constraints.split('\n').map((c: string, idx: number) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(question.sampleInput || question.sampleOutput) && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Sample Case</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Input</span>
                      <pre className="mt-1 bg-white border border-gray-200 rounded p-2 text-xs font-mono whitespace-pre-wrap">{question.sampleInput || "No sample input"}</pre>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Output</span>
                      <pre className="mt-1 bg-white border border-gray-200 rounded p-2 text-xs font-mono whitespace-pre-wrap">{question.sampleOutput || "No sample output"}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Editor & Console */}
        <div className="w-[60%] flex flex-col bg-gray-50">
          
          {/* Editor Header */}
          <div className="h-12 px-4 flex items-center justify-between bg-white border-b border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-white border border-gray-200 text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="C">C</option>
                <option value="C++">C++</option>
                <option value="Java">Java</option>
                <option value="Python">Python</option>
                <option value="JavaScript">JavaScript</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCode("")}
                className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 p-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Reset Code
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 bg-white relative font-mono text-sm leading-relaxed overflow-hidden border-b border-gray-200">
            <Editor
              height="100%"
              language={language.toLowerCase()}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 24,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                roundedSelection: false,
              }}
            />
          </div>

          {/* Output/Console Area */}
          <div className="h-64 flex flex-col bg-white">
            <div className="h-8 px-4 flex items-center bg-gray-50 border-b border-gray-200 justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Console</span>
            </div>
            <div className="flex-1 flex min-h-0">
              <div className="w-1/2 border-r border-gray-200 p-4 flex flex-col bg-white">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2">Custom Input</label>
                <textarea 
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  className="flex-1 w-full resize-none border border-gray-200 rounded p-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                  placeholder="Enter inputs here..."
                />
              </div>
              <div className="w-1/2 p-4 flex flex-col bg-gray-50">
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2">Output</label>
                <div className="flex-1 bg-white border border-gray-200 rounded p-2 text-sm font-mono overflow-auto whitespace-pre-wrap text-slate-700">
                  {output || "Output will appear here..."}
                </div>
              </div>
            </div>
            
            {/* Bottom Buttons */}
            <div className="h-14 px-6 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors border border-blue-100 rounded-md disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Run Code"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-md shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Solution"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
