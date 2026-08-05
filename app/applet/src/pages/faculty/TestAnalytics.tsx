import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api.ts';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts';
import { ArrowLeft, DownloadCloud, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function TestAnalytics() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'score' | 'time'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/analytics/test/${id}`)
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error("Error fetching analytics:", err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || !data.summary) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500 font-medium mb-4">Error loading analytics or test data not found.</p>
        <Link to="/faculty/tests" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Tests
        </Link>
      </div>
    );
  }

  const exportExcel = () => {
    const list = data.allSubmissions && data.allSubmissions.length > 0 ? data.allSubmissions : data.submissions;
    const ws = XLSX.utils.json_to_sheet(
      (list || []).map((s: any) => ({
        'Roll Number': s.studentRoll || s.studentId || 'N/A',
        'Student Name': s.studentName || 'N/A',
        'Score': s.score ?? 0,
        'Execution Time': s.execTimeMs ? `${s.execTimeMs}ms` : 'N/A',
        'Language': s.language || 'N/A',
        'Status': s.status || 'N/A',
        'Submitted At': s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    XLSX.writeFile(wb, `test_${id}_analytics.xlsx`);
  };

  // Compute sorted and filtered performers
  const topPerformers = [...(data.submissions || [])]
    .filter((s: any) => {
      const term = searchTerm.toLowerCase();
      const roll = (s.studentRoll || '').toLowerCase();
      const name = (s.studentName || '').toLowerCase();
      const idStr = (s.studentId || '').toString();
      return roll.includes(term) || name.includes(term) || idStr.includes(term);
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (sortField === 'score') {
        comparison = (a.score || 0) - (b.score || 0);
      } else if (sortField === 'time') {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const allSubmissionsList = [...(data.allSubmissions && data.allSubmissions.length > 0 ? data.allSubmissions : data.submissions || [])];

  const hasSubmissions = data.summary.submitted > 0;
  const timelineData = hasSubmissions && data.timeline?.length > 0 ? data.timeline : [];

  const scoreDistribution = hasSubmissions && data.scoreDistribution ? data.scoreDistribution : [
    { range: '0-20', count: 0 },
    { range: '21-40', count: 0 },
    { range: '41-60', count: 0 },
    { range: '61-80', count: 0 },
    { range: '81-100', count: 0 },
  ];

  const submissionStatus = [
    { name: 'Submitted', value: data.summary.submitted || 0 },
    { name: 'Pending', value: data.summary.notSubmitted || 0 }
  ];

  const handleSort = (field: 'score' | 'time') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/faculty/tests" className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {data.test?.title ? `${data.test.title} — Analytics` : `Test Analytics (Test ID: ${id})`}
            </h2>
            <p className="text-sm text-gray-500">{data.test?.subject || "Subject N/A"}</p>
          </div>
        </div>
        <button 
          onClick={exportExcel} 
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <DownloadCloud className="w-4 h-4"/> Export Excel
        </button>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalStudents}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Attempted</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.started}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{data.summary.submitted}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{data.summary.notSubmitted}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pass Count</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{data.summary.passCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Fail Count</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{data.summary.failCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average Score</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{data.summary.avgScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Highest Score</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{data.summary.highestScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Lowest Score</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{data.summary.lowestScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Avg Exec Time</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{data.summary.avgExecTime}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pass vs Fail */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Pass vs Fail</h3>
          <div className="flex-1 min-h-0 relative">
            {!hasSubmissions && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No submissions yet.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data.passFail || []} 
                  cx="50%" cy="50%" 
                  innerRadius={55} 
                  outerRadius={80} 
                  fill="#8884d8" 
                  paddingAngle={5} 
                  dataKey="value"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    if (value === 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                        {value}
                      </text>
                    );
                  }}
                >
                  {(data.passFail || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Submission Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Submission Status</h3>
          <div className="flex-1 min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={submissionStatus} 
                  cx="50%" cy="50%" 
                  innerRadius={45} 
                  outerRadius={80} 
                  fill="#8884d8" 
                  dataKey="value"
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                    if (value === 0) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
                        {value}
                      </text>
                    );
                  }}
                >
                  <Cell fill="#3B82F6" />
                  <Cell fill="#E5E7EB" />
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language Usage */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Language Usage</h3>
          <div className="flex-1 min-h-0 relative">
            {!hasSubmissions && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No language data.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.languageUsage || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submission Timeline */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Submission Timeline</h3>
          <div className="flex-1 min-h-0 relative">
            {!hasSubmissions && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No submissions yet.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} domain={[0, 'auto']} tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="submissions" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Score Distribution</h3>
          <div className="flex-1 min-h-0 relative">
            {!hasSubmissions && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No scores available.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} domain={[0, 'auto']} tick={{ fontSize: 12 }} />
                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} />
                <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Student Performance Summary</h3>
            <p className="text-xs text-gray-500">Aggregated scores and details by student</p>
          </div>
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Search Name or Roll No..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"
            />
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center gap-1">
                    Score
                    {sortField === 'score' && (
                      <span className="text-blue-600">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('time')}
                >
                  <div className="flex items-center gap-1">
                    Latest Submission
                    {sortField === 'time' && (
                      <span className="text-blue-600">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {topPerformers.length > 0 ? (
                topPerformers.map((sub: any, idx: number) => (
                  <tr key={sub.studentId || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-600">#{idx + 1}</td>
                    <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{sub.studentRoll || sub.studentId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{sub.studentName || 'Student'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-emerald-600">{sub.score ?? 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-medium">
                        {sub.language || 'Python'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No student submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Submissions Log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
          <h3 className="font-bold text-lg text-gray-900">All Individual Submissions</h3>
          <p className="text-xs text-gray-500">Detailed list of every submitted answer for this assessment</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {allSubmissionsList.length > 0 ? (
                allSubmissionsList.map((sub: any, idx: number) => {
                  const statusStr = sub.status ? String(sub.status) : "Submitted";
                  const isAccepted = statusStr.toLowerCase().includes('accept') || statusStr.toLowerCase().includes('pass');
                  return (
                    <tr key={sub.id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">{sub.studentRoll || sub.studentId}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{sub.studentName || 'Student'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          {sub.language || 'Python'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {statusStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No submissions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
