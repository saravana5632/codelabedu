const fs = require('fs');
let content = fs.readFileSync('src/pages/faculty/TestManagement.tsx', 'utf8');

const listOld = `<div className="space-y-2">
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
                </div>`;

const listNew = `<div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white border border-gray-200 rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Question Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Difficulty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Function Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {testQuestions.map((q, i) => (
                        <tr key={q.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.title}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={\`px-2 py-0.5 rounded text-xs \${q.difficulty === 'easy' ? 'bg-green-100 text-green-800' : q.difficulty === 'hard' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}\`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{q.functionName || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-3">
                              <button onClick={() => handleEditQuestion(q)} className="text-blue-600 hover:text-blue-800" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>`;

content = content.replace(listOld, listNew);
fs.writeFileSync('src/pages/faculty/TestManagement.tsx', content);
