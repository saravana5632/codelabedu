const fs = require('fs');
const path = 'src/pages/CodingPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Add state for submitted solutions and modal
code = code.replace(
  /const \[isSubmitting, setIsSubmitting\] = useState\(false\);/,
  `const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSolutions, setSubmittedSolutions] = useState<Record<number, boolean>>({});
  const [showSubmitModal, setShowSubmitModal] = useState(false);`
);

// 2. Modify handleRun to output the exact required format and score
const runRegex = /const handleRun = async \(\) => \{[\s\S]*?setIsRunning\(false\);\n  \};/;
const newHandleRun = `const handleRun = async (isFinalSubmit: boolean = false) => {
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
        
        outputText += "CUSTOM INPUT RESULT:\\n";
        outputText += "Input:\\n" + customInput + "\\n\\n";

        if (res.data.status?.id === 5) {
          outputText += "TIME LIMIT EXCEEDED\\n\\n";
        } else if (res.data.compile_output) {
          outputText += "COMPILATION ERROR\\n" + res.data.compile_output + "\\n\\n";
        } else if (res.data.stderr) {
          outputText += "RUNTIME ERROR\\n" + res.data.stderr + "\\n\\n";
        } else {
          outputText += "Output:\\n" + (res.data.stdout || "Execution completed without output.") + "\\n\\n";
        }
        outputText += "--------------------------------\\n\\n";
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
           outputText += \`Test Case \${i + 1}: TIME LIMIT EXCEEDED\\nMarks: 0/25\\n\\n\`;
        } else if (res.data.compile_output) {
           outputText += \`Test Case \${i + 1}: COMPILATION ERROR\\nMarks: 0/25\\n\\n\`;
        } else if (res.data.stderr) {
           outputText += \`Test Case \${i + 1}: RUNTIME ERROR\\nMarks: 0/25\\n\\n\`;
        } else {
           const actualOut = (res.data.stdout || "").trim();
           const expectedOut = tc.expectedOutput.trim();
           
           const normalize = (str: string) => str.replace(/\\r\\n/g, '\\n').replace(/\\s+/g, ' ').trim();
           const isPassed = normalize(actualOut) === normalize(expectedOut);
           
           if (isPassed) passedCount++;
           
           outputText += \`Test Case \${i + 1}: \${isPassed ? "PASSED" : "FAILED"}\\nMarks: \${isPassed ? "25" : "0"}/25\\n\\n\`;
           outputText += \`Input:\\n\${tc.input}\\n\\n\`;
           outputText += \`Expected Output:\\n\${tc.expectedOutput}\\n\\n\`;
           outputText += \`Your Output:\\n\${actualOut}\\n\\n\`;
        }
      }

      if (totalCount > 0) {
        outputText += \`--------------------------------\\n\`;
        outputText += \`Question Score: \${passedCount * 25}/\${totalCount * 25}\\n\`;
        outputText += \`--------------------------------\\n\`;
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
      alert(\`Assessment Submitted Successfully\\n\\nYour assessment has been finalized.\`);
      navigate("/student");
    } catch (err) {
      alert("Failed to submit assessment.");
    }
    setIsSubmitting(false);
    setShowSubmitModal(false);
  };`;

code = code.replace(runRegex, newHandleRun);

// 3. Remove handleSubmit definition
const submitRegex = /const handleSubmit = async \(\) => \{[\s\S]*?setIsSubmitting\(false\);\n  \};/;
code = code.replace(submitRegex, '');

// 4. Update the buttons in the UI
const bottomButtonsRegex = /\{\/\* Bottom Buttons \*\/\}[\s\S]*?<\/div>/;
const newBottomButtons = `{/* Bottom Buttons */}
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
            </div>`;
code = code.replace(bottomButtonsRegex, newBottomButtons);

// 5. Add "Submit Assessment" button in the header
const headerRegex = /<div className="flex flex-col items-end">\s*<span className="text-xs text-gray-500 uppercase font-semibold">Time Remaining<\/span>\s*<span className="text-sm font-mono font-bold text-red-600">--:--<\/span>\s*<\/div>\s*<\/div>\s*<\/div>/;
const newHeader = `<div className="flex flex-col items-end">
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
        </div>`;
code = code.replace(headerRegex, newHeader);

// 6. Add modal rendering
const modalCode = `
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
`;
const lastDivRegex = /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/;
code = code.replace(lastDivRegex, `</div>\n      </div>\n${modalCode}\n    </div>\n  );\n}`);

fs.writeFileSync(path, code);
