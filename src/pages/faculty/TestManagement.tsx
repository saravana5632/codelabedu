import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { Plus, Play, Pause, Trash2, Copy, BarChart3, Edit, Search, Code, X } from 'lucide-react';

export default function TestManagement() {
  const [tests, setTests] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTest, setNewTest] = useState({ title: "", subject: "", duration: 60, startTime: "", endTime: "" });
  const [searchTerm, setSearchTerm] = useState("");
  
  const [addingQuestionForTest, setAddingQuestionForTest] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    title: "",
    description: "",
    constraints: "",
    inputFormat: "",
    outputFormat: "",
    sampleInput: "",
    sampleOutput: "",
    difficulty: "medium"
  });

  const fetchTests = async () => {
    try {
      const res = await api.get("/faculty/tests");
      setTests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date();
      const end = new Date();
      end.setFullYear(now.getFullYear() + 10);
      
      const payload = {
        ...newTest,
        startTime: now.toISOString(),
        endTime: end.toISOString()
      };
      await api.post("/faculty/tests", payload);
      setShowCreate(false);
      setNewTest({ title: "", subject: "", duration: 60, startTime: "", endTime: "" });
      fetchTests();
    } catch (err) {
      alert("Error creating test");
    }
  };

  const publishTest = async (id: number) => {
    try {
      await api.put(`/faculty/tests/${id}`, { status: "published" });
      fetchTests();
    } catch (err) {
      alert("Error publishing test");
    }
  };

  const unpublishTest = async (id: number) => {
    try {
      await api.put(`/faculty/tests/${id}`, { status: "draft" });
      fetchTests();
    } catch (err) {
      alert("Error unpublishing test");
    }
  };

  const duplicateTest = async (id: number) => {
    if(!window.confirm("Are you sure you want to duplicate this test?")) return;
    try {
      await api.post(`/faculty/tests/${id}/duplicate`);
      fetchTests();
    } catch (err) {
      alert("Error duplicating test");
    }
  };

  const [deleteModal, setDeleteModal] = useState<{show: boolean, testId: number | null, hasSubmissions: boolean}>({show: false, testId: null, hasSubmissions: false});

  const handleDeleteClick = async (id: number) => {
    try {
      const res = await api.get(`/faculty/tests/${id}/check-submissions`);
      setDeleteModal({ show: true, testId: id, hasSubmissions: res.data.hasSubmissions });
    } catch (err) {
      alert("Error checking test status");
    }
  };

  const confirmDelete = async (action: 'archive' | 'delete') => {
    if (!deleteModal.testId) return;
    try {
      await api.delete(`/faculty/tests/${deleteModal.testId}`, { data: { action } });
      alert(action === 'archive' ? 'Test archived successfully' : 'Test permanently deleted');
      setDeleteModal({ show: false, testId: null, hasSubmissions: false });
      fetchTests();
    } catch (err) {
      alert("Error deleting test");
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
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
        difficulty: "medium"
      });
    } catch (err) {
      alert("Error adding question");
    }
  };

  const filteredTests = tests.filter(t => t.status !== 'archived' && t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Test Management</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create New Test
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTests.map((test) => (
              <tr key={test.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{test.title}</div>
                  <div className="text-sm text-gray-500">{new Date(test.startTime).toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{test.subject}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    test.status === 'published' ? 'bg-green-100 text-green-800' :
                    test.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {test.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-3">
                    {test.status === 'draft' ? (
                      <>
                        <button onClick={() => setAddingQuestionForTest(test.id)} className="text-blue-600 hover:text-blue-900" title="Add Question">
                          <Code className="w-5 h-5" />
                        </button>
                        <button onClick={() => publishTest(test.id)} className="text-green-600 hover:text-green-900" title="Publish">
                          <Play className="w-5 h-5" />
                        </button>
                      </>
                    ) : test.status === 'published' ? (
                      <button onClick={() => unpublishTest(test.id)} className="text-yellow-600 hover:text-yellow-900" title="Unpublish">
                        <Pause className="w-5 h-5" />
                      </button>
                    ) : null}
                    
                    <Link to={`/faculty/analytics/${test.id}`} className="text-indigo-600 hover:text-indigo-900" title="Analytics">
                      <BarChart3 className="w-5 h-5" />
                    </Link>
                    
                    <button onClick={() => duplicateTest(test.id)} className="text-gray-600 hover:text-gray-900" title="Duplicate">
                      <Copy className="w-5 h-5" />
                    </button>
                    
                    <button onClick={() => handleDeleteClick(test.id)} className="text-red-600 hover:text-red-900" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  No tests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Test</h3>
            <form onSubmit={handleCreateTest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Test Title</label>
                <input required type="text" value={newTest.title} onChange={e => setNewTest({...newTest, title: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Subject</label>
                <input required type="text" value={newTest.subject} onChange={e => setNewTest({...newTest, subject: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (minutes)</label>
                <input required type="number" value={newTest.duration} onChange={e => setNewTest({...newTest, duration: parseInt(e.target.value)})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create Test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addingQuestionForTest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Add Programming Question</h3>
              <button onClick={() => setAddingQuestionForTest(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddQuestion} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Question Title</label>
                  <input required type="text" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="e.g. Reverse a Singly Linked List" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea required rows={3} value={newQuestion.description} onChange={e => setNewQuestion({...newQuestion, description: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Write a program to..." />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Constraints</label>
                  <textarea rows={2} value={newQuestion.constraints} onChange={e => setNewQuestion({...newQuestion, constraints: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="1 <= N <= 10^5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Input Format</label>
                  <textarea rows={2} value={newQuestion.inputFormat} onChange={e => setNewQuestion({...newQuestion, inputFormat: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Output Format</label>
                  <textarea rows={2} value={newQuestion.outputFormat} onChange={e => setNewQuestion({...newQuestion, outputFormat: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sample Input</label>
                  <textarea required rows={3} value={newQuestion.sampleInput} onChange={e => setNewQuestion({...newQuestion, sampleInput: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm font-mono text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sample Output</label>
                  <textarea required rows={3} value={newQuestion.sampleOutput} onChange={e => setNewQuestion({...newQuestion, sampleOutput: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm font-mono text-xs focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Difficulty</label>
                  <select value={newQuestion.difficulty} onChange={e => setNewQuestion({...newQuestion, difficulty: e.target.value})} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setAddingQuestionForTest(null)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.show && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Test</h3>
            {deleteModal.hasSubmissions ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">This test has student submissions. What would you like to do?</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => confirmDelete('archive')} className="w-full text-left px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
                    <span className="block font-medium text-blue-800">Archive Test (Recommended)</span>
                    <span className="block text-sm text-blue-600 mt-1">Hide from students but preserve submissions and reports.</span>
                  </button>
                  <button onClick={() => confirmDelete('delete')} className="w-full text-left px-4 py-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">
                    <span className="block font-medium text-red-800">Permanently Delete</span>
                    <span className="block text-sm text-red-600 mt-1">Delete test and permanently remove all related submissions.</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">No students have submitted this test yet. Are you sure you want to permanently delete it?</p>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setDeleteModal({show: false, testId: null, hasSubmissions: false})} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button onClick={() => confirmDelete('delete')} className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">Permanently Delete</button>
                </div>
              </div>
            )}
            {deleteModal.hasSubmissions && (
              <div className="mt-4 flex justify-end">
                <button onClick={() => setDeleteModal({show: false, testId: null, hasSubmissions: false})} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
