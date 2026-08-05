const fs = require('fs');
let content = fs.readFileSync('src/pages/CodingPage.tsx', 'utf8');

const mainContentOld = `<div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Question Description */}`;

const mainContentNew = `<div className="flex-1 flex overflow-hidden">
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
                className={\`w-full text-left p-3 rounded-lg border transition-all \${activeQuestionId === q.id ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-slate-50'}\`}
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
        
        {/* Left Panel - Question Description */}`;

content = content.replace(mainContentOld, mainContentNew);
fs.writeFileSync('src/pages/CodingPage.tsx', content);
