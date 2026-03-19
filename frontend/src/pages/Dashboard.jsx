import { useState, useEffect } from 'react'
import { attendanceAPI, reportsAPI } from '../services/api'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Users, UserCheck, UserX, TrendingUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="stat-card">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={15} />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [classSummary, setClassSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([attendanceAPI.stats(), reportsAPI.summary()])
      .then(([s, c]) => { setStats(s.data); setClassSummary(c.data) })
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-blue-500" size={28} />
    </div>
  )

  const BAR_COLORS = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981']

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats?.total_students ?? 0} icon={Users}
          color="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400" />
        <StatCard label="Present Today" value={stats?.present_today ?? 0} icon={UserCheck}
          color="bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400" />
        <StatCard label="Absent Today" value={stats?.absent_today ?? 0} icon={UserX}
          color="bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" />
        <StatCard label="Overall Attendance" value={`${stats?.overall_pct ?? 0}%`} icon={TrendingUp}
          color="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
          sub={stats?.overall_pct >= 75 ? 'Above threshold ✓' : 'Below 75% threshold'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Weekly attendance trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats?.weekly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="pct" name="Attendance %" stroke="#3b82f6" strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Class-wise bar chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Class-wise attendance</h3>
          {classSummary.length === 0
            ? <p className="text-sm text-gray-400 text-center mt-16">No data yet — import students first</p>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classSummary} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="pct" name="Attendance %" radius={[4, 4, 0, 0]}>
                    {classSummary.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Weekly table */}
      {stats?.weekly_trend?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Last 7 days breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Date', 'Day', 'Present', 'Absent', 'Attendance %'].map(h => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.weekly_trend.map(row => (
                  <tr key={row.date} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="table-cell">{row.date}</td>
                    <td className="table-cell font-medium">{row.day}</td>
                    <td className="table-cell text-green-600 dark:text-green-400">{row.present}</td>
                    <td className="table-cell text-red-500 dark:text-red-400">{row.absent}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full max-w-[80px]">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className="text-xs font-medium">{row.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
