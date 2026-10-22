import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../lib/api.ts";
import ProblemStatementView from "../lib/ProblemStatementView.tsx";
import {
  RefreshCw,
  ChevronLeft,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Send,
} from "lucide-react";

export default function CodingPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [test, setTest] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQIndex, setActiveQIndex] = useState(0);

  // Per-question selected language & code state
  const [languages, setLanguages] = useState<string[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  // Store per-question, per-language buffers so switching languages or tabs preserves edits
  const [codeBuffers, setCodeBuffers] = useState<
    Record<number, Record<string, string>>
  >({});

  // Language change confirmation warning state
  const [pendingLanguageChange, setPendingLanguageChange] = useState<
    string | null
  >(null);

  // Console / Test Case & Results Panel State (below editor)
  const [bottomTab, setBottomTab] = useState<"testcase" | "result">("testcase");
  const [selectedExampleIdx, setSelectedExampleIdx] = useState<number>(0);
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);

  const [output, setOutput] = useState("");
  const [evaluationByQuestion, setEvaluationByQuestion] = useState<
    Record<number, any>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSolutions, setSubmittedSolutions] = useState<
    Record<number, boolean>
  >({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string>("");

  // ==================== AUTHORITATIVE SERVER TIMER STATE ====================
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isCompletedModal, setIsCompletedModal] = useState<boolean>(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);

  const serverOffsetMsRef = useRef<number>(0);
  const deadlineMsRef = useRef<number | null>(null);
  const timerEnabledRef = useRef<boolean>(true);
  const timerSubmittingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number | null>(null);
  const draftTimeoutRef = useRef<number | null>(null);

  // Format seconds as HH:MM:SS (when >= 1 hour) or MM:SS (e.g., 44:59)
  const formatTime = (seconds: number) => {
    const safeSecs = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSecs / 3600);
    const minutes = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(secs).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  };

  const applyServerTiming = (sessionData: {
    sessionId?: number;
    timerEnabled?: boolean;
    deadlineAt?: string | null;
    serverTime?: string;
    status?: string;
  }) => {
    if (sessionData.sessionId) {
      setSessionId(sessionData.sessionId);
      sessionIdRef.current = sessionData.sessionId;
      sessionStorage.setItem(
        `assessmentSessionId_${user.id}_${testId}`,
        String(sessionData.sessionId)
      );
    }

    if (sessionData.serverTime) {
      const srvMs = new Date(sessionData.serverTime).getTime();
      if (!isNaN(srvMs)) {
        serverOffsetMsRef.current = srvMs - Date.now();
      }
    }

    const enabled = sessionData.timerEnabled !== false;
    setTimerEnabled(enabled);
    timerEnabledRef.current = enabled;

    if (enabled && sessionData.deadlineAt) {
      setDeadlineAt(sessionData.deadlineAt);
      const dMs = new Date(sessionData.deadlineAt).getTime();
      deadlineMsRef.current = dMs;
      const nowAuthoritative = Date.now() + serverOffsetMsRef.current;
      const remaining = Math.max(
        0,
        Math.floor((dMs - nowAuthoritative) / 1000)
      );
      setTimeLeft(remaining);
    } else {
      setDeadlineAt(null);
      deadlineMsRef.current = null;
      setTimeLeft(null);
    }
  };

  const getStarterForQuestion = (q: any, lang: string): string => {
    if (!q || !q.starterCode) return "";
    const parsed =
      typeof q.starterCode === "string"
        ? JSON.parse(q.starterCode)
        : q.starterCode;
    return parsed?.[lang] || "";
  };

  // Persist code drafts to the backend session so server-side expiry has latest code
  const flushDraftToServer = async (
    currentQuestions = questionsRef.current,
    currentCodes = codesRef.current,
    currentLangs = languagesRef.current
  ) => {
    const activeSessId = sessionIdRef.current;
    if (!activeSessId || currentQuestions.length === 0 || isExpired) return;

    const draftsPayload: Record<string, any> = {};
    currentQuestions.forEach((q, idx) => {
      if (q && q.id) {
        draftsPayload[String(q.id)] = {
          sourceCode: currentCodes[idx] ?? "",
          language: currentLangs[idx] || "Python",
        };
      }
    });

    try {
      const res = await api.put(`/assessment-sessions/${activeSessId}/draft`, {
        drafts: draftsPayload,
      });
      if (res.data?.savedAt) {
        setLastDraftSavedAt(res.data.savedAt);
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.expired) {
        handleTimerExpired();
      }
    }
  };

  // Fetch test, questions and initialize authoritative server session
  const fetchTestAndQuestions = async () => {
    try {
      const res = await api.get(`/student/tests/${testId}`);
      setTest(res.data);

      const allPublishedQs: any[] = Array.isArray(res.data.questions)
        ? res.data.questions
        : [];

      if (allPublishedQs.length === 0) {
        setQuestions([]);
        return;
      }

      let selectedIds: number[] = [];
      const localSelection = sessionStorage.getItem(
        `selectedQuestions_${user.id}_${testId}`
      );
      if (localSelection) {
        try {
          selectedIds = JSON.parse(localSelection);
        } catch {
          selectedIds = [];
        }
      } else if (
        res.data.activeSession &&
        Array.isArray(res.data.activeSession.selectedQuestions)
      ) {
        selectedIds = res.data.activeSession.selectedQuestions;
        sessionStorage.setItem(
          `selectedQuestions_${user.id}_${testId}`,
          JSON.stringify(selectedIds)
        );
      }

      // If test has <= 2 questions and none selected yet, auto-select them
      if (
        (!Array.isArray(selectedIds) || selectedIds.length === 0) &&
        allPublishedQs.length <= 2
      ) {
        selectedIds = allPublishedQs.map((q) => q.id);
        sessionStorage.setItem(
          `selectedQuestions_${user.id}_${testId}`,
          JSON.stringify(selectedIds)
        );
      }

      if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        navigate(`/test/${testId}/selection`);
        return;
      }

      // Start or recover authoritative assessment session on the server
      const sessionRes = await api.post(`/assessments/${testId}/start`, {
        selectedQuestions: selectedIds,
      });

      const sessionData = sessionRes.data;
      applyServerTiming(sessionData);

      // Include selected questions first, plus any newly published questions added by admin
      const orderedQuestionIds = [
        ...selectedIds.filter((id) => allPublishedQs.some((q) => q.id === id)),
        ...allPublishedQs
          .map((q) => q.id)
          .filter((id) => !selectedIds.includes(id)),
      ];

      const fullQuestions = await Promise.all(
        orderedQuestionIds.map((qId) =>
          api.get(`/student/questions/${qId}`).then((r) => r.data)
        )
      );

      setQuestions(fullQuestions);

      const savedDrafts = sessionData.drafts || {};
      const initLangs: string[] = [];
      const initCodes: string[] = [];
      const initBuffers: Record<number, Record<string, string>> = {};

      fullQuestions.forEach((q) => {
        const d = savedDrafts[String(q.id)];
        const enabledLangs: string[] =
          Array.isArray(q.enabledLanguages) && q.enabledLanguages.length > 0
            ? q.enabledLanguages
            : ["Java", "C++", "Python", "C", "JavaScript"];
        const defaultLang = enabledLangs.includes("Python")
          ? "Python"
          : enabledLangs[0] || "Java";
        const lang =
          d?.language && enabledLangs.includes(d.language)
            ? d.language
            : defaultLang;
        const starter = getStarterForQuestion(q, lang);
        const code =
          d?.sourceCode !== undefined && d.sourceCode !== ""
            ? d.sourceCode
            : starter;

        initLangs.push(lang);
        initCodes.push(code);
        initBuffers[q.id] = { [lang]: code };
      });

      setLanguages(initLangs);
      setCodes(initCodes);
      setCodeBuffers(initBuffers);
    } catch (error: any) {
      if (error.response?.status === 403 && error.response?.data?.completed) {
        if (error.response?.data?.expired) {
          setIsExpired(true);
        } else {
          navigate("/student", { replace: true });
        }
      } else {
        console.error("Error fetching test and questions:", error);
      }
    }
  };

  // ==================== DRIFT-FREE COUNTDOWN ====================
  useEffect(() => {
    if (!timerEnabled || deadlineAt === null) return;

    const tick = () => {
      if (!timerEnabledRef.current || deadlineMsRef.current === null) return;
      const nowAuthoritative = Date.now() + serverOffsetMsRef.current;
      const remaining = Math.max(
        0,
        Math.floor((deadlineMsRef.current - nowAuthoritative) / 1000)
      );
      setTimeLeft(remaining);

      if (remaining <= 0 && !timerSubmittingRef.current) {
        handleTimerExpired();
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [timerEnabled, deadlineAt]);

  // Periodic lightweight server synchronization (every 30s and on window focus)
  useEffect(() => {
    if (!sessionId || isExpired) return;

    const syncWithServer = async () => {
      if (!sessionIdRef.current || timerSubmittingRef.current) return;
      try {
        const res = await api.get(
          `/assessment-sessions/${sessionIdRef.current}/timer`
        );
        if (res.data.status === "expired") {
          handleTimerExpired();
          return;
        }
        if (res.data.status === "submitted") {
          navigate("/student", { replace: true });
          return;
        }
        applyServerTiming(res.data);
      } catch {
        // Ignore transient network hiccups; local deadline math continues seamlessly
      }
    };

    const syncInterval = window.setInterval(syncWithServer, 30000);
    window.addEventListener("online", syncWithServer);

    return () => {
      window.clearInterval(syncInterval);
      window.removeEventListener("online", syncWithServer);
    };
  }, [sessionId, isExpired]);

  const timerDisplay = !timerEnabled
    ? "Untimed"
    : timeLeft !== null
    ? formatTime(timeLeft)
    : "--:--";

  // Fullscreen and Malpractice State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [malpracticeCount, setMalpracticeCount] = useState(() => {
    return parseInt(
      sessionStorage.getItem(`malpractice_test_${user.id}_${testId}`) || "0",
      10
    );
  });
  const [showWarning, setShowWarning] = useState(false);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const codesRef = useRef(codes);
  const languagesRef = useRef(languages);
  const isLockedOutRef = useRef(isLockedOut);
  const questionsRef = useRef(questions);

  useEffect(() => {
    codesRef.current = codes;
  }, [codes]);
  useEffect(() => {
    languagesRef.current = languages;
  }, [languages]);
  useEffect(() => {
    isLockedOutRef.current = isLockedOut;
  }, [isLockedOut]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    fetchTestAndQuestions();
    return () => {
      if (draftTimeoutRef.current) {
        window.clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [testId]);

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

    if (document.fullscreenElement) {
      setIsFullscreen(true);
    }

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

  const recordMalpractice = (_reason: string) => {
    if (isLockedOutRef.current || timerSubmittingRef.current) return;

    setMalpracticeCount((prev) => {
      const nextCount = prev + 1;
      sessionStorage.setItem(
        `malpractice_test_${user.id}_${testId}`,
        nextCount.toString()
      );
      return nextCount;
    });
  };

  useEffect(() => {
    if (malpracticeCount > 0) {
      if (malpracticeCount > 3 && !isLockedOutRef.current) {
        handleAutoSubmitMalpractice();
      } else if (malpracticeCount <= 3 && !isLockedOutRef.current) {
        setShowWarning(true);
      }
    }
  }, [malpracticeCount]);

  const requestFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        setIsFullscreen(true);
      });
    } else {
      setIsFullscreen(true);
    }
  };

  const handleAutoSubmitMalpractice = async () => {
    setIsLockedOut(true);
    isLockedOutRef.current = true;
    setIsSubmitting(true);

    if (questionsRef.current.length === 0) {
      navigate("/student");
      return;
    }

    try {
      const payload = {
        sessionId: sessionIdRef.current,
        isAutoSubmit: true,
        reason: "malpractice",
        submissions: questionsRef.current.map((q, i) => ({
          question_id: q.id,
          source_code: codesRef.current[i] || "",
          language: languagesRef.current[i] || "Python",
          isAutoSubmit: true,
        })),
      };

      if (sessionIdRef.current) {
        await api.post(
          `/assessment-sessions/${sessionIdRef.current}/submit`,
          payload
        );
      } else {
        await api.post("/student/submit", payload);
      }
      sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
      sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
    } catch (err) {
      console.error("Auto-submit failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scheduleDraftSave = (
    nextCodes: string[],
    nextLangs: string[] = languagesRef.current
  ) => {
    if (draftTimeoutRef.current) {
      window.clearTimeout(draftTimeoutRef.current);
    }
    draftTimeoutRef.current = window.setTimeout(() => {
      flushDraftToServer(questionsRef.current, nextCodes, nextLangs);
    }, 2000);
  };

  const updateCode = (newCode: string) => {
    if (isExpired) return;
    const q = questions[activeQIndex];
    const currentLang = languages[activeQIndex] || "Python";
    const newCodes = [...codes];
    newCodes[activeQIndex] = newCode;
    setCodes(newCodes);

    if (q) {
      setCodeBuffers((prev) => ({
        ...prev,
        [q.id]: {
          ...(prev[q.id] || {}),
          [currentLang]: newCode,
        },
      }));
    }
    scheduleDraftSave(newCodes, languages);
  };

  const applyLanguageSwitch = (newLang: string, replaceWithStarter = false) => {
    if (isExpired) return;
    const q = questions[activeQIndex];
    const newLangs = [...languages];
    newLangs[activeQIndex] = newLang;
    setLanguages(newLangs);

    const starter = getStarterForQuestion(q, newLang);
    const savedInBuffer = q ? codeBuffers[q.id]?.[newLang] : undefined;
    const nextCode =
      !replaceWithStarter && savedInBuffer !== undefined
        ? savedInBuffer
        : starter;

    const newCodes = [...codes];
    newCodes[activeQIndex] = nextCode;
    setCodes(newCodes);

    if (q) {
      setCodeBuffers((prev) => ({
        ...prev,
        [q.id]: {
          ...(prev[q.id] || {}),
          [newLang]: nextCode,
        },
      }));
    }

    setPendingLanguageChange(null);
    scheduleDraftSave(newCodes, newLangs);
  };

  const handleLanguageSelectChange = (newLang: string) => {
    if (isExpired) return;
    const currentLang = languages[activeQIndex];
    if (newLang === currentLang) return;

    const q = questions[activeQIndex];
    const currentCode = (codes[activeQIndex] || "").trim();
    const currentStarter = getStarterForQuestion(q, currentLang).trim();

    // Warn student if they modified the current code and haven't confirmed switching
    if (currentCode !== "" && currentCode !== currentStarter) {
      setPendingLanguageChange(newLang);
      return;
    }

    applyLanguageSwitch(newLang, false);
  };

  const handleSwitchQuestion = (idx: number) => {
    flushDraftToServer(questions, codes, languages);
    setPendingLanguageChange(null);
    setActiveQIndex(idx);
    setSelectedExampleIdx(0);
  };

  // ==================== RUN CODE (PUBLIC EXAMPLES / CUSTOM INPUT) ====================
  const handleRun = async () => {
    if (isExpired) return;
    setIsRunning(true);
    setBottomTab("result");

    try {
      await flushDraftToServer(questions, codes, languages);

      const q = questions[activeQIndex];
      const lang = languages[activeQIndex];
      const code = codes[activeQIndex];

      const payload: any = {
        question_id: q.id,
        source_code: code,
        language: lang,
      };

      if (useCustomInput && customInput.trim() !== "") {
        payload.input = customInput.trim();
      } else if (Array.isArray(q.examples) && q.examples[selectedExampleIdx]) {
        payload.exampleIndex = selectedExampleIdx;
      } else if (q.sampleInput) {
        payload.input = q.sampleInput;
      }

      const res = await api.post("/student/run", payload);

      if (res.data.evaluation) {
        setEvaluationByQuestion((prev) => ({
          ...prev,
          [q.id]: {
            ...res.data.evaluation,
            mode: "run",
          },
        }));
        setOutput(res.data.evaluation.formattedReport || "");
      } else {
        let outText = "";
        if (res.data.compile_output) {
          outText = `COMPILATION ERROR:\n${res.data.compile_output}`;
        } else if (res.data.stderr) {
          outText = `RUNTIME ERROR:\n${res.data.stderr}`;
        } else {
          outText = res.data.stdout || "Execution finished with no output.";
        }
        setOutput(outText);
      }
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.expired) {
        handleTimerExpired();
      } else {
        setOutput(
          err.response?.data?.message || "Error connecting to compiler service."
        );
      }
    } finally {
      setIsRunning(false);
    }
  };

  // ==================== SUBMIT CODE (SERVER EVALUATION AGAINST PRIVATE TEST CASES) ====================
  const handleSubmitSolution = async () => {
    if (isExpired) return;
    setIsSubmitting(true);
    setBottomTab("result");

    try {
      await flushDraftToServer(questions, codes, languages);

      const q = questions[activeQIndex];
      const lang = languages[activeQIndex];
      const code = codes[activeQIndex];

      const res = await api.post(`/student/questions/${q.id}/submit`, {
        question_id: q.id,
        source_code: code,
        language: lang,
      });

      const evaluation = res.data.evaluation;
      if (evaluation) {
        setEvaluationByQuestion((prev) => ({
          ...prev,
          [q.id]: {
            ...evaluation,
            mode: "submit",
          },
        }));
        setOutput(evaluation.formattedReport || "");
      }

      setSubmittedSolutions((prev) => ({ ...prev, [activeQIndex]: true }));
      setStatusBanner(
        `Solution for Q${activeQIndex + 1} (${q.title}) evaluated against ${
          evaluation?.totalCount ?? 0
        } server test cases: ${evaluation?.passedCount ?? 0}/${
          evaluation?.totalCount ?? 0
        } passed (Score: ${evaluation?.score ?? 0}/${
          evaluation?.maxMarks ?? 50
        }).`
      );
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.expired) {
        handleTimerExpired();
      } else {
        setOutput(
          err.response?.data?.message || "Error evaluating submission on server."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (questions.length === 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        sessionId: sessionIdRef.current,
        isAutoSubmit: false,
        submissions: questions.map((q, i) => ({
          question_id: q.id,
          source_code: codes[i] || "",
          language: languages[i] || "Python",
          isAutoSubmit: false,
        })),
      };

      if (sessionIdRef.current) {
        await api.post(
          `/assessment-sessions/${sessionIdRef.current}/submit`,
          payload
        );
      } else {
        await api.post("/student/submit", payload);
      }

      sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
      sessionStorage.removeItem(`assessmentSessionId_${user.id}_${testId}`);
      sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
      setShowSubmitModal(false);
      setIsCompletedModal(true);
    } catch (err: any) {
      setShowSubmitModal(false);
      if (err.response?.status === 403 && err.response?.data?.expired) {
        setIsExpired(true);
      } else {
        setStatusBanner(
          err.response?.data?.message || "Failed to submit assessment."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimerExpired = async () => {
    if (timerSubmittingRef.current) return;
    timerSubmittingRef.current = true;
    setIsExpired(true);
    setTimeLeft(0);
    setIsSubmitting(true);

    try {
      const payload = {
        sessionId: sessionIdRef.current,
        isAutoSubmit: true,
        reason: "timer_expired",
        submissions: questionsRef.current.map((q, i) => ({
          question_id: q.id,
          source_code: codesRef.current[i] || "",
          language: languagesRef.current[i] || "Python",
          isAutoSubmit: true,
        })),
      };

      if (sessionIdRef.current) {
        await api.post(
          `/assessment-sessions/${sessionIdRef.current}/submit`,
          payload
        );
      } else if (questionsRef.current.length > 0) {
        await api.post("/student/submit", payload);
      }

      sessionStorage.removeItem(`selectedQuestions_${user.id}_${testId}`);
      sessionStorage.removeItem(`assessmentSessionId_${user.id}_${testId}`);
      sessionStorage.setItem(`submitted_test_${user.id}_${testId}`, "true");
    } catch (error) {
      console.error("Timer auto-submit error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditorDidMount = (editorInstance: any) => {
    editorInstance.focus();
    editorInstance.updateOptions({ contextmenu: false });
  };

  if (isExpired) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6 z-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md w-full text-center space-y-4">
          <Clock className="w-14 h-14 text-red-600 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">
            Assessment Time Expired
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            The configured time limit for this assessment has reached{" "}
            <strong className="font-mono">00:00</strong>. Your latest saved code
            and solutions have been automatically submitted and evaluated on the
            server. Further edits or submissions are disabled.
          </p>
          <button
            onClick={() => navigate("/student", { replace: true })}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Return to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isCompletedModal) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6 z-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">
            Assessment Submitted
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Your assessment solutions have been finalized and recorded on the
            server.
          </p>
          <button
            onClick={() => navigate("/student", { replace: true })}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Return to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0)
    return (
      <div className="p-8 text-center text-gray-500">
        Loading assessment workspace...
      </div>
    );

  const question = questions[activeQIndex] || questions[0];
  const currentEval = evaluationByQuestion[question.id];
  const enabledLangs: string[] =
    Array.isArray(question.enabledLanguages) &&
    question.enabledLanguages.length > 0
      ? question.enabledLanguages
      : ["Java", "C++", "Python", "C", "JavaScript"];

  if (isLockedOut) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50 p-6 z-50">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Test Terminated
          </h2>
          <p className="text-gray-600 mb-6">
            Your test was automatically submitted because you exceeded the
            allowed number of malpractice violations (tab switching, exiting
            fullscreen, etc.).
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Fullscreen Required
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            This programming test must be taken in fullscreen mode. Any attempt
            to exit fullscreen, switch tabs, or lose focus will be recorded.
          </p>
          {timerEnabled && timeLeft !== null && (
            <p className="text-xs font-mono tabular-nums text-blue-700 font-semibold mb-6">
              Time Remaining: {timerDisplay}
            </p>
          )}
          <button
            onClick={requestFullscreen}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm"
          >
            Enter Fullscreen & Continue
          </button>
        </div>
      </div>
    );
  }

  const isOneMinuteWarning =
    timerEnabled && timeLeft !== null && timeLeft > 0 && timeLeft <= 60;
  const isFiveMinuteWarning =
    timerEnabled && timeLeft !== null && timeLeft > 60 && timeLeft <= 300;

  return (
    <div className="h-screen flex flex-col bg-white text-slate-800 font-sans overflow-hidden">
      {/* Malpractice Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Malpractice Warning
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You have switched tabs, exited fullscreen, or lost focus. This is
              a violation of test rules.
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

      {/* 1-Minute Prominent Warning Banner */}
      {isOneMinuteWarning && (
        <div
          role="alert"
          className="bg-red-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              FINAL MINUTE WARNING: Less than 1 minute remaining ({timerDisplay}
              ). Your assessment will automatically submit when the timer
              reaches 00:00.
            </span>
          </div>
          <span className="font-mono tabular-nums font-bold">
            Time Remaining: {timerDisplay}
          </span>
        </div>
      )}

      {/* 5-Minute Warning Banner */}
      {isFiveMinuteWarning && (
        <div
          role="status"
          className="bg-amber-500 text-slate-950 px-6 py-1.5 text-xs font-semibold flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              5-Minute Warning: Less than 5 minutes remaining. Ensure your
              latest code is tested and saved.
            </span>
          </div>
          <span className="font-mono tabular-nums font-bold">
            Time Remaining: {timerDisplay}
          </span>
        </div>
      )}

      {/* Status feedback banner */}
      {statusBanner && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-900 px-6 py-1.5 text-xs font-medium flex items-center justify-between shrink-0">
          <span>{statusBanner}</span>
          <button
            onClick={() => setStatusBanner("")}
            className="text-blue-700 hover:text-blue-950 font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="h-14 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-6 overflow-x-auto">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate("/student")}
              className="text-gray-500 hover:text-gray-900 mr-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-lg tracking-tight whitespace-nowrap">
              CodeLab{" "}
              <span className="text-gray-400 font-normal ml-2">
                | {test?.title}
              </span>
            </span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-md">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => handleSwitchQuestion(idx)}
                className={`px-3.5 py-1 text-xs font-semibold rounded whitespace-nowrap flex items-center gap-1.5 ${
                  activeQIndex === idx
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <span>
                  Q{idx + 1}: {q.title}
                </span>
                {submittedSolutions[idx] && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-gray-500 font-medium">
              {user.name || "Student"}
            </span>
            {lastDraftSavedAt && (
              <span className="text-[10px] text-gray-400 font-mono tabular-nums">
                Draft synced
              </span>
            )}
          </div>
          <div className="h-8 w-[1px] bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <Clock
              className={`w-4 h-4 ${
                isOneMinuteWarning
                  ? "text-red-600"
                  : isFiveMinuteWarning
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            />
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-semibold">
                {timerEnabled ? "Time Remaining" : "Timer Status"}
              </span>
              <span
                data-testid="student-countdown-timer"
                className={`text-sm font-mono tabular-nums font-bold ${
                  isOneMinuteWarning
                    ? "text-red-600"
                    : isFiveMinuteWarning
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {timerEnabled ? `Time Remaining: ${timerDisplay}` : "Untimed"}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={isExpired || isSubmitting}
            className="ml-2 px-4 py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 transition-colors rounded shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            Finish Assessment
          </button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - LeetCode-Inspired Question Statement */}
        <div className="w-[42%] border-r border-gray-200 flex flex-col bg-white overflow-hidden">
          <div className="p-6 overflow-y-auto">
            <ProblemStatementView
              title={question.title}
              difficulty={question.difficulty}
              topic={question.topic}
              maxMarks={question.maxMarks}
              timeLimitSeconds={question.timeLimitSeconds}
              memoryLimitMb={question.memoryLimitMb}
              description={question.description}
              examples={question.examples}
              constraints={question.constraints}
              sampleInput={question.sampleInput}
              sampleOutput={question.sampleOutput}
              inputFormat={question.inputFormat}
              outputFormat={question.outputFormat}
            />
          </div>
        </div>

        {/* Right Panel - Editor, Controls & Results Panel Below Editor */}
        <div className="w-[58%] flex flex-col bg-gray-50 overflow-hidden">
          {/* Editor Header */}
          <div className="h-12 px-4 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-bold text-gray-500 uppercase">
                Language
              </label>
              <select
                value={languages[activeQIndex] || "Python"}
                disabled={isExpired}
                onChange={(e) => handleLanguageSelectChange(e.target.value)}
                className="bg-white border border-gray-300 text-xs font-semibold rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500"
              >
                {enabledLangs.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              {question.functionConfig && (
                <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                  {question.functionConfig.className}.
                  {question.functionConfig.methodName}()
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={isExpired}
                onClick={() => {
                  const starter = getStarterForQuestion(
                    question,
                    languages[activeQIndex]
                  );
                  updateCode(starter);
                }}
                className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2.5 py-1.5 hover:bg-gray-100 rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset to Starter Code
              </button>
            </div>
          </div>

          {/* Language Switch Warning Banner */}
          {pendingLanguageChange && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
              <span>
                Switch language to <strong>{pendingLanguageChange}</strong> and
                load its starter template?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingLanguageChange(null)}
                  className="px-2.5 py-1 bg-white border border-amber-300 rounded font-medium hover:bg-amber-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyLanguageSwitch(pendingLanguageChange, false)
                  }
                  className="px-2.5 py-1 bg-amber-600 text-white rounded font-semibold hover:bg-amber-700"
                >
                  Switch Language
                </button>
              </div>
            </div>
          )}

          {/* 5. Code Editor (Monaco) */}
          <div className="flex-1 bg-white relative font-mono text-sm leading-relaxed overflow-hidden border-b border-gray-200 min-h-[240px]">
            <Editor
              height="100%"
              language={
                languages[activeQIndex] === "C++"
                  ? "cpp"
                  : (languages[activeQIndex] || "python").toLowerCase()
              }
              value={codes[activeQIndex] || ""}
              onChange={(value) => updateCode(value || "")}
              onMount={handleEditorDidMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 14 },
                scrollBeyondLastLine: false,
                roundedSelection: false,
                readOnly: isExpired,
              }}
            />
          </div>

          {/* 6 & 7. Run/Submit Controls + Results Panel Below Editor */}
          <div className="h-72 flex flex-col bg-white shrink-0">
            {/* Console Sub-Header with Tabs & Run / Submit Buttons */}
            <div className="h-11 px-4 flex items-center justify-between bg-slate-50 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBottomTab("testcase")}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    bottomTab === "testcase"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Testcase Input
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab("result")}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    bottomTab === "result"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Test Result
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleRun}
                  disabled={isRunning || isSubmitting || isExpired}
                  data-testid="run-code-btn"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 transition-colors border border-slate-300 rounded-md disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  {isRunning ? "Running..." : "Run Code"}
                </button>
                <button
                  onClick={handleSubmitSolution}
                  disabled={isSubmitting || isRunning || isExpired}
                  data-testid="submit-code-btn"
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors rounded-md shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? "Evaluating..." : "Submit Code"}
                </button>
              </div>
            </div>

            {/* Bottom Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {bottomTab === "testcase" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.isArray(question.examples) &&
                      question.examples.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setUseCustomInput(false);
                            setSelectedExampleIdx(idx);
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded border ${
                            !useCustomInput && selectedExampleIdx === idx
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Case {idx + 1}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setUseCustomInput(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded border ${
                        useCustomInput
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Custom Input
                    </button>
                  </div>

                  {!useCustomInput &&
                  Array.isArray(question.examples) &&
                  question.examples[selectedExampleIdx] ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Input:
                        </span>
                        <div className="bg-white border border-slate-200 rounded p-2 text-slate-900">
                          {question.examples[selectedExampleIdx].input}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">
                          Expected Output:
                        </span>
                        <div className="bg-white border border-slate-200 rounded p-2 text-slate-900">
                          {question.examples[selectedExampleIdx].output}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Custom Arguments (e.g.{" "}
                        <code>nums = [2, 7, 11, 15], target = 9</code>)
                      </label>
                      <textarea
                        rows={4}
                        value={customInput}
                        disabled={isExpired}
                        onChange={(e) => setCustomInput(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-blue-500"
                        placeholder="Enter test arguments here..."
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3" data-testid="compiler-results-panel">
                  {isRunning || isSubmitting ? (
                    <div className="text-xs text-slate-500 font-medium py-6 text-center">
                      Executing and evaluating your code against test cases...
                    </div>
                  ) : currentEval ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          {currentEval.status === "Accepted" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`text-sm font-bold ${
                              currentEval.status === "Accepted"
                                ? "text-emerald-700"
                                : currentEval.status === "Partially Accepted"
                                ? "text-amber-700"
                                : "text-red-700"
                            }`}
                          >
                            {currentEval.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-600">
                          <span>
                            Passed:{" "}
                            <strong>
                              {currentEval.passedCount}/{currentEval.totalCount}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Failed: <strong>{currentEval.failedCount}</strong>
                          </span>
                          {currentEval.mode === "submit" && (
                            <>
                              <span>·</span>
                              <span className="text-blue-700 font-bold">
                                Score: {currentEval.score}/
                                {currentEval.maxMarks}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {currentEval.compileError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs font-mono text-red-800 whitespace-pre-wrap">
                          <div className="font-bold mb-1">
                            Compilation Error:
                          </div>
                          {currentEval.compileError}
                        </div>
                      )}

                      {currentEval.runtimeError &&
                        !currentEval.compileError && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs font-mono text-red-800 whitespace-pre-wrap">
                            <div className="font-bold mb-1">Runtime Error:</div>
                            {currentEval.runtimeError}
                          </div>
                        )}

                      {Array.isArray(currentEval.caseResults) &&
                        currentEval.caseResults.length > 0 && (
                          <div className="space-y-2">
                            {currentEval.caseResults.map(
                              (cr: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-800">
                                      {cr.visibility === "private"
                                        ? `Test Case ${cr.caseNumber}: Private Evaluation Case`
                                        : `Test Case ${cr.caseNumber}: ${cr.name}`}
                                    </span>
                                    <span
                                      className={`font-mono font-bold ${
                                        cr.passed
                                          ? "text-emerald-700"
                                          : "text-red-700"
                                      }`}
                                    >
                                      {cr.passed ? "PASSED" : cr.status}
                                    </span>
                                  </div>
                                  {cr.visibility === "public" && (
                                    <div className="font-mono text-[11px] text-slate-700 space-y-1 pt-1 border-t border-slate-200/70">
                                      {cr.input !== undefined && (
                                        <div>
                                          <span className="text-slate-500">
                                            Input:{" "}
                                          </span>
                                          {cr.input}
                                        </div>
                                      )}
                                      {cr.expectedOutput !== undefined && (
                                        <div>
                                          <span className="text-slate-500">
                                            Expected:{" "}
                                          </span>
                                          {cr.expectedOutput}
                                        </div>
                                      )}
                                      {cr.actualOutput !== undefined && (
                                        <div>
                                          <span className="text-slate-500">
                                            Output:{" "}
                                          </span>
                                          {cr.actualOutput}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  ) : (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-slate-700">
                      {output ||
                        "Click 'Run Code' to test with sample inputs, or 'Submit Code' to evaluate against all test cases."}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Finish & Submit Assessment?
            </h2>
            <p className="text-gray-600 mb-4 text-sm">
              Are you sure you want to finalize your assessment? Your latest
              code for all questions will be evaluated and recorded on the
              server:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs space-y-1.5">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    Q{i + 1}: {q.title}
                  </span>
                  <span className="font-mono text-slate-500">
                    {languages[i] || "Python"}
                  </span>
                </div>
              ))}
            </div>
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