import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../lib/api.ts";
import { Play, Send, RefreshCw, ChevronLeft, ShieldAlert, Eye, AlertTriangle, Maximize } from "lucide-react";
import { generateTemplate } from "../lib/templateGenerator";



export default function CodingPage() {
  const { testId } = useParams();
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<number>(0);
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [languages, setLanguages] = useState<Record<number, string>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<number, string>>({});
  const [testData, setTestData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const navigate = useNavigate();
  const [question, setQuestion] = useState<any>(null);
  const [language, setLanguage] = useState("Python");
  const [code, setCode] = useState("");
  const [runResult, setRunResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Anti-Malpractice State
  const [violationCount, setViolationCount] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [warningLevel, setWarningLevel] = useState<number>(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [multiDeviceAlert, setMultiDeviceAlert] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const sessionToken = localStorage.getItem("sessionToken") || "";

  // Helper to log malpractice activity
  const logActivity = async (eventType: string, duration: number = 0, details: string = "") => {
    try {
      const tid = parseInt(testId || "0");
      const res = await api.post("/activity/log", {
        test_id: tid,
        event_type: eventType,
        duration,
        details
      });

      if (res.data) {
        setViolationCount(res.data.violationCount || (v => v + 1));
        setWarningLevel(res.data.warningLevel || 1);
        setWarningMessage(res.data.warningMessage || "Suspicious activity detected.");
      }
    } catch (err) {
      console.error("Failed logging activity", err);
    }
  };

  // Periodic Session Heartbeat
  useEffect(() => {
    const checkSessionActive = async () => {
      try {
        const tid = parseInt(testId || "0");
        const res = await api.post("/session/check", {
          session_token: sessionToken,
          device_info: navigator.userAgent,
          test_id: tid
        });

        if (res.data?.multiDeviceAlert) {
          setMultiDeviceAlert(true);
          setWarningMessage("🚨 Multiple active sessions detected on another device! Faculty has been alerted.");
          setWarningLevel(3);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    };

    checkSessionActive();
    const interval = setInterval(checkSessionActive, 20000);
    return () => clearInterval(interval);
  }, [question, sessionToken]);

  // Tab Switch & Visibility & Focus Monitoring with Windows 7 / Legacy Browser Polyfills
  useEffect(() => {
    let hiddenTime: number | null = null;

    const isPageHidden = () => {
      return document.hidden || (document as any).webkitHidden || (document as any).mozHidden || (document as any).msHidden;
    };

    const getFullScreenElement = () => {
      return document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;
    };

    const handleVisibilityChange = () => {
      if (isPageHidden()) {
        hiddenTime = Date.now();
      } else {
        const returnTime = Date.now();
        const durationSec = hiddenTime ? Math.round((returnTime - hiddenTime) / 1000) : 0;
        hiddenTime = null;
        logActivity("tab_switch", durationSec, `Tab/window hidden for ${durationSec} seconds`);
      }
    };

    const handleBlur = () => {
      logActivity("focus_lost", 0, "Browser lost focus");
    };

    const handleFullScreenChange = () => {
      const isFull = !!getFullScreenElement();
      setIsFullScreen(isFull);
      if (!isFull) {
        logActivity("fullscreen_exit", 0, "Exited full-screen test mode");
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      logActivity("tab_close", 0, "Page refresh or tab close attempt");
    };

    // Standard + Vendor Prefixed Event Listeners for Win7 / Legacy Browsers
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("webkitvisibilitychange", handleVisibilityChange);
    document.addEventListener("msvisibilitychange", handleVisibilityChange);

    window.addEventListener("blur", handleBlur);

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    document.addEventListener("mozfullscreenchange", handleFullScreenChange);
    document.addEventListener("MSFullscreenChange", handleFullScreenChange);

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("webkitvisibilitychange", handleVisibilityChange);
      document.removeEventListener("msvisibilitychange", handleVisibilityChange);

      window.removeEventListener("blur", handleBlur);

      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullScreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullScreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullScreenChange);

      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [question]);

  // Copy, Paste, Cut, Drag, Drop Event Handlers (Support clipboardData and IE window.clipboardData)
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      logActivity("copy_attempt", 0, "Copied code from test environment");
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      logActivity("cut_attempt", 0, "Cut text in test environment");
    };

    const handlePaste = (e: any) => {
      e.preventDefault();
      const clipboardData = e.clipboardData || (window as any).clipboardData;
      const pastedText = clipboardData ? clipboardData.getData("text") || "" : "";
      if (pastedText.length > 100) {
        logActivity("large_paste", 0, `Pasted large code block (${pastedText.length} characters)`);
      } else {
        logActivity("paste_attempt", 0, `Pasted text (${pastedText.length} characters)`);
      }
    };

    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      logActivity("drop_attempt", 0, "Attempted to drop code");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("copy", handleCopy, { capture: true });
    window.addEventListener("cut", handleCut, { capture: true });
    window.addEventListener("paste", handlePaste, { capture: true });
    window.addEventListener("dragstart", handleDrag, { capture: true });
    window.addEventListener("drop", handleDrop, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("copy", handleCopy, { capture: true } as any);
      window.removeEventListener("cut", handleCut, { capture: true } as any);
      window.removeEventListener("paste", handlePaste, { capture: true } as any);
      window.removeEventListener("dragstart", handleDrag, { capture: true } as any);
      window.removeEventListener("drop", handleDrop, { capture: true } as any);
      window.removeEventListener("keydown", handleKeyDown, { capture: true } as any);
    };
  }, [question]);

  const requestFullScreenMode = () => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      setIsFullScreen(true);
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      setIsFullScreen(true);
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      setIsFullScreen(true);
    }
  };

  useEffect(() => {
    setViolationCount(0);
    setWarningLevel(0);
    setWarningMessage(null);
    fetchTest();
  }, [testId]);


  const fetchTest = async () => {
    try {
      const res = await api.get(`/student/tests/${testId}`);
      setTestData(res.data);
      setQuestions(res.data.questions);
      
      const newCodes: Record<number, string> = {};
      const newLanguages: Record<number, string> = {};
      const newStatuses: Record<number, string> = {};
      
      res.data.questions.forEach((q: any) => {
        newLanguages[q.id] = "Python"; // default
        newCodes[q.id] = generateTemplate("Python", q);
        newStatuses[q.id] = "Not Attempted";
      });
      
      // Load previous submissions
      if (res.data.submissions) {
         res.data.submissions.forEach((sub: any) => {
            newLanguages[sub.questionId] = sub.language;
            newCodes[sub.questionId] = sub.sourceCode;
            newStatuses[sub.questionId] = sub.status === "Accepted" ? "Accepted" : "Submitted";
         });
      }

      setCodes(newCodes);
      setLanguages(newLanguages);
      setQuestionStatuses(newStatuses);
      
      if (res.data.attempt) {
        const startedAt = new Date(res.data.attempt.startedAt).getTime();
        const durationMs = res.data.duration * 60 * 1000;
        const endsAt = startedAt + durationMs;
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((endsAt - now) / 1000)));
      }

      if (res.data.questions.length > 0) {
        setActiveQuestionId(res.data.questions[0].id);
        setLanguage(newLanguages[res.data.questions[0].id]);
        setCode(newCodes[res.data.questions[0].id]);
        setQuestion(res.data.questions[0]);
      }
    } catch (err) {
      console.error(err);
      navigate("/student");
    }
  };


  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitAssessment(true); // auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);


  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSwitchQuestion = (qid: number) => {
    // save current code
    if (activeQuestionId) {
      setCodes(prev => ({...prev, [activeQuestionId]: code}));
      setLanguages(prev => ({...prev, [activeQuestionId]: language}));
      if (questionStatuses[activeQuestionId] === "Not Attempted" && code !== generateTemplate(language, question)) {
         setQuestionStatuses(prev => ({...prev, [activeQuestionId]: "Attempted"}));
      }
    }
    const q = questions.find(x => x.id === qid);
    setActiveQuestionId(qid);
    setQuestion(q);
    setCode(codes[qid] || generateTemplate(languages[qid] || "Python", q));
    setLanguage(languages[qid] || "Python");
    setRunResult(null);
  };
  
  const submitAssessment = async (isAutoSubmit: boolean | React.MouseEvent = false) => {
    const auto = isAutoSubmit === true;
    if (!auto) {
      if (!window.confirm("Are you sure you want to submit the entire assessment? You will not be able to return.")) return;
    }
    
    // Auto-submit current code if available
    try {
      if (activeQuestionId && code && code.trim() !== "") {
        await api.post("/student/submit", {
          question_id: activeQuestionId,
          source_code: code,
          language
        });
      }
    } catch (e) {
      console.error("Failed to auto-submit current code", e);
    }

    try {
      await api.post(`/student/tests/${testId}/finish`);
      alert(auto ? "Time is up! Assessment submitted automatically." : "Assessment submitted successfully!");
      navigate("/student");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to submit assessment.");
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    const template = generateTemplate(newLang, question);
    const oldTemplate = generateTemplate(language, question);
    
    if (code.trim() !== "" && code.trim() !== oldTemplate.trim()) {
      if (window.confirm("Changing language will replace your current code with the template. Continue?")) {
        setLanguage(newLang);
        setCode(template);
      }
    } else {
      setLanguage(newLang);
      setCode(template);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setRunResult(null);
    try {
      const res = await api.post("/student/run", {
        question_id: activeQuestionId,
        source_code: code,
        language
      });
      setRunResult(res.data);
    } catch (err) {
      setRunResult({ stderr: "Error connecting to compiler service." });
    }
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await api.post("/student/submit", {
        question_id: activeQuestionId,
        source_code: code,
        language
      });
      alert(`Code submitted successfully! Final Verdict: ${res.data.finalStatus}`);
      setQuestionStatuses(prev => ({...prev, [activeQuestionId]: res.data.finalStatus === "Accepted" ? "Accepted" : "Submitted"}));
    } catch (err) {
      alert("Failed to submit code.");
    }
    setIsSubmitting(false);
  };

  if (!testData || !question) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800 font-sans overflow-hidden relative">
      {/* Fullscreen Overlay Enforcement */}
      {!isFullScreen && (
        <div className="fixed inset-0 bg-slate-900/95 z-[9999] flex flex-col items-center justify-center text-white p-6">
          <ShieldAlert className="w-20 h-20 text-amber-500 mb-6 animate-pulse" />
          <h2 className="text-3xl font-bold mb-4">Proctoring Mode Required</h2>
          <p className="text-slate-300 mb-8 text-center max-w-lg text-lg">
            This assessment requires strict full-screen mode to ensure a fair environment. 
            Exiting full-screen, minimizing the window, or switching tabs will be recorded as malpractice.
          </p>
          <button 
            onClick={requestFullScreenMode}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-900/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
          >
            <Maximize className="w-6 h-6" />
            Enter Fullscreen to Continue
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/student")} className="text-gray-500 hover:text-gray-900 mr-2">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">C</div>
          <span className="font-semibold text-lg tracking-tight">CodeLab <span className="text-gray-400 font-normal ml-2 hidden md:inline-block">| {question.title}</span></span>
        </div>

        <div className="flex items-center gap-6">
          {/* Anti-Malpractice Monitor Badge - Top Right */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-1.5 rounded-full shadow-sm">
            <Eye className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-sm font-bold text-amber-800 flex items-center gap-2">
              Malpractice Count:
              <span className={`px-2 py-0.5 rounded-full font-bold text-white ${violationCount > 0 ? 'bg-red-600' : 'bg-emerald-500'}`}>
                {violationCount}
              </span>
            </span>
          </div>

          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs text-gray-500 uppercase font-semibold">Student</span>
            <span className="text-sm font-medium">{user.name || "Test User"}</span>
          </div>
        </div>
      </header>

      {/* Malpractice Warning Banner */}
      {warningMessage && (
        <div className={`px-6 py-2.5 flex items-center justify-between text-xs font-medium shrink-0 border-b ${
          warningLevel >= 3 
            ? 'bg-red-600 text-white border-red-700' 
            : warningLevel === 2 
            ? 'bg-amber-500 text-white border-amber-600' 
            : 'bg-amber-100 text-amber-900 border-amber-200'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{warningMessage}</span>
          </div>
          <button 
            onClick={() => setWarningMessage(null)}
            className="text-xs underline opacity-80 hover:opacity-100 ml-4 font-semibold"
          >
            Acknowledge
          </button>
        </div>
      )}


      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Questions Navigator */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
            <h2 className="font-bold text-slate-800">Questions</h2>
            <div className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold">
              ⏱ {formatTime(timeLeft)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questions.map((q, idx) => (
              <button 
                key={q.id}
                onClick={() => handleSwitchQuestion(q.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${activeQuestionId === q.id ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-700 text-sm">Q{idx + 1}</span>
                  {questionStatuses[q.id] === "Accepted" && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Accepted"></span>}
                  {questionStatuses[q.id] === "Submitted" && <span className="w-2 h-2 rounded-full bg-amber-500" title="Submitted"></span>}
                  {questionStatuses[q.id] === "Attempted" && <span className="w-2 h-2 rounded-full bg-blue-500" title="Attempted"></span>}
                  {questionStatuses[q.id] === "Not Attempted" && <span className="w-2 h-2 rounded-full bg-slate-300" title="Not Attempted"></span>}
                </div>
                <div className="text-xs text-slate-500 truncate">{q.title}</div>
              </button>
            ))}
          </div>
          <div className="p-4 border-t border-slate-200 bg-white">
            <button onClick={submitAssessment} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm">
              Submit Assessment
            </button>
          </div>
        </div>
        
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
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Public Test Case</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Input</span>
                      <pre className="mt-1 bg-white border border-gray-200 rounded p-2 text-xs font-mono whitespace-pre-wrap">{question.sampleInput || "No input"}</pre>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Output</span>
                      <pre className="mt-1 bg-white border border-gray-200 rounded p-2 text-xs font-mono whitespace-pre-wrap">{question.sampleOutput || "No output"}</pre>
                    </div>
                    {question.publicExplanation && (
                      <div className="col-span-2 mt-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Explanation</span>
                        <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{question.publicExplanation}</p>
                      </div>
                    )}
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
                onChange={handleLanguageChange}
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
                onClick={() => setCode(generateTemplate(language, question))}
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
              language={(language || 'python').toLowerCase()}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "Consolas, 'Courier New', 'Segoe UI', monospace",
                lineHeight: 24,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                roundedSelection: false,
                fastScrollSensitivity: 5,
                contextmenu: false,
                dragAndDrop: false,
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
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-2">Public Test Case Input</label>
                <div className="flex-1 w-full bg-gray-50 border border-gray-200 rounded p-2 text-sm font-mono overflow-auto whitespace-pre-wrap text-slate-700">
                  {question.sampleInput || "No input"}
                </div>
              </div>
              <div className="w-1/2 p-4 flex flex-col bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Test Result</label>
                  {runResult && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${runResult.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {runResult.passed ? 'Passed' : 'Failed'}
                    </span>
                  )}
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded p-2 text-sm font-mono overflow-auto whitespace-pre-wrap text-slate-700">
                  {runResult ? (
                    <>
                      {runResult.compile_output && (
                        <div className="mb-2 text-red-600">
                          <span className="font-bold">Compilation Error:</span><br/>
                          {runResult.compile_output}
                        </div>
                      )}
                      {runResult.stderr && (
                        <div className="mb-2 text-red-600">
                          <span className="font-bold">Error:</span><br/>
                          {runResult.stderr}
                        </div>
                      )}
                      <div className="mb-2">
                        <span className="font-bold text-gray-500">Expected Output:</span><br/>
                        {runResult.expected_output}
                      </div>
                      <div>
                        <span className="font-bold text-gray-500">Your Output:</span><br/>
                        {runResult.stdout || "No output"}
                      </div>
                    </>
                  ) : "Run the code to see output..."}
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
