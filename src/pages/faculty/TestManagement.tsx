import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api.ts';
import { Plus, Play, Pause, Trash2, Copy, BarChart3, Search, Code, Clock } from 'lucide-react';

export default function TestManagement() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTest, setNewTest] = useState({ title: "", subject: "", duration: 45, startTime: "", endTime: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const fetchTests = async () => {
    try {
      const res = await api.get("/faculty/tests");
      if (Array.isArray(res.data)) {
        setTests(res.data);
      } else {
        setTests([]);
      }
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
      setNewTest({ title: "", subject: "", duration: 45, startTime: "", endTime: "" });
      setStatusMessage("Test created with authoritative timer settings.");
      fetchTests();
    } catch (err) {
      setStatusMessage("Error creating test.");
    }
  };

  const publishTest = async (id: number) => {
    try {
      await api.put(`/faculty/tests/${id}`, { status: "published" });
      setStatusMessage("Test published.");
      fetchTests();
    } catch (err) {
      setStatusMessage("Error publishing test.");
    }
  };

  const unpublishTest = async (id: number) => {
    try {
      await api.put(`/faculty/tests/${id}`, { status: "draft" });
      setStatusMessage("Test moved to draft.");
      fetchTests();
    } catch (err) {
      setStatusMessage("Error unpublishing test.");
    }
  };

  const duplicateTest = async (id: number) => {
    try {
      await api.post(`/faculty/tests/${id}/duplicate`);
      setStatusMessage("Test duplicated successfully.");
      fetchTests();
    } catch (err) {
      setStatusMessage("Error duplicating test.");
    }
  };

  const [deleteModal, setDeleteModal] = useState<{show: boolean, testId: number | null, hasSubmissions: boolean}>({show: false, testId: null, hasSubmissions: false});

  const handleDeleteClick = async (id: number) => {
    try {
      const res = await api.get(`/faculty/tests/${id}/check-submissions`);
      setDeleteModal({ show: true, testId: id, hasSubmissions: res.data.hasSubmissions });
    } catch (err) {
      setStatusMessage("Error checking test status.");
    }
  };

  const confirmDelete = async (action: 'archive' | 'delete') => {
    if (!deleteModal.testId) return;
    try {
      await api.delete(`/faculty/tests/${deleteModal.testId}`, { data: { action } });
      setStatusMessage(action === 'archive' ? 'Test archived successfully.' : 'Test permanently deleted.');
      setDeleteModal({ show: false, testId: null, hasSubmissions: false });
      fetchTests();
    } catch (err) {
      setStatusMessage("Error deleting test.");
    }
  };

  const filteredTests = tests.filter(t => t.status !== 'archived' && t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Test Management</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create New Test
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-800 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage("")} className="text-blue-600 hover:text-blue-900">Dismiss</button>
        </div>
      )}

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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timer</th>
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
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-gray-800">
                  <Link
                    to={`/faculty/questions?testId=${test.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {test.publishedQuestionsCount ?? test.questionsCount ?? 0} published
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono tabular-nums text-gray-800">
                  {test.timerEnabled === false ? (
                    <span className="text-amber-700 font-sans text-xs font-medium">Disabled (Untimed)</span>
                  ) : (
                    <span>{test.durationMinutes ?? test.duration} min</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-xs font-semibold ${
                    test.status === 'published' ? 'text-green-700' :
                    test.status === 'completed' ? 'text-gray-700' :
                    'text-amber-700'
                  }`}>
                    {test.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/faculty/questions?testId=${test.id}&create=1`)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded hover:bg-blue-50"
                      title="Add Programming Question"
                    >
                      <Code className="w-4 h-4" /> Add Question
                    </button>

                    {test.status === 'draft' ? (
                      <button onClick={() => publishTest(test.id)} className="text-green-600 hover:text-green-900" title="Publish">
                        <Play className="w-5 h-5" />
                      </button>
                    ) : test.status === 'published' ? (
                      <button onClick={() => unpublishTest(test.id)} className="text-yellow-600 hover:text-yellow-900" title="Unpublish">
                        <Pause className="w-5 h-5" />
                      </button>
                    ) : null}

                    <Link to={`/faculty/timer?testId=${test.id}`} className="text-blue-600 hover:text-blue-900" title="Configure Assessment Timer">
                      <Clock className="w-5 h-5" />
                    </Link>
                    
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
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
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
