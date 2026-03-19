import { useState, useEffect, useCallback } from 'react'
import { studentsAPI, attendanceAPI } from '../services/api'
import { Search, Upload, CheckCircle2, XCircle, Loader2, Filter, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const SUBJECTS = ['General', 'Mathematics', 'Science', 'English', 'History', 'Computer Science', 'Physical Education']

export default function Attendance() {
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [attendance, setAttendance] = useState({}) // { student_id: 'present'|'absent' }
  const [filters, setFilters] = useState({ class: '', subject: 'General', date: format(new Date(), 'yyyy-MM-dd'), search: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load classes
  useEffect(() => {
    studentsAPI.classes().then(r => setClasses(r.data)).catch(() => {})
  }, [])

  // Load students + existing attendance when filters change
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, aRes] = await Promise.all([
        studentsAPI.list({ class: filters.class, stats: false }),
        attendanceAPI.list({ date: filters.date, subject: filters.subject, class: filters.class }),
      ])
      setStudents(sRes.data)
      // Pre-fill attendance map from existing records
      const map = {}
      aRes.data.forEach(r => { map[r.student_id] = r.status })
      // Default unmarked students to absent
      sRes.data.forEach(s => { if (!map[s.student_id]) map[s.student_id] = 'absent' })
      setAttendance(map)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }, [filters.class, filters.subject, filters.date])

  useEffect(() => { loadData() }, [loadData])

  const toggle = (sid) => setAttendance(a => ({ ...a, [sid]: a[sid] === 'present' ? 'absent' : 'present' }))

  const markAll = (status) => {
    const map = {}
    filtered.forEach(s => { map[s.student_id] = status })
    setAttendance(a => ({ ...a, ...map }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const records = students.map(s => ({
        student_id: s.student_id,
        status: attendance[s.student_id] || 'absent',
        date: filters.date,
        subject: filters.subject,
      }))
      const res = await attendanceAPI.mark(records)
      toast.success(`Saved! Present: ${records.filter(r => r.status === 'present').length} | SMS sent: ${res.data.sms_sent}`)
    } catch { toast.error('Failed to save attendance') }
    finally { setSaving(false) }
  }

  const uploadExcel = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try {
      const res = await attendanceAPI.bulkUpload(file)
      toast.success(`Imported: ${res.data.created} new, ${res.data.updated} updated`)
      loadData()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(filters.search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(filters.search.toLowerCase())
  )

  const presentCount = Object.values(attendance).filter(v => v === 'present').length
  const pct = students.length ? Math.round(presentCount / students.length * 100) : 0

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" className="input w-36" value={filters.date}
              onChange={e => setFilters(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class</label>
            <select className="input w-28" value={filters.class}
              onChange={e => setFilters(f => ({ ...f, class: e.target.value }))}>
              <option value="">All</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Subject</label>
            <select className="input w-40" value={filters.subject}
              onChange={e => setFilters(f => ({ ...f, subject: e.target.value }))}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8" placeholder="Name or ID…"
                value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
          </div>
          <label className="btn-secondary flex items-center gap-2 cursor-pointer">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload Excel'}
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={uploadExcel} />
          </label>
        </div>
      </div>

      {/* Summary + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pct}%</span>
          </div>
          <span className="text-sm text-gray-500">{presentCount} / {students.length} present</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => markAll('present')} className="btn-secondary flex items-center gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
            <CheckCircle2 size={14} /> All Present
          </button>
          <button onClick={() => markAll('absent')} className="btn-secondary flex items-center gap-1.5 text-red-500 border-red-200 hover:bg-red-50">
            <XCircle size={14} /> All Absent
          </button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading
          ? <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          : filtered.length === 0
            ? <div className="text-center py-20 text-gray-400 text-sm">No students found. Import students first.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      {['Student ID', 'Name', 'Class', 'Status', 'Toggle'].map(h => (
                        <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map(s => {
                      const status = attendance[s.student_id] || 'absent'
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="table-cell font-mono text-xs">{s.student_id}</td>
                          <td className="table-cell font-medium">{s.name}</td>
                          <td className="table-cell">{s.class_name}{s.section ? `-${s.section}` : ''}</td>
                          <td className="table-cell">
                            <span className={status === 'present' ? 'badge-present' : 'badge-absent'}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => toggle(s.student_id)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${status === 'present' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${status === 'present' ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>
    </div>
  )
}
