const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

// Add state
content = content.replace(
  'const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);',
  'const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);\n  const [confirmingDeleteQuestionId, setConfirmingDeleteQuestionId] = useState<number | null>(null);'
);

// Modify handleDeleteQuestion
const deleteOld = `  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api.delete(\`/faculty/questions/\${qId}\`);
      alert("Question deleted successfully.");
      if (addingQuestionForTest) fetchTestQuestions(addingQuestionForTest);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete question. It might have existing submissions.");
    }
  };`;

const deleteNew = `  const handleDeleteQuestion = async (qId: number) => {
    try {
      await api.delete(\`/faculty/questions/\${qId}\`);
      // alert("Question deleted successfully.");
      setConfirmingDeleteQuestionId(null);
      if (addingQuestionForTest) fetchTestQuestions(addingQuestionForTest);
    } catch (err: any) {
      // alert(err.response?.data?.message || "Failed to delete question. It might have existing submissions.");
      console.error(err);
    }
  };`;

content = content.replace(deleteOld, deleteNew);

// Replace the duplicateTest confirm
const dupOld = `  const duplicateTest = async (testId: number) => {
    if(!window.confirm("Are you sure you want to duplicate this test?")) return;
    try {`;

const dupNew = `  const duplicateTest = async (testId: number) => {
    try {`;
content = content.replace(dupOld, dupNew);

// Replace table actions for questions
const tableOld = `                            <div className="flex gap-3">
                              <button onClick={() => handleEditQuestion(q)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>`;

const tableNew = `                            <div className="flex gap-3">
                              {confirmingDeleteQuestionId === q.id ? (
                                <>
                                  <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Confirm</button>
                                  <button onClick={() => setConfirmingDeleteQuestionId(null)} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded hover:bg-gray-300">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => handleEditQuestion(q)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setConfirmingDeleteQuestionId(q.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>`;

content = content.replace(tableOld, tableNew);

fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
