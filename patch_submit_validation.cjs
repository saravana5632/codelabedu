const fs = require('fs');
const path = 'src/pages/CodingPage.tsx';
let code = fs.readFileSync(path, 'utf8');

const submitAssessmentRegex = /const handleSubmitAssessment = async \(\) => \{[\s\S]*?setShowSubmitModal\(false\);\n  \};/;
const newSubmitAssessment = `const handleSubmitAssessment = async () => {
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
      alert(\`Assessment Submitted Successfully\\n\\nYour assessment has been finalized.\`);
      navigate("/student");
    } catch (err) {
      alert("Failed to submit assessment.");
    }
    setIsSubmitting(false);
    setShowSubmitModal(false);
  };`;

code = code.replace(submitAssessmentRegex, newSubmitAssessment);
fs.writeFileSync(path, code);
