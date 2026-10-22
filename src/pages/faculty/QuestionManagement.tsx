import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../../lib/api.ts";
import ProblemStatementView from "../../lib/ProblemStatementView.tsx";
import {
  SUPPORTED_DSA_TYPES,
  SUPPORTED_LANGUAGES,
  SupportedDsaType,
  FunctionConfig,
  ParameterConfig,
  QuestionExample,
  TestCaseRecord,
  generateStarterCodeForLanguage,
  generateAllStarterCodes,
  validateFunctionConfig,
  normalizeTestCaseInputToJson,
  validateExpectedOutput,
  formatArgsForDisplay,
} from "../../lib/leetcodeHarness.js";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  AlertCircle,
  Code,
  RefreshCw,
  Edit3,
  Archive,
  Send,
  Save,
  X,
  Search,
  ShieldCheck,
} from "lucide-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DEFAULT_FUNCTION_CONFIG: FunctionConfig = {
  className: "Solution",
  methodName: "solve",
  returnType: "int[]",
  parameters: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  visibility: "public",
  isStatic: false,
  enabledLanguages: ["Java", "C++", "Python", "C", "JavaScript"],
};

export default function QuestionManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTestIdParam = searchParams.get("testId");
  const initialCreateParam = searchParams.get("create");
  const initialEditIdParam = searchParams.get("editId");

  const [tests, setTests] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for list view
  const [filterTestId, setFilterTestId] = useState<string>(
    initialTestIdParam || "all"
  );
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Mode: "list" | "editor"
  const [viewMode, setViewMode] = useState<"list" | "editor">(
    initialCreateParam === "1" || initialEditIdParam ? "editor" : "list"
  );
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(
    initialEditIdParam ? Number(initialEditIdParam) : null
  );

  // Feedback & validation states
  const [bannerMessage, setBannerMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================================================
  // Multi-Section Question Editor State
  // ==========================================================================
  // Section A — Basic Information
  const [selectedTestId, setSelectedTestId] = useState<number | "">(
    initialTestIdParam ? Number(initialTestIdParam) : ""
  );
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "easy"
  );
  const [topic, setTopic] = useState("Arrays & Hashing");
  const [maxMarks, setMaxMarks] = useState<number>(50);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(2.0);
  const [memoryLimitMb, setMemoryLimitMb] = useState<number>(128);
  const [publicationStatus, setPublicationStatus] = useState<
    "draft" | "published" | "archived"
  >("draft");

  // Section B — Examples
  const [examples, setExamples] = useState<QuestionExample[]>([
    {
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]",
      explanation: "nums[0] + nums[1] = 2 + 7 = 9.",
    },
  ]);

  // Section C — Constraints
  const [constraints, setConstraints] = useState(
    "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9"
  );

  // Section D — Class and Method Configuration
  const [functionConfig, setFunctionConfig] = useState<FunctionConfig>(
    DEFAULT_FUNCTION_CONFIG
  );
  const [starterCodeMap, setStarterCodeMap] = useState<Record<string, string>>(
    () => generateAllStarterCodes(DEFAULT_FUNCTION_CONFIG)
  );
  const [customizedLanguages, setCustomizedLanguages] = useState<
    Record<string, boolean>
  >({});
  const [activeStarterLang, setActiveStarterLang] = useState<string>("Java");

  // Section E — Evaluation Test Cases
  const [testCases, setTestCases] = useState<TestCaseRecord[]>([
    {
      name: "Case 1",
      inputArgs: JSON.stringify({ args: [[2, 7, 11, 15], 9] }),
      expectedOutput: "[0,1]",
      visibility: "public",
      enabled: true,
      isEssential: false,
      orderIndex: 0,
    },
    {
      name: "Case 2",
      inputArgs: JSON.stringify({ args: [[3, 2, 4], 6] }),
      expectedOutput: "[1,2]",
      visibility: "private",
      enabled: true,
      isEssential: true,
      orderIndex: 1,
    },
  ]);

  // Test Case Modal / Inline Form State
  const [editingCaseIndex, setEditingCaseIndex] = useState<number | null>(null);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [caseForm, setCaseForm] = useState<{
    name: string;
    paramValues: string[];
    rawJsonMode: boolean;
    inputArgs: string;
    expectedOutput: string;
    visibility: "public" | "private";
    enabled: boolean;
    isEssential: boolean;
  }>({
    name: "Case 3",
    paramValues: ["[3, 3]", "6"],
    rawJsonMode: false,
    inputArgs: JSON.stringify({ args: [[3, 3], 6] }),
    expectedOutput: "[0,1]",
    visibility: "private",
    enabled: true,
    isEssential: true,
  });
  const [previewingCase, setPreviewingCase] = useState<TestCaseRecord | null>(
    null
  );

  // Preview as Student Modal State
  const [showStudentPreview, setShowStudentPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState<string>("Java");
  const [previewCode, setPreviewCode] = useState<string>("");

  const fetchTestsAndQuestions = async () => {
    setLoading(true);
    try {
      const [testsRes, questionsRes] = await Promise.all([
        api.get("/faculty/tests"),
        api.get("/faculty/questions"),
      ]);
      const testList = Array.isArray(testsRes.data) ? testsRes.data : [];
      setTests(testList);
      setQuestionsList(Array.isArray(questionsRes.data) ? questionsRes.data : []);

      if (!selectedTestId && testList.length > 0) {
        setSelectedTestId(
          initialTestIdParam ? Number(initialTestIdParam) : testList[0].id
        );
      }
    } catch (err) {
      console.error("Error loading tests/questions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestsAndQuestions();
  }, []);

  useEffect(() => {
    if (initialEditIdParam) {
      handleOpenEditQuestion(Number(initialEditIdParam));
    } else if (initialCreateParam === "1") {
      handleStartNewQuestion(
        initialTestIdParam ? Number(initialTestIdParam) : undefined
      );
    }
  }, [initialEditIdParam, initialCreateParam]);

  // Keep non-customized starter codes synced when functionConfig changes
  const syncStarterCodesWithConfig = (
    nextConfig: FunctionConfig,
    forceResetAll = false
  ) => {
    const sigValidation = validateFunctionConfig(nextConfig);
    if (!sigValidation.valid) return;

    const generated = generateAllStarterCodes(nextConfig);
    if (forceResetAll) {
      setStarterCodeMap(generated);
      setCustomizedLanguages({});
      return;
    }

    setStarterCodeMap((prev) => {
      const updated = { ...prev };
      for (const lang of SUPPORTED_LANGUAGES) {
        if (!customizedLanguages[lang] || !updated[lang]) {
          updated[lang] = generated[lang] || "";
        }
      }
      return updated;
    });
  };

  const handleStartNewQuestion = (defaultTestId?: number) => {
    setEditingQuestionId(null);
    setFieldErrors({});
    setBannerMessage(null);
    const targetTest =
      defaultTestId ||
      (filterTestId !== "all" ? Number(filterTestId) : tests[0]?.id || "");
    setSelectedTestId(targetTest);
    setTitle("");
    setSlug("");
    setSlugManuallyEdited(false);
    setDescription("");
    setDifficulty("easy");
    setTopic("Arrays & Hashing");
    setMaxMarks(50);
    setTimeLimitSeconds(2.0);
    setMemoryLimitMb(128);
    setPublicationStatus("draft");
    setExamples([
      {
        input: "",
        output: "",
        explanation: "",
      },
    ]);
    setConstraints("");
    const initialFn: FunctionConfig = {
      className: "Solution",
      methodName: "solve",
      returnType: "int[]",
      parameters: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
      visibility: "public",
      isStatic: false,
      enabledLanguages: ["Java", "C++", "Python", "C", "JavaScript"],
    };
    setFunctionConfig(initialFn);
    setCustomizedLanguages({});
    setStarterCodeMap(generateAllStarterCodes(initialFn));
    setActiveStarterLang("Java");
    setTestCases([]);
    setShowCaseForm(false);
    setEditingCaseIndex(null);
    setViewMode("editor");
  };

  const handleOpenEditQuestion = async (questionId: number) => {
    setFieldErrors({});
    setBannerMessage(null);
    try {
      const res = await api.get(`/faculty/questions/${questionId}`);
      const q = res.data;
      setEditingQuestionId(q.id);
      setSelectedTestId(q.testId);
      setTitle(q.title || "");
      setSlug(q.slug || slugify(q.title || ""));
      setSlugManuallyEdited(Boolean(q.slug));
      setDescription(q.description || "");
      setDifficulty(q.difficulty || "medium");
      setTopic(q.topic || "Algorithms");
      setMaxMarks(q.maxMarks ?? 50);
      setTimeLimitSeconds(q.timeLimitSeconds ?? 2.0);
      setMemoryLimitMb(q.memoryLimitMb ?? 128);
      setPublicationStatus(q.status || "published");
      setConstraints(q.constraints || "");

      const loadedExamples =
        Array.isArray(q.examples) && q.examples.length > 0
          ? q.examples
          : q.sampleInput || q.sampleOutput
          ? [
              {
                input: q.sampleInput || "",
                output: q.sampleOutput || "",
                explanation: "",
              },
            ]
          : [{ input: "", output: "", explanation: "" }];
      setExamples(loadedExamples);

      const loadedFn: FunctionConfig = q.functionConfig || {
        className: "Solution",
        methodName: "solve",
        returnType: "int",
        parameters: [{ name: "nums", type: "int[]" }],
        visibility: "public",
        isStatic: false,
        enabledLanguages: ["Java", "C++", "Python", "C", "JavaScript"],
      };
      setFunctionConfig(loadedFn);

      const generated = generateAllStarterCodes(loadedFn);
      const savedStarter =
        q.starterCode && typeof q.starterCode === "object" ? q.starterCode : {};
      setStarterCodeMap({ ...generated, ...savedStarter });
      setCustomizedLanguages({});
      setTestCases(Array.isArray(q.testCases) ? q.testCases : []);
      setShowCaseForm(false);
      setEditingCaseIndex(null);
      setViewMode("editor");
    } catch (err: any) {
      setBannerMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Failed to load question details for editing.",
      });
    }
  };

  // ==========================================================================
  // Section B — Examples Handlers
  // ==========================================================================
  const handleAddExample = () => {
    setExamples((prev) => [
      ...prev,
      { input: "", output: "", explanation: "" },
    ]);
  };

  const handleUpdateExample = (
    idx: number,
    field: keyof QuestionExample,
    value: string
  ) => {
    setExamples((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex))
    );
  };

  const handleMoveExample = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= examples.length) return;
    const copy = [...examples];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setExamples(copy);
  };

  const handleDeleteExample = (idx: number) => {
    setExamples((prev) => prev.filter((_, i) => i !== idx));
  };

  // ==========================================================================
  // Section D — Class & Method Configuration Handlers
  // ==========================================================================
  const updateFunctionConfigField = <K extends keyof FunctionConfig>(
    key: K,
    value: FunctionConfig[K]
  ) => {
    const next = { ...functionConfig, [key]: value };
    setFunctionConfig(next);
    syncStarterCodesWithConfig(next, false);
  };

  const handleAddParameter = () => {
    const nextIdx = functionConfig.parameters.length + 1;
    const nextParams: ParameterConfig[] = [
      ...functionConfig.parameters,
      { name: `param${nextIdx}`, type: "int" },
    ];
    updateFunctionConfigField("parameters", nextParams);
  };

  const handleUpdateParameter = (
    idx: number,
    field: keyof ParameterConfig,
    value: string
  ) => {
    const nextParams = functionConfig.parameters.map((p, i) =>
      i === idx ? { ...p, [field]: value as any } : p
    );
    updateFunctionConfigField("parameters", nextParams);
  };

  const handleRemoveParameter = (idx: number) => {
    const nextParams = functionConfig.parameters.filter((_, i) => i !== idx);
    updateFunctionConfigField("parameters", nextParams);
  };

  const handleToggleLanguage = (lang: string) => {
    const current = functionConfig.enabledLanguages || [
      "Java",
      "C++",
      "Python",
      "C",
    ];
    const exists = current.includes(lang);
    if (exists && current.length <= 1) return; // Keep at least 1 language enabled
    const nextLangs = exists
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    updateFunctionConfigField("enabledLanguages", nextLangs);
  };

  // ==========================================================================
  // Section E — Evaluation Test Cases Handlers
  // ==========================================================================
  const openAddTestCaseForm = () => {
    setEditingCaseIndex(null);
    const defaultParamVals = functionConfig.parameters.map((p) =>
      p.type.includes("[][]")
        ? "[[1, 2], [3, 4]]"
        : p.type.includes("[]")
        ? "[2, 7, 11, 15]"
        : p.type === "String"
        ? '"hello"'
        : p.type === "boolean"
        ? "true"
        : "9"
    );
    let initialJson = "";
    try {
      const parsedArgs = defaultParamVals.map((v) => JSON.parse(v));
      initialJson = JSON.stringify({ args: parsedArgs });
    } catch {
      initialJson = JSON.stringify({ args: [] });
    }

    setCaseForm({
      name: `Case ${testCases.length + 1}`,
      paramValues: defaultParamVals,
      rawJsonMode: false,
      inputArgs: initialJson,
      expectedOutput: functionConfig.returnType.includes("[]") ? "[0, 1]" : "0",
      visibility: testCases.length === 0 ? "public" : "private",
      enabled: true,
      isEssential: testCases.length > 0,
    });
    setShowCaseForm(true);
  };

  const openEditTestCaseForm = (idx: number) => {
    const tc = testCases[idx];
    const norm = normalizeTestCaseInputToJson(
      tc.inputArgs,
      functionConfig.parameters
    );
    const paramValues = norm.valid
      ? norm.args.map((a) => JSON.stringify(a))
      : functionConfig.parameters.map(() => "");

    setEditingCaseIndex(idx);
    setCaseForm({
      name: tc.name,
      paramValues,
      rawJsonMode: !norm.valid,
      inputArgs: norm.valid ? norm.json : tc.inputArgs,
      expectedOutput: tc.expectedOutput,
      visibility: tc.visibility,
      enabled: tc.enabled,
      isEssential: Boolean(tc.isEssential),
    });
    setShowCaseForm(true);
  };

  const handleSaveTestCaseModal = () => {
    const errors: Record<string, string> = {};
    const trimmedName = caseForm.name.trim();
    if (!trimmedName) {
      errors.caseModalName = "Test case identifier is required.";
    } else if (
      testCases.some(
        (tc, i) =>
          i !== editingCaseIndex &&
          tc.name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      errors.caseModalName = `Duplicate test case identifier "${trimmedName}".`;
    }

    let rawInputToValidate = caseForm.inputArgs;
    if (!caseForm.rawJsonMode) {
      const assignmentParts = functionConfig.parameters.map(
        (p, i) => `${p.name} = ${caseForm.paramValues[i] ?? ""}`
      );
      rawInputToValidate = assignmentParts.join(", ");
    }

    const normIn = normalizeTestCaseInputToJson(
      rawInputToValidate,
      functionConfig.parameters
    );
    if (!normIn.valid) {
      errors.caseModalInput = normIn.error || "Invalid input arguments.";
    }

    const normOut = validateExpectedOutput(
      caseForm.expectedOutput,
      functionConfig.returnType
    );
    if (!normOut.valid) {
      errors.caseModalOutput = normOut.error || "Invalid expected output.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      return;
    }

    // Clear modal errors
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.caseModalName;
      delete next.caseModalInput;
      delete next.caseModalOutput;
      return next;
    });

    const newRecord: TestCaseRecord = {
      name: trimmedName,
      inputArgs: normIn.json,
      expectedOutput: normOut.normalized,
      visibility: caseForm.visibility,
      enabled: caseForm.enabled,
      isEssential:
        caseForm.visibility === "private" ? caseForm.isEssential : false,
      orderIndex:
        editingCaseIndex !== null ? editingCaseIndex : testCases.length,
    };

    if (editingCaseIndex !== null) {
      setTestCases((prev) =>
        prev.map((tc, i) => (i === editingCaseIndex ? newRecord : tc))
      );
    } else {
      setTestCases((prev) => [...prev, newRecord]);
    }
    setShowCaseForm(false);
    setEditingCaseIndex(null);
  };

  const handleDuplicateTestCase = (idx: number) => {
    const source = testCases[idx];
    let copyName = `${source.name} (Copy)`;
    let counter = 2;
    while (
      testCases.some((tc) => tc.name.toLowerCase() === copyName.toLowerCase())
    ) {
      copyName = `${source.name} (Copy ${counter++})`;
    }
    const duplicated: TestCaseRecord = {
      ...source,
      id: undefined,
      name: copyName,
      orderIndex: testCases.length,
    };
    setTestCases((prev) => [...prev, duplicated]);
  };

  const handleMoveTestCase = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= testCases.length) return;
    const copy = [...testCases];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setTestCases(copy.map((tc, i) => ({ ...tc, orderIndex: i })));
  };

  const handleDeleteTestCase = (idx: number) => {
    setTestCases((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((tc, i) => ({ ...tc, orderIndex: i }))
    );
  };

  const handleValidateAllTestCases = async () => {
    setBannerMessage(null);
    setFieldErrors({});
    try {
      const res = await api.post("/faculty/questions/validate", {
        functionConfig,
        starterCode: starterCodeMap,
        testCases,
      });
      if (res.data.valid) {
        setBannerMessage({
          type: "success",
          text: `Validation passed: Method signature, starter codes, and ${testCases.length} test case(s) are valid.`,
        });
      } else {
        setFieldErrors(res.data.errors || {});
        setBannerMessage({
          type: "error",
          text: "Some configuration or test case fields have validation errors.",
        });
      }
    } catch (err: any) {
      const errs = err.response?.data?.errors || {};
      setFieldErrors(errs);
      setBannerMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Validation failed. Check highlighted fields.",
      });
    }
  };

  // ==========================================================================
  // Save / Publish / Archive Question Handlers
  // ==========================================================================
  const handlePersistQuestion = async (
    targetStatus: "draft" | "published" | "archived"
  ) => {
    setFieldErrors({});
    setBannerMessage(null);

    const localErrors: Record<string, string> = {};
    if (!selectedTestId) {
      localErrors.testId = "Please select an assessment / test.";
    }
    if (!title.trim()) {
      localErrors.title = "Question title is required.";
    }
    if (!description.trim()) {
      localErrors.description = "Problem description is required.";
    }

    const sigCheck = validateFunctionConfig(functionConfig);
    if (!sigCheck.valid) {
      Object.assign(localErrors, sigCheck.errors);
    }

    const cleanedExamples = examples.filter(
      (ex) => ex.input.trim() !== "" || ex.output.trim() !== ""
    );

    if (targetStatus === "published") {
      if (cleanedExamples.length === 0) {
        localErrors.examples =
          "At least one example with Input and Output is required before publishing.";
      }
      const enabledCases = testCases.filter((tc) => tc.enabled !== false);
      if (enabledCases.length === 0) {
        localErrors.testCases =
          "At least one enabled evaluation test case is required before publishing.";
      }
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setBannerMessage({
        type: "error",
        text:
          Object.values(localErrors)[0] ||
          "Please fix the highlighted validation errors before saving.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        testId: Number(selectedTestId),
        title: title.trim(),
        slug: slug.trim() || slugify(title),
        description: description.trim(),
        difficulty,
        topic: topic.trim() || "Algorithms",
        maxMarks: Number(maxMarks) || 50,
        timeLimitSeconds: Number(timeLimitSeconds) || 2.0,
        memoryLimitMb: Number(memoryLimitMb) || 128,
        status: targetStatus,
        constraints: constraints.trim(),
        examples: cleanedExamples,
        functionConfig,
        starterCode: starterCodeMap,
        testCases,
      };

      let savedQuestion: any;
      if (editingQuestionId) {
        const res = await api.put(
          `/faculty/questions/${editingQuestionId}`,
          payload
        );
        savedQuestion = res.data.question;
      } else {
        const res = await api.post("/faculty/questions", payload);
        savedQuestion = res.data.question;
        setEditingQuestionId(savedQuestion.id);
      }

      setPublicationStatus(savedQuestion.status || targetStatus);
      setSlug(savedQuestion.slug || payload.slug);
      if (Array.isArray(savedQuestion.testCases)) {
        setTestCases(savedQuestion.testCases);
      }

      setBannerMessage({
        type: "success",
        text:
          targetStatus === "published"
            ? `Question "${savedQuestion.title}" saved and published! Students can immediately access it in the compiler.`
            : targetStatus === "archived"
            ? `Question "${savedQuestion.title}" archived.`
            : `Draft "${savedQuestion.title}" saved successfully.`,
      });

      await fetchTestsAndQuestions();
    } catch (err: any) {
      const apiErrors = err.response?.data?.errors || {};
      setFieldErrors(apiErrors);
      setBannerMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Database save failed. Your unsaved changes have been preserved.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusChange = async (
    questionId: number,
    nextStatus: "draft" | "published" | "archived"
  ) => {
    setBannerMessage(null);
    try {
      await api.patch(`/faculty/questions/${questionId}/status`, {
        status: nextStatus,
      });
      setBannerMessage({
        type: "success",
        text: `Question status updated to ${nextStatus.toUpperCase()}.`,
      });
      await fetchTestsAndQuestions();
    } catch (err: any) {
      setBannerMessage({
        type: "error",
        text:
          err.response?.data?.message ||
          "Unable to change status. Open the question editor to complete required configuration.",
      });
    }
  };

  const handleDeleteFromList = async (questionId: number) => {
    setBannerMessage(null);
    try {
      const res = await api.delete(`/faculty/questions/${questionId}`);
      setBannerMessage({
        type: "success",
        text: res.data?.message || "Question removed.",
      });
      await fetchTestsAndQuestions();
    } catch (err: any) {
      setBannerMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to delete question.",
      });
    }
  };

  const openStudentPreview = () => {
    const enabledLangs =
      functionConfig.enabledLanguages &&
      functionConfig.enabledLanguages.length > 0
        ? functionConfig.enabledLanguages
        : ["Java", "C++", "Python", "C"];
    const firstLang = enabledLangs[0] || "Java";
    setPreviewLang(firstLang);
    setPreviewCode(
      starterCodeMap[firstLang] ||
        generateStarterCodeForLanguage(functionConfig, firstLang)
    );
    setShowStudentPreview(true);
  };

  const filteredQuestions = questionsList.filter((q) => {
    if (filterTestId !== "all" && q.testId !== Number(filterTestId)) {
      return false;
    }
    if (filterStatus !== "all" && (q.status || "published") !== filterStatus) {
      return false;
    }
    if (filterDifficulty !== "all" && q.difficulty !== filterDifficulty) {
      return false;
    }
    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      return (
        (q.title || "").toLowerCase().includes(s) ||
        (q.slug || "").toLowerCase().includes(s) ||
        (q.topic || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  // ==========================================================================
  // Render List Mode vs Editor Mode
  // ==========================================================================
  return (
    <div className="space-y-6">
      {/* Page Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {viewMode === "editor"
              ? editingQuestionId
                ? `Edit Question: ${title || "Untitled"}`
                : "Create LeetCode-Style Question"
              : "Question Bank & LeetCode Problem Manager"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {viewMode === "editor"
              ? "Configure problem statement, examples, constraints, class/method signature, per-language starter code, and evaluation test cases."
              : "Create, preview, validate, and publish function-based coding questions across assessments."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {viewMode === "editor" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  setSearchParams({});
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Back to Question Bank
              </button>
              <button
                type="button"
                onClick={openStudentPreview}
                data-testid="preview-as-student-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <Eye className="w-4 h-4" /> Preview as Student
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersistQuestion("draft")}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersistQuestion("published")}
                data-testid="publish-question-btn"
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Send className="w-4 h-4" />{" "}
                {editingQuestionId && publicationStatus === "published"
                  ? "Save & Republish"
                  : "Publish Question"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleStartNewQuestion()}
              data-testid="create-new-question-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Create New Question
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg border flex items-center justify-between text-xs font-medium ${
            bannerMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-slate-500 hover:text-slate-800 font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LIST MODE: Question Bank Table */}
      {/* ==================================================================== */}
      {viewMode === "list" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, slug, or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filterTestId}
                onChange={(e) => setFilterTestId(e.target.value)}
                className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="all">All Assessments</option>
                {tests.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.title}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Question & Slug
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Assessment
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Method Signature
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Test Cases
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-slate-500"
                    >
                      Loading questions...
                    </td>
                  </tr>
                ) : filteredQuestions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-sm text-slate-500"
                    >
                      No questions match your filter. Click{" "}
                      <strong>Create New Question</strong> to add a
                      LeetCode-style programming problem.
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((q) => {
                    const fn: FunctionConfig | null = q.functionConfig;
                    const sigDisplay = fn
                      ? `${fn.className}.${fn.methodName}(${(
                          fn.parameters || []
                        )
                          .map((p) => `${p.type} ${p.name}`)
                          .join(", ")}) -> ${fn.returnType}`
                      : "Stdin / Stdout";
                    const st = q.status || "published";

                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900 text-sm">
                            {q.title}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">{q.slug || "-"}</span>
                            <span>·</span>
                            <span
                              className={`font-semibold ${
                                q.difficulty === "easy"
                                  ? "text-emerald-700"
                                  : q.difficulty === "hard"
                                  ? "text-red-700"
                                  : "text-amber-700"
                              }`}
                            >
                              {(q.difficulty || "medium").toUpperCase()}
                            </span>
                            <span>·</span>
                            <span>{q.topic || "Algorithms"}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">
                              {q.maxMarks ?? 50} pts
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-700">
                          {q.testTitle}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-slate-700">
                          {sigDisplay}
                        </td>
                        <td className="px-5 py-4 text-xs font-mono tabular-nums text-slate-700">
                          {q.totalTestCasesCount || 0} total (
                          {q.publicTestCasesCount || 0} public ·{" "}
                          {q.privateTestCasesCount || 0} private)
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold">
                          <span
                            className={
                              st === "published"
                                ? "text-emerald-700"
                                : st === "archived"
                                ? "text-slate-500"
                                : "text-amber-700"
                            }
                          >
                            {st.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-xs font-medium whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditQuestion(q.id)}
                              className="px-2.5 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md inline-flex items-center gap-1"
                              title="Edit Question"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Edit
                            </button>
                            {st !== "published" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickStatusChange(q.id, "published")
                                }
                                className="px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md"
                              >
                                Publish
                              </button>
                            )}
                            {st !== "archived" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickStatusChange(q.id, "archived")
                                }
                                className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md"
                                title="Archive"
                              >
                                Archive
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteFromList(q.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EDITOR MODE: 5-Section LeetCode Question Editor */}
      {/* ==================================================================== */}
      {viewMode === "editor" && (
        <div className="space-y-8 pb-12">
          {/* SECTION A: Basic Information */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  01. Basic Information
                </h3>
                <p className="text-xs text-slate-500">
                  Core metadata, Markdown problem statement, execution limits,
                  and publication status.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Status: <strong>{publicationStatus.toUpperCase()}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Assessment / Test *
                </label>
                <select
                  value={selectedTestId}
                  onChange={(e) => setSelectedTestId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Select Assessment...</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status.toUpperCase()})
                    </option>
                  ))}
                </select>
                {fieldErrors.testId && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.testId}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Question Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTitle(val);
                    if (!slugManuallyEdited) {
                      setSlug(slugify(val));
                    }
                  }}
                  placeholder="e.g. Two Sum"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {fieldErrors.title && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unique Slug *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="e.g. two-sum"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {fieldErrors.slug && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.slug}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Topic / Category
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Arrays, Hash Table, Two Pointers"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Maximum Marks
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                />
                {fieldErrors.maxMarks && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.maxMarks}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time Limit (sec)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={30}
                  value={timeLimitSeconds}
                  onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Memory Limit (MB)
                </label>
                <input
                  type="number"
                  min={16}
                  max={2048}
                  value={memoryLimitMb}
                  onChange={(e) => setMemoryLimitMb(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Problem Description (Markdown Supported) *
                </label>
                <span className="text-[11px] text-slate-400">
                  Supports **bold**, `inline code`, ```code blocks```, and
                  bullet lists
                </span>
              </div>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Given an array of integers `nums` and an integer `target`, return the indices of the two numbers whose sum equals the target.&#10;&#10;Assume exactly one valid answer exists. You may not use the same element twice."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {fieldErrors.description && (
                <p className="text-xs text-red-600 mt-1">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </section>

          {/* SECTION B: Examples */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  02. Examples
                </h3>
                <p className="text-xs text-slate-500">
                  Sample input/output cases displayed in the problem description
                  for students. Numbering updates automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddExample}
                data-testid="add-example-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Example
              </button>
            </div>

            {fieldErrors.examples && (
              <p className="text-xs text-red-600">{fieldErrors.examples}</p>
            )}

            {examples.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                No examples added yet. Click <strong>Add Example</strong> to add
                Example 1.
              </div>
            ) : (
              <div className="space-y-4">
                {examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Example {idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveExample(idx, -1)}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === examples.length - 1}
                          onClick={() => handleMoveExample(idx, 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExample(idx)}
                          className="p-1 text-red-600 hover:text-red-800 ml-1"
                          title="Delete Example"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Input *
                        </label>
                        <input
                          type="text"
                          value={ex.input}
                          onChange={(e) =>
                            handleUpdateExample(idx, "input", e.target.value)
                          }
                          placeholder="nums = [2,7,11,15], target = 9"
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                        />
                        {fieldErrors[`example_${idx}_input`] && (
                          <p className="text-xs text-red-600 mt-1">
                            {fieldErrors[`example_${idx}_input`]}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Output *
                        </label>
                        <input
                          type="text"
                          value={ex.output}
                          onChange={(e) =>
                            handleUpdateExample(idx, "output", e.target.value)
                          }
                          placeholder="[0,1]"
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                        />
                        {fieldErrors[`example_${idx}_output`] && (
                          <p className="text-xs text-red-600 mt-1">
                            {fieldErrors[`example_${idx}_output`]}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Explanation (Optional)
                        </label>
                        <input
                          type="text"
                          value={ex.explanation || ""}
                          onChange={(e) =>
                            handleUpdateExample(
                              idx,
                              "explanation",
                              e.target.value
                            )
                          }
                          placeholder="nums[0] + nums[1] = 2 + 7 = 9."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION C: Constraints */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  03. Constraints
                </h3>
                <p className="text-xs text-slate-500">
                  Enter one constraint per line. Mathematical notation and
                  bounds are preserved as formatted text.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {["<=", ">=", "10^4", "10^5", "-10^9 <= x <= 10^9"].map(
                  (sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() =>
                        setConstraints((prev) =>
                          prev
                            ? `${prev}${prev.endsWith("\n") ? "" : " "}${sym}`
                            : sym
                        )
                      }
                      className="px-2 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200"
                    >
                      {sym}
                    </button>
                  )
                )}
              </div>
            </div>

            <textarea
              rows={4}
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="2 <= nums.length <= 10^4&#10;-10^9 <= nums[i] <= 10^9&#10;-10^9 <= target <= 10^9&#10;Exactly one valid answer exists."
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-lg leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </section>

          {/* SECTION D: Class and Method Configuration */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  04. Class and Method Configuration
                </h3>
                <p className="text-xs text-slate-500">
                  Configure the function signature used to generate per-language
                  starter code and server-side evaluation harnesses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => syncStarterCodesWithConfig(functionConfig, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate All Starter
                Codes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  value={functionConfig.className}
                  onChange={(e) =>
                    updateFunctionConfigField("className", e.target.value)
                  }
                  placeholder="Solution"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
                {fieldErrors.className && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.className}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Method / Function Name *
                </label>
                <input
                  type="text"
                  value={functionConfig.methodName}
                  onChange={(e) =>
                    updateFunctionConfigField("methodName", e.target.value)
                  }
                  placeholder="twoSum"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
                {fieldErrors.methodName && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.methodName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Type *
                </label>
                <select
                  value={functionConfig.returnType}
                  onChange={(e) =>
                    updateFunctionConfigField(
                      "returnType",
                      e.target.value as SupportedDsaType
                    )
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                >
                  {SUPPORTED_DSA_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {fieldErrors.returnType && (
                  <p className="text-xs text-red-600 mt-1">
                    {fieldErrors.returnType}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Visibility & Static
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={functionConfig.visibility || "public"}
                    onChange={(e) =>
                      updateFunctionConfigField(
                        "visibility",
                        e.target.value as any
                      )
                    }
                    className="flex-1 px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="public">public</option>
                    <option value="protected">protected</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 px-2 py-2 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(functionConfig.isStatic)}
                      onChange={(e) =>
                        updateFunctionConfigField("isStatic", e.target.checked)
                      }
                    />
                    <span>static</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Parameters Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Parameters ({functionConfig.parameters.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddParameter}
                  data-testid="add-parameter-btn"
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Parameter
                </button>
              </div>

              <div className="space-y-2">
                {functionConfig.parameters.map((param, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  >
                    <span className="text-xs font-mono text-slate-400 w-6">
                      #{idx + 1}
                    </span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) =>
                          handleUpdateParameter(idx, "name", e.target.value)
                        }
                        placeholder="Parameter name (e.g. nums)"
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                      />
                      {fieldErrors[`param_${idx}_name`] && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {fieldErrors[`param_${idx}_name`]}
                        </p>
                      )}
                    </div>
                    <div className="w-44">
                      <select
                        value={param.type}
                        onChange={(e) =>
                          handleUpdateParameter(idx, "type", e.target.value)
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                      >
                        {SUPPORTED_DSA_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveParameter(idx)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Remove Parameter"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Enabled Languages & Per-Language Starter Code */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Enabled Languages & Starter Code Templates
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isChecked = (
                      functionConfig.enabledLanguages || [
                        "Java",
                        "C++",
                        "Python",
                        "C",
                      ]
                    ).includes(lang);
                    return (
                      <label
                        key={lang}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLanguage(lang)}
                        />
                        <span>{lang}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {SUPPORTED_LANGUAGES.filter((l) =>
                      (
                        functionConfig.enabledLanguages || [
                          "Java",
                          "C++",
                          "Python",
                          "C",
                        ]
                      ).includes(l)
                    ).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setActiveStarterLang(lang)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                          activeStarterLang === lang
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateStarterCodeForLanguage(
                        functionConfig,
                        activeStarterLang
                      );
                      setStarterCodeMap((prev) => ({
                        ...prev,
                        [activeStarterLang]: generated,
                      }));
                      setCustomizedLanguages((prev) => ({
                        ...prev,
                        [activeStarterLang]: false,
                      }));
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset{" "}
                    {activeStarterLang} to Signature
                  </button>
                </div>

                <div className="h-56 bg-white">
                  <Editor
                    height="100%"
                    language={
                      activeStarterLang === "C++"
                        ? "cpp"
                        : activeStarterLang.toLowerCase()
                    }
                    value={starterCodeMap[activeStarterLang] || ""}
                    onChange={(val) => {
                      setStarterCodeMap((prev) => ({
                        ...prev,
                        [activeStarterLang]: val || "",
                      }));
                      setCustomizedLanguages((prev) => ({
                        ...prev,
                        [activeStarterLang]: true,
                      }));
                    }}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineHeight: 20,
                      scrollBeyondLastLine: false,
                      padding: { top: 12 },
                    }}
                  />
                </div>
              </div>
              {fieldErrors[`starter_${activeStarterLang}`] && (
                <p className="text-xs text-red-600">
                  {fieldErrors[`starter_${activeStarterLang}`]}
                </p>
              )}
            </div>
          </section>

          {/* SECTION E: Evaluation Test Cases */}
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  05. Evaluation Test Cases
                </h3>
                <p className="text-xs text-slate-500">
                  Manage public sample cases and hidden private evaluation cases.
                  Private test cases are never exposed to student APIs.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleValidateAllTestCases}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Validate Test Cases
                </button>
                <button
                  type="button"
                  onClick={openAddTestCaseForm}
                  data-testid="add-test-case-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Test Case
                </button>
              </div>
            </div>

            {fieldErrors.testCases && (
              <p className="text-xs text-red-600">{fieldErrors.testCases}</p>
            )}

            {/* Add / Edit Test Case Inline Form */}
            {showCaseForm && (
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {editingCaseIndex !== null
                      ? `Edit Test Case #${editingCaseIndex + 1}`
                      : "New Evaluation Test Case"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCaseForm(false);
                      setEditingCaseIndex(null);
                    }}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Case Identifier *
                    </label>
                    <input
                      type="text"
                      value={caseForm.name}
                      onChange={(e) =>
                        setCaseForm({ ...caseForm, name: e.target.value })
                      }
                      placeholder="Case 1"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    />
                    {fieldErrors.caseModalName && (
                      <p className="text-xs text-red-600 mt-1">
                        {fieldErrors.caseModalName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={caseForm.visibility}
                      onChange={(e) =>
                        setCaseForm({
                          ...caseForm,
                          visibility: e.target.value as "public" | "private",
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      <option value="public">
                        Public (Visible to Student)
                      </option>
                      <option value="private">
                        Private (Hidden Server Evaluation)
                      </option>
                    </select>
                  </div>

                  <div className="flex items-end gap-4 pb-1 md:col-span-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={caseForm.enabled}
                        onChange={(e) =>
                          setCaseForm({
                            ...caseForm,
                            enabled: e.target.checked,
                          })
                        }
                      />
                      <span>Enabled</span>
                    </label>

                    {caseForm.visibility === "private" && (
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={caseForm.isEssential}
                          onChange={(e) =>
                            setCaseForm({
                              ...caseForm,
                              isEssential: e.target.checked,
                            })
                          }
                        />
                        <span>Essential for Full Score</span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setCaseForm((prev) => ({
                          ...prev,
                          rawJsonMode: !prev.rawJsonMode,
                        }))
                      }
                      className="ml-auto text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      {caseForm.rawJsonMode
                        ? "Switch to Parameter Fields"
                        : 'Switch to Raw JSON {"args": [...]}'}
                    </button>
                  </div>
                </div>

                {!caseForm.rawJsonMode ? (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Input Arguments (by Parameter) *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {functionConfig.parameters.map((p, pIdx) => (
                        <div key={pIdx}>
                          <span className="block text-[11px] font-mono text-slate-600 mb-1">
                            {p.name} ({p.type})
                          </span>
                          <input
                            type="text"
                            value={caseForm.paramValues[pIdx] ?? ""}
                            onChange={(e) => {
                              const nextVals = [...caseForm.paramValues];
                              nextVals[pIdx] = e.target.value;
                              setCaseForm({
                                ...caseForm,
                                paramValues: nextVals,
                              });
                            }}
                            placeholder={
                              p.type.includes("[]") ? "[2, 7, 11, 15]" : "9"
                            }
                            className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Structured Input JSON (e.g.{" "}
                      <code>{`{"args": [[2, 7, 11, 15], 9]}`}</code>) *
                    </label>
                    <input
                      type="text"
                      value={caseForm.inputArgs}
                      onChange={(e) =>
                        setCaseForm({ ...caseForm, inputArgs: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                    />
                  </div>
                )}
                {fieldErrors.caseModalInput && (
                  <p className="text-xs text-red-600">
                    {fieldErrors.caseModalInput}
                  </p>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Expected Output ({functionConfig.returnType}) *
                  </label>
                  <input
                    type="text"
                    value={caseForm.expectedOutput}
                    onChange={(e) =>
                      setCaseForm({
                        ...caseForm,
                        expectedOutput: e.target.value,
                      })
                    }
                    placeholder="[0, 1]"
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md"
                  />
                  {fieldErrors.caseModalOutput && (
                    <p className="text-xs text-red-600 mt-1">
                      {fieldErrors.caseModalOutput}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCaseForm(false);
                      setEditingCaseIndex(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTestCaseModal}
                    data-testid="confirm-save-test-case-btn"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    {editingCaseIndex !== null
                      ? "Update Test Case"
                      : "Add to Test Cases"}
                  </button>
                </div>
              </div>
            )}

            {/* Test Cases Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase">
                      # / Identifier
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase">
                      Visibility
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase">
                      Input Arguments
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase">
                      Expected Output
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {testCases.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-xs text-slate-500"
                      >
                        No evaluation test cases configured yet. Click{" "}
                        <strong>Add Test Case</strong> above.
                      </td>
                    </tr>
                  ) : (
                    testCases.map((tc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-xs font-medium text-slate-900">
                          <span className="font-mono text-slate-400 mr-2">
                            {idx + 1}.
                          </span>
                          {tc.name}
                          {tc.isEssential && (
                            <span className="ml-2 text-[10px] font-semibold text-amber-700">
                              · Essential
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={`font-semibold ${
                              tc.visibility === "public"
                                ? "text-blue-700"
                                : "text-slate-700"
                            }`}
                          >
                            {tc.visibility === "public" ? "Public" : "Private"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-700 max-w-xs truncate">
                          {formatArgsForDisplay(
                            tc.inputArgs,
                            functionConfig.parameters
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-900">
                          {tc.expectedOutput}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setTestCases((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, enabled: !item.enabled }
                                    : item
                                )
                              )
                            }
                            className={`font-semibold ${
                              tc.enabled !== false
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                          >
                            {tc.enabled !== false ? "Enabled" : "Disabled"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewingCase(tc)}
                              className="p-1 text-slate-500 hover:text-slate-900"
                              title="Preview Test Case"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTestCaseForm(idx)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Edit Test Case"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateTestCase(idx)}
                              className="p-1 text-slate-500 hover:text-slate-900"
                              title="Duplicate Test Case"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveTestCase(idx, -1)}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === testCases.length - 1}
                              onClick={() => handleMoveTestCase(idx, 1)}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTestCase(idx)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="Delete Test Case"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {previewingCase && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    Test Case Preview: {previewingCase.name} (
                    {previewingCase.visibility.toUpperCase()})
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewingCase(null)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    Close
                  </button>
                </div>
                <div className="font-mono text-slate-700">
                  <div>
                    <strong>Method Call:</strong> {functionConfig.className}.
                    {functionConfig.methodName}(
                    {formatArgsForDisplay(
                      previewingCase.inputArgs,
                      functionConfig.parameters
                    )}
                    )
                  </div>
                  <div>
                    <strong>Serialized JSON Input:</strong>{" "}
                    {previewingCase.inputArgs}
                  </div>
                  <div>
                    <strong>Expected Return Value:</strong>{" "}
                    {previewingCase.expectedOutput}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Bottom Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {editingQuestionId && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handlePersistQuestion("archived")}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg"
                >
                  <Archive className="w-4 h-4" /> Archive Question
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openStudentPreview}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
              >
                <Eye className="w-4 h-4" /> Preview as Student
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersistQuestion("draft")}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Save className="w-4 h-4" /> Save Draft
              </button>
              {editingQuestionId && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handlePersistQuestion(publicationStatus)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              )}
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handlePersistQuestion("published")}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Send className="w-4 h-4" /> Publish Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PREVIEW AS STUDENT MODAL */}
      {/* ==================================================================== */}
      {showStudentPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="h-12 px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <Code className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-900">
                  Student View Preview — {title || "Untitled Question"}
                </span>
                <span className="text-xs text-slate-500">
                  (Live preview of unsaved form values)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentPreview(false)}
                className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-md"
              >
                Close Preview
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Problem Statement */}
              <div className="w-[45%] border-r border-slate-200 p-6 overflow-y-auto bg-white">
                <ProblemStatementView
                  title={title || "Untitled Question"}
                  difficulty={difficulty}
                  topic={topic}
                  maxMarks={maxMarks}
                  timeLimitSeconds={timeLimitSeconds}
                  memoryLimitMb={memoryLimitMb}
                  description={description}
                  examples={examples.filter((e) => e.input || e.output)}
                  constraints={constraints}
                />
              </div>

              {/* Right Panel: Monaco Editor & Public Sample Test Case Interface */}
              <div className="w-[55%] flex flex-col bg-slate-50">
                <div className="h-11 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Language:
                    </span>
                    <select
                      value={previewLang}
                      onChange={(e) => {
                        const nextL = e.target.value;
                        setPreviewLang(nextL);
                        setPreviewCode(
                          starterCodeMap[nextL] ||
                            generateStarterCodeForLanguage(
                              functionConfig,
                              nextL
                            )
                        );
                      }}
                      className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white"
                    >
                      {(
                        functionConfig.enabledLanguages || [
                          "Java",
                          "C++",
                          "Python",
                          "C",
                        ]
                      ).map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {functionConfig.className}.{functionConfig.methodName}()
                  </span>
                </div>

                <div className="flex-1 bg-white border-b border-slate-200">
                  <Editor
                    height="100%"
                    language={
                      previewLang === "C++" ? "cpp" : previewLang.toLowerCase()
                    }
                    value={previewCode}
                    onChange={(val) => setPreviewCode(val || "")}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineHeight: 22,
                      padding: { top: 14 },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>

                <div className="h-48 bg-white p-4 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Public Sample Test Cases Visible to Student
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Private cases hidden:{" "}
                      {
                        testCases.filter((tc) => tc.visibility === "private")
                          .length
                      }
                    </span>
                  </div>
                  {testCases
                    .filter((tc) => tc.visibility === "public")
                    .map((tc, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-mono space-y-1"
                      >
                        <div className="font-sans font-semibold text-slate-700">
                          {tc.name}
                        </div>
                        <div>
                          Input:{" "}
                          {formatArgsForDisplay(
                            tc.inputArgs,
                            functionConfig.parameters
                          )}
                        </div>
                        <div>Expected Output: {tc.expectedOutput}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
