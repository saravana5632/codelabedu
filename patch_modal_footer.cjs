const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

const footerOld = `<div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setAddingQuestionForTest(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  {editingQuestionId ? "Update Question" : "Add Question"}
                </button>
              </div>`;

const footerNew = `<div className="pt-4 flex items-center justify-between border-t border-gray-200 mt-6 pt-4">
                <div className="text-sm text-gray-600 font-medium">
                  Questions in this test: {testQuestions.length}
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setAddingQuestionForTest(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                    {editingQuestionId ? "Update Question" : "Add Question"}
                  </button>
                </div>
              </div>`;

content = content.replace(footerOld, footerNew);

fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
