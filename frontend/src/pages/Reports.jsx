import { useState, useEffect } from 'react'
import { reportsAPI } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { FileSpreadsheet, FileText, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

function downloadBlob(data, filename) {
  const url = URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [filters, setFilters] = useState({
    start_date: format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    class: '',
    subject: '',
  })

  useEffect(() => {
    reportsAPI.summary()
      .then(r => setSummary(r.data))
      .catch(() => toast.error('Failed to load summary'))
      .finally(() => setLoading(false))
  }, [])

  const exportFile = async (type) => {
    setExporting(type)
    try {
      const res = type === 'excel'
        ? await reportsAPI.exportExcel(filters)
        : await reportsAPI.exportPDF(filters)
      const ext = type === 'excel' ? 'xlsx' : 'pdf'
      downloadBlob(res.data, `attendance_report_${format(new Date(), 'yyyyMMdd')}.${ext}`)
      toast.success(`${type.toUpperCase()} exported!`)
    } catch { toast.error('Export failed') }
    finally { setExporting(null) }
  }

  const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#14b8a6']

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="card px-3 py-2 text-xs shadow-lg">
        <p className="font-medium mb-1">{label}</p>
        <p>Attendance: <span className="font-semibold">{payload[0].value}%</span></p>
        <p className="text-gray-400">Students: {payload[0].payload.students}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Export panel */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Export report</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input type="date" className="input w-36" value={filters.start_date}
              onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input type="date" className="input w-36" value={filters.end_date}
              onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class (optional)</label>
            <input className="input w-24" placeholder="10A" value={filters.class}
              onChange={e => setFilters(f => ({ ...f, class: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Subject (optional)</label>
            <input className="input w-36" placeholder="Mathematics" value={filters.subject}
              onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => exportFile('excel')}
              disabled={!!exporting}
              className="btn-secondary flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
            >
              {exporting === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
              Excel
            </button>
            <button
              onClick={() => exportFile('pdf')}
              disabled={!!exporting}
              className="btn-secondary flex items-center gap-2 text-red-500 border-red-200 hover:bg-red-50"
            >
              {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Class chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Class-wise attendance overview</h3>
        {loading
          ? <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          : summary.length === 0
            ? <p className="text-center text-sm text-gray-400 py-16">No data yet.</p>
            : <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '75%', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                  <Bar dataKey="pct" name="Attendance %" radius={[5, 5, 0, 0]}>
                    {summary.map((entry, i) => (
                      <Cell key={i} fill={entry.pct >= 75 ? COLORS[i % COLORS.length] : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
        }
      </div>

      {/* Summary table */}
      {summary.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Class summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['Class', 'Students', 'Attendance %', 'Status'].map(h => (
                    <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {summary.map(row => (
                  <tr key={row.class} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="table-cell font-semibold">{row.class}</td>
                    <td className="table-cell">{row.students}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                          <div
                            className={`h-full rounded-full ${row.pct >= 75 ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{row.pct}%</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={row.pct >= 75 ? 'badge-present' : 'badge-absent'}>
                        {row.pct >= 75 ? 'Above threshold' : 'Below 75%'}
                      </span>
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
