import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({ baseURL: BASE_URL })

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async err => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refresh}` }
        })
        localStorage.setItem('access_token', data.access_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api(err.config)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (data) => api.post('/auth/signup', data),
  me: () => api.get('/auth/me'),
  users: () => api.get('/auth/users'),
}

// ── Students ──────────────────────────────────────────
export const studentsAPI = {
  list: (params) => api.get('/students/', { params }),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students/', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  importExcel: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post('/students/import-excel', fd)
  },
  classes: () => api.get('/students/classes'),
}

// ── Attendance ────────────────────────────────────────
export const attendanceAPI = {
  mark: (records) => api.post('/attendance/mark', { records }),
  list: (params) => api.get('/attendance/', { params }),
  stats: () => api.get('/attendance/stats'),
  bulkUpload: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post('/attendance/bulk-upload', fd)
  },
}

// ── Reports ────────────────────────────────────────────
export const reportsAPI = {
  summary: () => api.get('/reports/summary'),
  exportExcel: (params) => api.get('/reports/export/excel', { params, responseType: 'blob' }),
  exportPDF: (params) => api.get('/reports/export/pdf', { params, responseType: 'blob' }),
}

// ── SMS ───────────────────────────────────────────────
export const smsAPI = {
  send: (student_id, message) => api.post('/sms/send', { student_id, message }),
}

export default api
