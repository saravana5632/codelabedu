import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api.ts';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts';
import { Download, Users, CheckCircle, XCircle, Clock, Award, AlertTriangle, FileText, DownloadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function TestAnalytics() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'score' | 'time' | 'rank'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    api.get(`/analytics/test/${id}`).then(res => {
      setData(res.data);
    }).catch(err => console.error(err)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading Analytics...</div>;
  if (!data) return <div>Error loading data.</div>;

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.submissions.map((s:any) => ({
      'Roll Number': s.studentId,
      'Score': s.score || 0,
      'Execution Time': s.execTimeMs ? `${s.execTimeMs}ms` : 'N/A',
      'Language': s.language,
      'Status': s.status,
      'Submitted At': new Date(s.submittedAt).toLocaleString()
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Submissions");
    XLSX.writeFile(wb, `test_${id}_submissions.xlsx`);
  };

  // Compute sorted and filtered performers
  const topPerformers = [...(data.submissions || [])]
    .filter((s:any) => 
      (s.studentId?.toString() || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (s.studentRoll || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (s.studentName || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    )
    .sort((a:any, b:any) => {
      let comparison = 0;
      if (sortField === 'score') {
        comparison = (a.score || 0) - (b.score || 0);
      } else if (sortField === 'time') {
        const timeA = new Date(a.submittedAt).getTime();
        const timeB = new Date(b.submittedAt).getTime();
        comparison = timeA - timeB;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

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
    { name: 'Submitted', value: data.summary.submitted },
    { name: 'Pending', value: data.summary.notSubmitted }
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Test Analytics (Test ID: {id})</h2>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700"><DownloadCloud className="w-4 h-4"/> Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total Students</p>
          <p className="text-2xl font-bold">{data.summary.totalStudents}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Started</p>
          <p className="text-2xl font-bold">{data.summary.started}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Submitted</p>
          <p className="text-2xl font-bold text-blue-600">{data.summary.submitted}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-gray-700">{data.summary.notSubmitted}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Pass</p>
          <p className="text-2xl font-bold text-green-600">{data.summary.passCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Fail</p>
          <p className="text-2xl font-bold text-red-600">{data.summary.failCount}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Average Score</p>
          <p className="text-2xl font-bold text-indigo-600">{data.summary.avgScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Highest Score</p>
          <p className="text-2xl font-bold text-teal-600">{data.summary.highestScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Lowest Score</p>
          <p className="text-2xl font-bold text-rose-600">{data.summary.lowestScore}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Average Execution Time</p>
          <p className="text-2xl font-bold text-orange-600">{data.summary.avgExecTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pass vs Fail */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold mb-4 shrink-0">Pass vs Fail</h3>
          <div className="flex-1 min-h-0 relative">
            {!hasSubmissions && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No submissions yet.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data.passFail} 
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
                  {data.passFail.map((entry:any, index:number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Submission Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold mb-4 shrink-0">Submission Status</h3>
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
                  <Cell fill="#D1D5DB" />
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language Usage */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[320px] flex flex-col relative">
          <h3 className="text-lg font-bold mb-4 shrink-0">Language Usage</h3>
          <div className="flex-1 min-h-0 relative">
            {(!data.languageUsage || data.languageUsage.length === 0 || !hasSubmissions) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <p className="text-gray-500 font-medium">No language data available.</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.languageUsage}>
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
          <h3 className="text-lg font-bold mb-4 shrink-0">Submission Timeline</h3>
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
          <h3 className="text-lg font-bold mb-4 shrink-0">Score Distribution</h3>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-lg">Top Performers</h3>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search Student ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('score')}
                >
                  <div className="flex items-center gap-1">
                    Score
                    {sortField === 'score' && (
                      <span className="text-gray-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('time')}
                >
                  <div className="flex items-center gap-1">
                    Time
                    {sortField === 'time' && (
                      <span className="text-gray-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topPerformers.length > 0 ? (
                topPerformers.slice(0, 10).map((sub:any, idx:number) => (
                  <tr key={sub.studentId || sub.id || idx}>
                    <td className="px-6 py-4">#{idx + 1}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{sub.studentRoll || sub.studentId}</td>
                    <td className="px-6 py-4 font-semibold text-green-600">{sub.score || 0}</td>
                    <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleString()}</td>
                    <td className="px-6 py-4 text-orange-600">{sub.execTimeMs ? `${sub.execTimeMs}ms` : 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No submissions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Submissions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-lg">All Submissions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.submissions.map((sub:any, idx:number) => (
                <tr key={sub.id || sub.studentId || idx}>
                  <td className="px-6 py-4 font-medium text-gray-900">{sub.studentRoll || sub.studentId}</td>
                  <td className="px-6 py-4">{sub.language}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${(sub.status || '').toLowerCase().includes('pass') || (sub.status || '').toLowerCase().includes('accept') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(sub.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
