const fs = require('fs');
let content = fs.readFileSync('src/pages/CodingPage.tsx', 'utf8');

// Replace questionId with testId
content = content.replace(/const \{ questionId \} = useParams\(\);/, 'const { testId } = useParams();\n  const [questions, setQuestions] = useState<any[]>([]);\n  const [activeQuestionId, setActiveQuestionId] = useState<number>(0);\n  const [codes, setCodes] = useState<Record<number, string>>({});\n  const [languages, setLanguages] = useState<Record<number, string>>({});\n  const [questionStatuses, setQuestionStatuses] = useState<Record<number, string>>({});\n  const [testData, setTestData] = useState<any>(null);');

// Replace setQuestion(res.data) with correct state
const fetchOld = `  const fetchQuestion = async () => {
    try {
      const res = await api.get(\`/student/questions/\${questionId}\`);
      setQuestion(res.data);
      const template = generateTemplate(language, res.data);
      setCode(template);
    } catch (err) {
      console.error(err);
      navigate("/student");
    }
  };`;

const fetchNew = `  const fetchTest = async () => {
    try {
      const res = await api.get(\`/student/tests/\${testId}\`);
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
  };`;

content = content.replace(fetchOld, fetchNew);

// Replace useEffect for fetchQuestion
content = content.replace(/fetchQuestion\(\);/g, 'fetchTest();');
content = content.replace(/questionId/g, 'testId');

// Add handleSwitchQuestion
const langChangeNew = `  const handleSwitchQuestion = (qid: number) => {
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
  
  const submitAssessment = async () => {
    if (!window.confirm("Are you sure you want to submit the entire assessment? You will not be able to return.")) return;
    try {
      await api.post(\`/student/tests/\${testId}/finish\`);
      alert("Assessment submitted successfully!");
      navigate("/student");
    } catch (err) {
      alert("Failed to submit assessment.");
    }
  };

  const handleLanguageChange`;

content = content.replace(/  const handleLanguageChange/, langChangeNew);

// Update handleSubmit to update status
content = content.replace(/      alert\(\`Code submitted successfully! Final Verdict: \$\{res\.data\.finalStatus\}\`\);\n      navigate\("\/student"\);/g, '      alert(`Code submitted successfully! Final Verdict: ${res.data.finalStatus}`);\n      setQuestionStatuses(prev => ({...prev, [activeQuestionId]: res.data.finalStatus === "Accepted" ? "Accepted" : "Submitted"}));');
content = content.replace(/parseInt\(testId \|\| "0"\)/g, 'activeQuestionId');

// Wrap main content with layout that includes sidebar
const mainContentOld = `<div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Question */}`;

const mainContentNew = `<div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Questions Navigator */}
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="font-bold text-slate-800">Questions</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {questions.map((q, idx) => (
              <button 
                key={q.id}
                onClick={() => handleSwitchQuestion(q.id)}
                className={\`w-full text-left p-3 rounded-lg border transition-all \${activeQuestionId === q.id ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'}\`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-700 text-sm">Q{idx + 1}</span>
                  {questionStatuses[q.id] === "Accepted" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  {questionStatuses[q.id] === "Submitted" && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                  {questionStatuses[q.id] === "Attempted" && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                  {questionStatuses[q.id] === "Not Attempted" && <span className="w-2 h-2 rounded-full bg-slate-300"></span>}
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
        
        {/* Middle Panel: Question Description */}`;

content = content.replace(mainContentOld, mainContentNew);

fs.writeFileSync('src/pages/CodingPage.tsx', content);
