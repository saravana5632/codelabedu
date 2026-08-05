import React, { useState, useEffect } from "react";
import api from "../../lib/api.ts";
import { 
  ShieldAlert, 
  AlertTriangle, 
  GitCompare, 
  Smartphone, 
  RefreshCw, 
  Search, 
  Eye, 
  UserCheck, 
  X, 
  Clock, 
  FileCode, 
  CheckCircle, 
  AlertCircle
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, BarChart, Bar 
} from "recharts";

export default function MalpracticeDashboard() {
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [similarityData, setSimilarityData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");

  // Modal states
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSimilarityModal, setShowSimilarityModal] = useState(false);
  const [selectedPair, setSelectedPair] = useState<any>(null);

  useEffect(() => {
    fetchTests();
  }, []);

  useEffect(() => {
    if (selectedTestId) {
      fetchMalpracticeData(selectedTestId);
      fetchSimilarityData(selectedTestId);
    }
  }, [selectedTestId]);

  const fetchTests = async () => {
    try {
      const res = await api.get("/faculty/tests");
      setTests(res.data || []);
      if (res.data && res.data.length > 0) {
        setSelectedTestId(res.data[0].id);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchMalpracticeData = async (testId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/malpractice/${testId}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to load malpractice data", err);
    }
    setLoading(false);
  };

  const fetchSimilarityData = async (testId: number) => {
    try {
      const res = await api.get(`/similarity/${testId}`);
      setSimilarityData(res.data?.similarityPairs || []);
    } catch (err) {
      console.error("Failed to load similarity data", err);
    }
  };

  const openStudentAudit = async (studentId: number) => {
    setSelectedStudentId(studentId);
    setDetailLoading(true);
    try {
      const res = await api.get(`/student/${studentId}/activity`);
      setStudentDetail(res.data);
    } catch (err) {
      console.error("Failed to load student activity", err);
    }
    setDetailLoading(false);
  };

  const RISK_COLORS: Record<string, string> = {
    Green: "#10B981",
    Yellow: "#F59E0B",
    Red: "#EF4444"
  };

  const summary = data?.summary || {
    totalViolations: 0,
    studentsFlagged: 0,
    averageSimilarity: 0,
    activeSuspiciousSessions: 0,
    riskDistribution: { green: 0, yellow: 0, red: 0 },
    similarityDistribution: { '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 }
  };

  const studentSummaries = (data?.studentSummaries || []).filter((s: any) => {
    const matchesSearch = (s?.studentName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          (s?.rollNumber || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesRisk = riskFilter === "ALL" || (s?.riskLevel || '').toUpperCase() === (riskFilter || '').toUpperCase();
    return matchesSearch && matchesRisk;
  });

  const pieChartData = [
    { name: "Green (Clean)", value: summary.riskDistribution.green, color: "#10B981" },
    { name: "Yellow (Minor)", value: summary.riskDistribution.yellow, color: "#F59E0B" },
    { name: "Red (High Risk)", value: summary.riskDistribution.red, color: "#EF4444" }
  ].filter(d => d.value > 0);

  const barChartData = Object.entries(summary.similarityDistribution || {}).map(([range, count]) => ({
    range,
    count
  }));

  return (
    <div className="space-y-8 pb-12 font-sans text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Anti-Malpractice System</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Real-time monitoring, tab-switch tracking, device session audit, and automated code similarity analysis.
          </p>
        </div>

        {/* Test Selector Dropdown & Refresh */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase">Select Test:</label>
          <select
            value={selectedTestId || ""}
            onChange={(e) => setSelectedTestId(parseInt(e.target.value))}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>{t.title} ({t.subject})</option>
            ))}
          </select>

          <button
            onClick={() => {
              if (selectedTestId) {
                fetchMalpracticeData(selectedTestId);
                fetchSimilarityData(selectedTestId);
              }
            }}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-slate-600 shadow-sm transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500 font-medium">Loading Malpractice Analytics...</div>
      ) : !selectedTestId ? (
        <div className="py-20 text-center text-slate-500">No active test selected. Please create or publish a test.</div>
      ) : (
        <>
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Violations</span>
                <div className="text-2xl font-bold text-slate-900">{summary.totalViolations}</div>
                <span className="text-[11px] text-slate-500">Tab switches, pastes, & exits</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Students Flagged</span>
                <div className="text-2xl font-bold text-amber-600">{summary.studentsFlagged}</div>
                <span className="text-[11px] text-slate-500">Yellow or Red risk status</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <GitCompare className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Avg Code Similarity</span>
                <div className="text-2xl font-bold text-slate-900">{summary.averageSimilarity}%</div>
                <span className="text-[11px] text-slate-500">Normalized code overlap</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase">Active Suspicious Sessions</span>
                <div className="text-2xl font-bold text-purple-700">{summary.activeSuspiciousSessions}</div>
                <span className="text-[11px] text-slate-500">Concurrent or device alerts</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Violations Over Time */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Violations Over Time</h3>
              <p className="text-xs text-slate-500 mb-4">Event frequency during the test</p>
              <div className="h-56 w-full">
                {data?.violationsOverTime?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.violationsOverTime}>
                      <XAxis dataKey="time" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#EF4444" fill="#FEE2E2" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">No violations recorded yet</div>
                )}
              </div>
            </div>

            {/* Chart 2: Student Risk Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Student Risk Distribution</h3>
              <p className="text-xs text-slate-500 mb-4">Green, Yellow, and Red risk classification</p>
              <div className="h-56 w-full flex items-center justify-center">
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400">All student activity normal</div>
                )}
              </div>
            </div>

            {/* Chart 3: Code Similarity Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Code Similarity Distribution</h3>
              <p className="text-xs text-slate-500 mb-4">Pairwise similarity breakdown</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="range" stroke="#94A3B8" fontSize={10} />
                    <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Student Risk & Violation Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Student Malpractice & Risk Registry</h2>
                <p className="text-xs text-slate-500 mt-0.5">Automated detection evidence for faculty evaluation</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Risk Filter Pills */}
                <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-0.5">
                  {['ALL', 'GREEN', 'YELLOW', 'RED'].map((rf) => (
                    <button
                      key={rf}
                      onClick={() => setRiskFilter(rf)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                        riskFilter === rf ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {rf}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name or roll..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {similarityData.length > 0 && (
                  <button
                    onClick={() => setShowSimilarityModal(true)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                  >
                    <GitCompare className="w-3.5 h-3.5" /> View Similarity Matrix
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Risk Level</th>
                    <th className="py-3 px-4 text-center">Violations</th>
                    <th className="py-3 px-4 text-center">Tab Switches</th>
                    <th className="py-3 px-4 text-center">Copy/Pastes</th>
                    <th className="py-3 px-4 text-center">Similarity</th>
                    <th className="py-3 px-4">Login Device</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                        No students found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    studentSummaries.map((st: any) => (
                      <tr key={st.studentId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {st.studentName}
                          <div className="text-[10px] text-slate-400 font-normal">{st.department || 'Computer Science'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-600">{st.rollNumber}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            st.riskLevel === 'Green' ? 'bg-emerald-100 text-emerald-800' :
                            st.riskLevel === 'Yellow' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RISK_COLORS[st.riskLevel] }}></span>
                            {st.riskLevel === 'Green' ? 'Green (Clean)' : st.riskLevel === 'Yellow' ? 'Yellow (Minor)' : 'Red (High Risk)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{st.violationCount}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">{st.tabSwitchCount}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600">
                          {st.copyPasteCount} {st.largePasteCount > 0 && <span className="text-[10px] text-red-500 font-bold">({st.largePasteCount} large)</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono font-bold ${st.similarityScore >= 75 ? 'text-red-600' : st.similarityScore >= 50 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {st.similarityScore}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[140px]" title={st.loginDevice}>
                          {st.loginDevice}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => openStudentAudit(st.studentId)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Evidence Log
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Student Audit Evidence Log Modal */}
      {selectedStudentId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Student Malpractice Audit Trail</h3>
                <p className="text-xs text-slate-500">Evidence log & session behavior analysis</p>
              </div>
              <button onClick={() => setSelectedStudentId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {detailLoading || !studentDetail ? (
                <div className="py-12 text-center text-slate-500">Loading student evidence logs...</div>
              ) : (
                <>
                  {/* Student Summary Info */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{studentDetail.student.name}</h4>
                      <p className="text-xs text-slate-500">Roll Number: {studentDetail.student.rollNumber} | Dept: {studentDetail.student.department || 'CS'}</p>
                    </div>
                    <div className="flex gap-4 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Total Violations</span>
                        <p className="text-sm font-bold text-red-600">{studentDetail.behaviorStats.totalLogs}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Large Pastes</span>
                        <p className="text-sm font-bold text-amber-600">{studentDetail.behaviorStats.largePastes}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sessions Info */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Device & Login Sessions</h4>
                    <div className="space-y-2">
                      {studentDetail.sessions?.map((sess: any) => (
                        <div key={sess.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-slate-800">{sess.deviceInfo || 'Browser Session'}</span>
                            <div className="text-[10px] text-slate-400 font-mono">IP: {sess.ipAddress}</div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sess.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {sess.isActive ? 'Active' : 'Ended'}
                            </span>
                            <div className="text-[10px] text-slate-400">{new Date(sess.loginTime).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity Event Timeline */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Event Timeline Logs</h4>
                    {studentDetail.logs?.length === 0 ? (
                      <p className="text-xs text-slate-400">No suspicious events logged for this student.</p>
                    ) : (
                      <div className="space-y-3 relative border-l-2 border-slate-200 ml-3 pl-4">
                        {studentDetail.logs?.map((log: any) => (
                          <div key={log.id} className="relative bg-white border border-slate-200 p-3 rounded-lg text-xs shadow-xs">
                            <div className="absolute -left-[23px] top-3.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white"></div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800 uppercase tracking-tight text-[11px] text-red-600">
                                {log.eventType.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-slate-600">{log.details || "Suspicious browser activity recorded."}</p>
                            {log.duration > 0 && (
                              <span className="text-[10px] text-amber-700 font-semibold mt-1 inline-block">
                                Duration away: {log.duration} seconds
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code Similarity Inspection Modal */}
      {showSimilarityModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Code Similarity Comparison Matrix</h3>
                <p className="text-xs text-slate-500">Source code overlap detection results</p>
              </div>
              <button onClick={() => { setShowSimilarityModal(false); setSelectedPair(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {!selectedPair ? (
                <div className="space-y-3">
                  {similarityData.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-xs">No code similarity pairs computed yet.</p>
                  ) : (
                    similarityData.map((pair, idx) => (
                      <div key={idx} className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{pair.student1Name} ({pair.student1Roll})</span>
                            <span className="text-slate-400">vs</span>
                            <span>{pair.student2Name} ({pair.student2Roll})</span>
                          </div>
                          <span className="text-[10px] text-slate-500">Question: {pair.questionTitle || 'Coding Question'}</span>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            pair.similarityPercentage >= 80 ? 'bg-red-100 text-red-800' :
                            pair.similarityPercentage >= 60 ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {pair.similarityPercentage}% Similarity ({pair.status})
                          </span>

                          <button
                            onClick={() => setSelectedPair(pair)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Compare Code
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedPair(null)}
                    className="text-xs font-semibold text-blue-600 hover:underline mb-2 inline-block"
                  >
                    &larr; Back to Pair Matrix
                  </button>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900 flex justify-between">
                    <span>Comparing {selectedPair.student1Name} vs {selectedPair.student2Name}</span>
                    <span className="font-bold text-red-600">{selectedPair.similarityPercentage}% Overlap</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1">{selectedPair.student1Name}'s Code</div>
                      <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-auto h-72">
                        {selectedPair.student1Code || "// No code available"}
                      </pre>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1">{selectedPair.student2Name}'s Code</div>
                      <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs font-mono overflow-auto h-72">
                        {selectedPair.student2Code || "// No code available"}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
