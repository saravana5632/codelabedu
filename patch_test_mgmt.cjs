const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

// 1. Add state for existing questions
const stateOld = `const [addingQuestionForTest, setAddingQuestionForTest] = useState<number | null>(null);`;
const stateNew = `const [addingQuestionForTest, setAddingQuestionForTest] = useState<number | null>(null);
  const [testQuestions, setTestQuestions] = useState<any[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);`;
content = content.replace(stateOld, stateNew);

const initialQuestionState = `{
    title: "",
    description: "",
    constraints: "",
    inputFormat: "",
    outputFormat: "",
    sampleInput: "",
    sampleOutput: "",
    publicExplanation: "",
    privateInput1: "",
    privateOutput1: "",
    privateInput2: "",
    privateOutput2: "",
    difficulty: "medium",
    functionName: "",
    returnType: "",
    parameters: [] as {name: string, type: string}[]
  }`;

// 2. Fetch questions function
const fetchTestsOld = `const fetchTests = async () => {`;
const fetchQuestionsFunc = `
  const fetchTestQuestions = async (testId: number) => {
    try {
      const res = await api.get(\`/faculty/tests/\${testId}/questions\`);
      setTestQuestions(res.data);
    } catch (err) {
      console.error(err);
    }
  };
  
  const openQuestionModal = (testId: number) => {
    setAddingQuestionForTest(testId);
    setEditingQuestionId(null);
    setNewQuestion(${initialQuestionState});
    fetchTestQuestions(testId);
  };
  
  const handleEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    setNewQuestion({
      title: q.title || "",
      description: q.description || "",
      constraints: q.constraints || "",
      inputFormat: q.inputFormat || "",
      outputFormat: q.outputFormat || "",
      sampleInput: q.sampleInput || "",
      sampleOutput: q.sampleOutput || "",
      publicExplanation: q.publicExplanation || "",
      privateInput1: q.privateInput1 || "",
      privateOutput1: q.privateOutput1 || "",
      privateInput2: q.privateInput2 || "",
      privateOutput2: q.privateOutput2 || "",
      difficulty: q.difficulty || "medium",
      functionName: q.functionName || "",
      returnType: q.returnType || "",
      parameters: q.parameters || []
    });
  };
  
  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.delete(\`/faculty/questions/\${qId}\`);
      alert("Question deleted successfully.");
      if (addingQuestionForTest) fetchTestQuestions(addingQuestionForTest);
    } catch (err) {
      alert("Failed to delete question. It might have existing submissions.");
    }
  };

  const fetchTests = async () => {`;
content = content.replace(fetchTestsOld, fetchQuestionsFunc);

// 3. handleAddQuestion replacement to handle edit
const handleAddQOld = `  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingQuestionForTest) return;
    try {
      await api.post("/faculty/questions", {
        testId: addingQuestionForTest,
        ...newQuestion
      });
      alert("Question added successfully!");
      setAddingQuestionForTest(null);
      setNewQuestion({
        title: "",
        description: "",
        constraints: "",
        inputFormat: "",
        outputFormat: "",
        sampleInput: "",
        sampleOutput: "",
        publicExplanation: "",
        privateInput1: "",
        privateOutput1: "",
        privateInput2: "",
        privateOutput2: "",
        difficulty: "medium",
        functionName: "",
        returnType: "",
        parameters: []
      });
    } catch (err) {
      alert("Error adding question");
    }
  };`;
const handleAddQNew = `  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingQuestionForTest) return;
    try {
      if (editingQuestionId) {
        await api.put(\`/faculty/questions/\${editingQuestionId}\`, newQuestion);
        alert("Question updated successfully!");
      } else {
        await api.post("/faculty/questions", {
          testId: addingQuestionForTest,
          ...newQuestion
        });
        alert("Question added successfully!");
      }
      
      fetchTestQuestions(addingQuestionForTest);
      setEditingQuestionId(null);
      setNewQuestion(${initialQuestionState});
    } catch (err) {
      alert(editingQuestionId ? "Error updating question" : "Error adding question");
    }
  };`;
content = content.replace(handleAddQOld, handleAddQNew);

// 4. Update the onClick to use openQuestionModal instead of setAddingQuestionForTest
content = content.replace(/setAddingQuestionForTest\(t\.id\)/g, 'openQuestionModal(t.id)');

// 5. Update the UI for addingQuestionForTest modal
const modalHeaderOld = `<h3 className="text-xl font-bold text-gray-900">Add Programming Question</h3>`;
const modalHeaderNew = `<h3 className="text-xl font-bold text-gray-900">Manage Questions</h3>`;
content = content.replace(modalHeaderOld, modalHeaderNew);

const formOld = `<form onSubmit={handleAddQuestion} className="p-6 space-y-4">`;
const formNew = `
            {/* Existing Questions List */}
            {testQuestions.length > 0 && (
              <div className="p-6 border-b border-gray-200 bg-slate-50">
                <h4 className="font-semibold text-gray-800 mb-3">Questions in this test: {testQuestions.length}</h4>
                <div className="space-y-2">
                  {testQuestions.map((q, i) => (
                    <div key={q.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-gray-200">
                      <div>
                        <span className="font-semibold mr-2">Q{i+1}:</span>
                        <span>{q.title}</span>
                        <span className="ml-3 text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">{q.difficulty}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditQuestion(q)} className="text-blue-600 hover:text-blue-800"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <form onSubmit={handleAddQuestion} className="p-6 space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg text-gray-800">
                  {editingQuestionId ? "Edit Question" : "Add New Question"}
                </h4>
                {editingQuestionId && (
                   <button type="button" onClick={() => { setEditingQuestionId(null); setNewQuestion(${initialQuestionState}); }} className="text-sm text-gray-500 hover:text-gray-800">
                     Cancel Edit
                   </button>
                )}
              </div>
`;
content = content.replace(formOld, formNew);

// 6. Update submit button text
content = content.replace(/>Add Question<\/button>/, '>{editingQuestionId ? "Update Question" : "Add Question"}</button>');


fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
