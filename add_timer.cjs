const fs = require('fs');
let content = fs.readFileSync('src/pages/CodingPage.tsx', 'utf8');

// Add timeLeft state
content = content.replace(/const \[testData, setTestData\] = useState<any>\(null\);/, 'const [testData, setTestData] = useState<any>(null);\n  const [timeLeft, setTimeLeft] = useState<number>(0);');

// Add Timer logic in fetchTest
const fetchOld = `      if (res.data.questions.length > 0) {
        setActiveQuestionId(res.data.questions[0].id);`;
const fetchNew = `      if (res.data.attempt) {
        const startedAt = new Date(res.data.attempt.startedAt).getTime();
        const durationMs = res.data.duration * 60 * 1000;
        const endsAt = startedAt + durationMs;
        const now = new Date().getTime();
        setTimeLeft(Math.max(0, Math.floor((endsAt - now) / 1000)));
      }

      if (res.data.questions.length > 0) {
        setActiveQuestionId(res.data.questions[0].id);`;
content = content.replace(fetchOld, fetchNew);

// Add useEffect for timer
const useEffectTimer = `
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submitAssessment(); // auto submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);
`;

content = content.replace(/  const handleSwitchQuestion/, useEffectTimer + '\n  const handleSwitchQuestion');

const formatTime = `
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return \`\${h}:\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
    return \`\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
  };
`;

content = content.replace(/  const handleSwitchQuestion/, formatTime + '\n  const handleSwitchQuestion');

// Find a place to render the timer.
// In the Sidebar, before Questions
const sidebarTitleOld = `<div className="p-4 border-b border-slate-200 bg-white">
            <h2 className="font-bold text-slate-800">Questions</h2>
          </div>`;
const sidebarTitleNew = `<div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
            <h2 className="font-bold text-slate-800">Questions</h2>
            <div className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold">
              ⏱ {formatTime(timeLeft)}
            </div>
          </div>`;
content = content.replace(sidebarTitleOld, sidebarTitleNew);

// Fix question -> testData loading state
content = content.replace(/if \(!question\) return <div className="p-8 text-center text-gray-500">Loading\.\.\.<\/div>;/, 'if (!testData || !question) return <div className="p-8 text-center text-gray-500">Loading...</div>;');

fs.writeFileSync('src/pages/CodingPage.tsx', content);
