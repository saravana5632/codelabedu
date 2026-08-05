import React, { useEffect, useState } from 'react';
import api from '../../lib/api.js';
import { Users, FileText, CheckCircle, Clock, BookOpen, GraduationCap } from 'lucide-react';

export default function DashboardHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/dashboard').then(res => {
      setStats(res.data);
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!stats) return <div>Error loading dashboard data</div>;

  const cards = [
    { label: "Total Students", value: stats.totalStudents, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total Tests", value: stats.totalTests, icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Active Tests", value: stats.activeTests, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Completed Tests", value: stats.completedTests, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Total Submissions", value: stats.totalSubmissions, icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Avg Pass Rate", value: `${stats.avgPassPercentage}%`, icon: GraduationCap, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`p-4 rounded-lg ${card.bg}`}>
                <Icon className={`w-8 h-8 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
