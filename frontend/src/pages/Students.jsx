import { useState, useEffect } from 'react'
import { studentsAPI } from '../services/api'
import { Plus, Search, Upload, Edit2, Trash2, Loader2, X, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_FORM = { student_id: '', name: '', class_name: '', section: '', parent_phone: '', parent_name: '', email: '' }

function StudentModal({ student, onClose, onSaved }) {
  const [form, setForm] = useState(student || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const isEdit = !!student

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      if (isEdit) await studentsAPI.update(student.id, form)
      else await studentsAPI.create(form)
      toast.success(isEdit ? 'Student updated' : 'Student created')
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  const fields = [
    { key: 'student_id', label: 'Student ID', required: true, placeholder: 'STU001' },
    { key: 'name', label: 'Full Name', required: true, placeholder: 'John Doe' },
    { key: 'class_name', label: 'Class', required: true, placeholder: '10A' },
    { key: 'section', label: 'Section', placeholder: 'A' },
    { key: 'parent_phone', label: 'Parent Phone (for SMS)', placeholder: '+91 9999999999' },
    { key: 'parent_name', label: 'Parent Name', placeholder: 'Mr. Doe' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'student@school.edu' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">{isEdit ? 'Edit Student' : 'Add Student'}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{f.label}{f.required && ' *'}</label>
              <input
                type={f.type || 'text'}
                className="input"
                placeholder={f.placeholder}
                value={form[f.key] || ''}
                onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                required={f.required}
                disabled={isEdit && f.key === 'student_id'}
              />
            </div>
          ))}
        </form>
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Students() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [classes, setClasses] = useState([])
  const [modal, setModal] = useState(null) // null | 'add' | student object
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([studentsAPI.list({ stats: true }), studentsAPI.classes()])
      setStudents(s.data); setClasses(c.data)
    } catch { toast.error('Failed to load students') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this student?')) return
    try { await studentsAPI.delete(id); toast.success('Student deactivated'); load() }
    catch { toast.error('Failed to delete') }
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try {
      const res = await studentsAPI.importExcel(file)
      toast.success(`Imported: ${res.data.created} new, ${res.data.updated} updated`)
      load()
    } catch { toast.error('Import failed') }
    finally { setUploading(false); e.target.value = '' }
  }

  const filtered = students.filter(s =>
    (s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase())) &&
    (!classFilter || s.class_name === classFilter)
  )

  return (
    <div className="space-y-4">
      {modal && (
        <StudentModal
          student={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Search by name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-32" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="btn-secondary flex items-center gap-2 cursor-pointer">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Importing…' : 'Import Excel'}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        </label>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add Student
        </button>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-500">{filtered.length} student{filtered.length !== 1 ? 's' : ''} shown</p>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading
          ? <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          : filtered.length === 0
            ? <div className="text-center py-24 text-gray-400 text-sm">No students yet. Import from Excel or add manually.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      {['Student ID', 'Name', 'Class', 'Parent Phone', 'Attendance %', 'Actions'].map(h => (
                        <th key={h} className="table-header px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="table-cell font-mono text-xs">{s.student_id}</td>
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                            {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                          </div>
                        </td>
                        <td className="table-cell">{s.class_name}{s.section ? `-${s.section}` : ''}</td>
                        <td className="table-cell">{s.parent_phone || <span className="text-gray-300">—</span>}</td>
                        <td className="table-cell">
                          {s.total_classes > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                                <div
                                  className={`h-full rounded-full ${s.attendance_pct >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${s.attendance_pct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${s.attendance_pct >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                {s.attendance_pct}%
                              </span>
                            </div>
                          ) : <span className="text-xs text-gray-300">No records</span>}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setModal(s)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-blue-600">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-gray-500 hover:text-red-600">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>
    </div>
  )
}
