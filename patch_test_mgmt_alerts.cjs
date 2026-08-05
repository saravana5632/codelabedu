const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

const deleteOld = `  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await api.delete(\`/faculty/questions/\${qId}\`);
      alert("Question deleted successfully.");
      if (addingQuestionForTest) fetchTestQuestions(addingQuestionForTest);
    } catch (err) {
      alert("Failed to delete question. It might have existing submissions.");
    }
  };`;

const deleteNew = `  const handleDeleteQuestion = async (qId: number) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await api.delete(\`/faculty/questions/\${qId}\`);
      alert("Question deleted successfully.");
      if (addingQuestionForTest) fetchTestQuestions(addingQuestionForTest);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete question. It might have existing submissions.");
    }
  };`;
content = content.replace(deleteOld, deleteNew);

const addOld = `  const handleAddQuestion = async (e: React.FormEvent) => {
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
    parameters: [] as {name: string, type: string}[]
  });
    } catch (err) {
      alert(editingQuestionId ? "Error updating question" : "Error adding question");
    }
  };`;

const addNew = `  const handleAddQuestion = async (e: React.FormEvent) => {
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
        parameters: [] as {name: string, type: string}[]
      });
    } catch (err: any) {
      alert(err.response?.data?.message || (editingQuestionId ? "Error updating question" : "Error adding question"));
    }
  };`;
content = content.replace(addOld, addNew);

fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
