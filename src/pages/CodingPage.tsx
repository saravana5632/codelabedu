import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../lib/api.ts";
import { Play, Send, RefreshCw, ChevronLeft, AlertTriangle } from "lucide-react";

export default function CodingPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQIndex, setActiveQIndex] = useState(0);

  // State arrays for each selected question
  const [languages, setLanguages] = useState<string[]>(["Python", "Python"]);
  const [codes, setCodes] = useState<string[]>(["", ""]);
  
  const [customInput, setCustomInput] = useState("");
  const [output, setOutput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSolutions, setSubmittedSolutions] = useState<Record<number, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Fullscreen and Malpractice State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [malpracticeCount, setMalpracticeCount] = useState(() => {
    return parseInt(sessionStorage.getItem(`malpractice_test_${user.id}_${testId}`) || "0", 10);
  });
  const [showWarning, setShowWarning] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);
  
  // Use refs to access latest state inside event listeners without re-attaching
  const codesRef = useRef(codes);
  const languagesRef = useRef(languages);
  const isLockedOutRef = useRef(isLockedOut);
  const questionsRef = useRef(questions);
  
  useEffect(() => { codesRef.current = codes; }, [codes]);
  useEffect(() => { languagesRef.current = languages; }, [languages]);
  useEffect(() => { isLockedOutRef.current = isLockedOut; }, [isLockedOut]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  useEffect(() => {
    fetchTestAndQuestions();
  }, [testId]);

  const fetchTestAndQuestions = async () => {
    try {
      const selection = sessionStorage.getItem(`selectedQuestions_${user.id}_${testId}`);
      if (!selection) {
        navigate(`/test/${testId}/selection`);
        return;
      }
      const selectedIds = JSON.parse(selection);
      if (selectedIds.length !== 2) {
        navigate(`/test/${testId}/selection`);
        return;
      }

      const res = await api.get(`/student/tests/${testId}`);
      setTest(res.data);
      
      // Filter to only the selected questions
      const selectedQs = res.data.questions.filter((q: any) => selectedIds.includes(q.id));
      if (selectedQs.length !== 2) {
        navigate(`/test/${testId}/selection`);
        return;
      }
      
      // Fetch full details for the selected questions
      const q1Res = await api.get(`/student/questions/${selectedQs[0].id}`);
      const q2Res = await api.get(`/student/questions/${selectedQs[1].id}`);
      const q1 = q1Res.data;
      const q2 = q2Res.data;
      setQuestions([q1, q2]);
      
      const getStarter = (q: any, lang: string) => {
        if (!q.starterCode) return "";
        const parsed = typeof q.starterCode === 'string' ? JSON.parse(q.starterCode) : q.starterCode;
        return parsed[lang] || "";
      };
      
      setCodes([getStarter(q1, "Python"), getStarter(q2, "Python")]);
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.completed) {
        alert("You have already submitted this test.");
      } else {
        console.error(err);
      }
      navigate("/student");
    }
  };

  // Malpractice Detection Listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        recordMalpractice("Exited fullscreen mode.");
      } else {
        setIsFullscreen(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && document.fullscreenElement) {
        recordMalpractice("Switched tab or window.");
      }
    };

    const handleBlur = () => {
      if (document.fullscreenElement) {
        recordMalpractice("Lost focus on the test window.");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    // Initial check
    if (document.fullscreenElement) {
      setIsFullscreen(true);
    }

    // Page-wide copy/paste/cut ban (covers problem statement, console, etc. — not just the editor)
    const blockClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      recordMalpractice(`Attempted ${e.type} outside the editor.`);
    };
    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("copy", blockClipboard, true);
    document.addEventListener("cut", blockClipboard, true);
    document.addEventListener("paste", blockClipboard, true);
    document.addEventListener("contextmenu", blockContextMenu, true);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("copy", blockClipboard, true);
      document.removeEventListener("cut", blockClipboard, true);
      document.removeEventListener("paste", blockClipboard, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
    };
  }, [testId]);

  const recordMalpractice = (reason: string) => {
    if (isLockedOutRef.current) return;
    
    setMalpracticeCount(prev => {
      const nextCount = prev + 1;
      sessionStorage.setItem(`malpractice_test_${user.id}_${testId}`, nextCount.toString());
      return nextCount;
    });
  };

  // Run side effects when malpracticeCount changes
  useEffect(() => {
    if (malpracticeCount > 0) {
      if (malpracticeCount > 3 && !isLockedOutRef.current) {
        handleAutoSubmit();
      } else if (malpracticeCount <= 3 && !isLockedOutRef.current) {
        setShowWarning(true);
      }
    }
  }, [malpracticeCount]);

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  const handleAutoSubmit = async () => {
    setIsLockedOut(true);
    isLockedOutRef.current = true;
    setIsSubmitting(true);

    if (questionsRef.current.length === 0) {
      // Occurs if locked out on mount before fetch completes
      alert("Test locked due to excessive malpractice violations.");
      navigate("/student");
      return;
    }

    try {
      // Auto submit both questions in one request
      await api.post("/student/submit", {
        submissions: questionsRef.current.map((q, i) => ({
          question_id: q.id,
          source_code: codesRef.current[i],
          language: languagesRef.current[i],
          isAutoSubmit: true
        }))
      });
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
      sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
      alert("Test automatically submitted due to excessive malpractice violations.");
      navigate("/student", { replace: true });
    } catch (err) {
      console.error("Auto-submit failed:", err);
      alert("Failed to auto-submit code. Please contact your instructor.");
      navigate("/student");
    }
  };

  const updateCode = (newCode: string) => {
    const newCodes = [...codes];
    newCodes[activeQIndex] = newCode;
    setCodes(newCodes);
  };

  const updateLanguage = (newLang: string) => {
    const newLangs = [...languages];
    newLangs[activeQIndex] = newLang;
    setLanguages(newLangs);
    
    // Also update the starter code for that language
    const q = questions[activeQIndex];
    if (q && q.starterCode) {
      const parsed = typeof q.starterCode === 'string' ? JSON.parse(q.starterCode) : q.starterCode;
      updateCode(parsed[newLang] || "");
    }
  };

  
  const validateAlgorithm = (code: string, questionTitle: string) => {
    const normalized = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').toLowerCase();
    if (/arrays\.sort|collections\.sort|\.sort\(|\bqsort\(|\bsorted\(/i.test(normalized)) return { isValid: false, detected: "Built-in Sort", required: questionTitle };

    const titleLower = questionTitle.toLowerCase();
    const hasMergeWord = /merge/.test(normalized);
    const hasPivotWord = /pivot|partition/.test(normalized);
    const hasRecursion = /([a-z0-9_]+)\s*\([^)]*\)[\s\S]*?\1\s*\(/i.test(normalized);
    const hasMidCalc = /\+\s*[a-z0-9_]+\s*\)\s*\/\s*2|>>\s*1/.test(normalized) || /mid/.test(normalized);
    const hasSwap = /=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=\s*[a-z0-9_\[\]]+\s*;\s*[a-z0-9_\[\]]+\s*=/i.test(normalized) || /swap/.test(normalized) || /\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]\s*=\s*\[[a-z0-9_]+\],\s*\[[a-z0-9_]+\]/.test(normalized);
    const hasTwoPointerMergeLoop = /while\s*\([^)]+(<|<=)[^)]+(&&|and)[^)]+(<|<=)[^)]+\)/.test(normalized) || /while\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+\s*and\s*[a-z0-9_]+\s*<\s*[a-z0-9_]+/.test(normalized);

    let detected = "Unknown";
    if (hasPivotWord || (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)) detected = "Quick Sort";
    else if (hasMergeWord || (hasRecursion && hasMidCalc && hasTwoPointerMergeLoop) || hasTwoPointerMergeLoop) detected = "Merge Sort";
    else if (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop) detected = "Binary Search";

    if (titleLower.includes("merge sort")) {
        if (detected === "Merge Sort" || (hasTwoPointerMergeLoop && !hasPivotWord)) return { isValid: true, detected: "Merge Sort", required: "Merge Sort" };
        return { isValid: false, detected: detected, required: "Merge Sort" };
    }
    if (titleLower.includes("quick sort")) {
        if (detected === "Quick Sort" || (hasSwap && hasRecursion && !hasMergeWord && !hasTwoPointerMergeLoop)) return { isValid: true, detected: "Quick Sort", required: "Quick Sort" };
        return { isValid: false, detected: detected, required: "Quick Sort" };
    }
    if (titleLower.includes("binary search")) {
        if (detected === "Binary Search" || (hasMidCalc && !hasSwap && !hasTwoPointerMergeLoop)) return { isValid: true, detected: "Binary Search", required: "Binary Search" };
        return { isValid: false, detected: detected, required: "Binary Search" };
    }
    return { isValid: true, detected: "Unknown", required: "Unknown" };
  };

  const handleRun = async (isFinalSubmit: boolean = false) => {
    setIsRunning(!isFinalSubmit);
    if (isFinalSubmit) setIsSubmitting(true);
    
    try {
      const q = questions[activeQIndex];
      const lang = languages[activeQIndex];
      const code = codes[activeQIndex];
      let outputText = "";

      // 1. Evaluate Custom Input if provided (only for Run Code)
      if (!isFinalSubmit && customInput && customInput.trim() !== "") {
        const res = await api.post("/student/run", {
          question_id: q.id,
          source_code: code,
          language: lang,
          input: customInput
        });
        
        outputText += "CUSTOM INPUT RESULT:\n";
        outputText += "Input:\n" + customInput + "\n\n";

        if (res.data.status?.id === 5) {
          outputText += "TIME LIMIT EXCEEDED\n\n";
        } else if (res.data.compile_output) {
          outputText += "COMPILATION ERROR\n" + res.data.compile_output + "\n\n";
        } else if (res.data.stderr) {
          outputText += "RUNTIME ERROR\n" + res.data.stderr + "\n\n";
        } else {
          outputText += "Output:\n" + (res.data.stdout || "Execution completed without output.") + "\n\n";
        }
        outputText += "--------------------------------\n\n";
      }

      // 2. Evaluate Problem's Test Cases
      const testCases = [];
      if (q.sampleInput || q.sampleOutput) {
        testCases.push({
          input: q.sampleInput || "",
          expectedOutput: q.sampleOutput || ""
        });
        // Add a second demo test case just like backend scoring
        testCases.push({
          input: q.sampleInput || "",
          expectedOutput: q.sampleOutput || ""
        });
      }

      let passedCount = 0;
      let totalCount = testCases.length;

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        
        const res = await api.post("/student/run", {
          question_id: q.id,
          source_code: code,
          language: lang,
          input: tc.input
        });

        if (res.data.status?.id === 5) {
           outputText += `Test Case ${i + 1}: TIME LIMIT EXCEEDED\nMarks: 0/25\n\n`;
        } else if (res.data.compile_output) {
           outputText += `Test Case ${i + 1}: COMPILATION ERROR\nMarks: 0/25\n\n`;
        } else if (res.data.stderr) {
           outputText += `Test Case ${i + 1}: RUNTIME ERROR\nMarks: 0/25\n\n`;
        } else {
           const actualOut = (res.data.stdout || "").trim();
           const expectedOut = tc.expectedOutput.trim();
           
           const normalize = (str: string) => str.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
           const isPassed = normalize(actualOut) === normalize(expectedOut);
           
           if (isPassed) passedCount++;
           
           outputText += `Test Case ${i + 1}: ${isPassed ? "PASSED" : "FAILED"}\nMarks: ${isPassed ? "25" : "0"}/25\n\n`;
           outputText += `Input:\n${tc.input}\n\n`;
           outputText += `Expected Output:\n${tc.expectedOutput}\n\n`;
           outputText += `Your Output:\n${actualOut}\n\n`;
        }
      }

      const validation = validateAlgorithm(code, q.title);
      let questionScore = passedCount * 25;
      if (!validation.isValid) {
          questionScore = 0;
      }

      if (totalCount > 0) {
        outputText += `Algorithm Validation: ${validation.isValid ? "PASSED" : "FAILED"}\n`;
        outputText += `Required Algorithm: ${validation.required}\n`;
        outputText += `Detected Algorithm: ${validation.detected}\n\n`;
        outputText += `--------------------------------\n`;
        outputText += `Question Score: ${questionScore}/50\n`;
        outputText += `--------------------------------\n`;
      } else {
        if (outputText === "") {
           outputText = "No test cases found. Please use Custom Input to test your code.";
        }
      }

      setOutput(outputText.trim());
      
      if (isFinalSubmit) {
        setSubmittedSolutions(prev => ({ ...prev, [activeQIndex]: true }));
      }
    } catch (err) {
      setOutput("Error connecting to compiler service.");
    }

    setIsRunning(false);
    if (isFinalSubmit) setIsSubmitting(false);
  };

  const handleSubmitSolution = () => {
    handleRun(true);
  };

  const handleSubmitAssessment = async () => {
    if (questions.length !== 2) {
      alert("Invalid assessment state: exactly 2 questions must be selected.");
      return;
    }
    
    if (!submittedSolutions[0] || !submittedSolutions[1]) {
      alert("Please 'Submit Solution' for both questions before submitting the assessment.");
      setShowSubmitModal(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/student/submit", {
        submissions: questions.map((q, i) => ({
          question_id: q.id,
          source_code: codes[i],
          language: languages[i],
          isAutoSubmit: false
        }))
      });
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
      sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
      alert(`Assessment Submitted Successfully\n\nYour assessment has been finalized.`);
      navigate("/student", { replace: true });
    } catch (err) {
      alert("Failed to submit assessment.");
    }
    setIsSubmitting(false);
    setShowSubmitModal(false);
  };

  

  const handleEditorDidMount = (editorInstance: any) => {
    editorInstance.focus();
    const model = editorInstance.getModel();
    if (!model) return;
    
    let targetLine = 1;
    let targetCol = 1;
    const lineCount = model.getLineCount();
    
    for (let i = lineCount; i >= 1; i--) {
      const content = model.getLineContent(i);
      if (content.trim() === "" && content.length > 0) {
        targetLine = i;
        targetCol = content.length + 1;
        break;
      }
    }
    
    editorInstance.setPosition({ lineNumber: targetLine, column: targetCol });

    // Disable Monaco's built-in right-click context menu (which has Copy/Paste/Cut entries)
    editorInstance.updateOptions({ contextmenu: false });

    // Actual copy/cut/paste blocking is handled once, page-wide, by the
    // document-level "copy"/"cut"/"paste" capture listeners set up in the
    // malpractice-detection useEffect below — that also covers the editor's
    // internal textarea, so we don't duplicate the block (and the malpractice
    // count) here.
  };

  if (questions.length !== 2) return <div className="p-8 text-center text-gray-500">Loading test...</div>;

  const question = questions[activeQIndex];

  if (isLockedOut) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6 z-50">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Terminated</h2>
          <p className="text-gray-600 mb-6">
            Your test was automatically submitted because you exceeded the allowed number of malpractice violations (tab switching, exiting fullscreen, etc.).
          </p>
          <button 
            onClick={() => navigate("/student")}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!isFullscreen) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6 z-50">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fullscreen Required</h2>
          <p className="text-gray-600 mb-6">
            This programming test must be taken in fullscreen mode. Any attempt to exit fullscreen, switch tabs, or lose focus will be recorded.
          </p>
          <button 
            onClick={requestFullscreen}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm"
          >
            Enter Fullscreen & Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800 font-sans overflow-hidden">
      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Malpractice Warning</h3>
            <p className="text-sm text-gray-600 mb-4">
              You have switched tabs, exited fullscreen, or lost focus. This is a violation of test rules.
            </p>
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-md font-semibold text-sm mb-4">
              Warning {malpracticeCount} / 3
            </div>
            <button 
              onClick={() => {
                setShowWarning(false);
                requestFullscreen();
              }}
              className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Acknowledge & Resume
            </button>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/student")} className="text-gray-500 hover:text-gray-900 mr-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-lg tracking-tight">CodeLab <span className="text-gray-400 font-normal ml-2">| {test?.title}</span></span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-md">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setActiveQIndex(idx)}
                className={`px-4 py-1 text-sm font-medium rounded ${activeQIndex === idx ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Q{idx + 1}: {q.title}
              </button>
            ))}
          </div>
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
          <button
            onClick={() => setShowSubmitModal(true)}
            className="ml-4 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors rounded shadow-sm"
          >
            Submit Assessment
          </button>
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
                value={languages[activeQIndex]}
                onChange={(e) => updateLanguage(e.target.value)}
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
                onClick={() => {
                  const q = questions[activeQIndex];
                  if (q && q.starterCode) {
                    const parsed = typeof q.starterCode === 'string' ? JSON.parse(q.starterCode) : q.starterCode;
                    updateCode(parsed[languages[activeQIndex]] || "");
                  } else {
                    updateCode("");
                  }
                }}
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
              language={languages[activeQIndex].toLowerCase()}
              value={codes[activeQIndex]}
              onChange={(value) => updateCode(value || "")}
              onMount={handleEditorDidMount}
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
                onClick={() => handleRun(false)}
                disabled={isRunning || submittedSolutions[activeQIndex]}
                className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors border border-blue-100 rounded-md disabled:opacity-50"
              >
                {isRunning ? "Running..." : "Run Code"}
              </button>
              <button
                onClick={handleSubmitSolution}
                disabled={isSubmitting || submittedSolutions[activeQIndex]}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-md shadow-sm disabled:opacity-50"
              >
                {submittedSolutions[activeQIndex] ? "Solution Saved" : (isSubmitting ? "Evaluating..." : "Submit Solution")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Submit Assessment?</h2>
            <p className="text-gray-600 mb-4">Are you sure you want to submit your assessment?</p>
            <p className="text-gray-600 mb-6">You have selected:<br/>
              {questions.map(q => <span key={q.id}>• {q.title}<br/></span>)}
              <br/>
              Your final answers will be submitted and you will exit the test. You will not be able to continue after submission.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitAssessment}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Confirm Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
