import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Loader2, Shield, GraduationCap, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome, ${user.name}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Blurred background — trust group photo */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/trust-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(6px)',
          transform: 'scale(1.05)',
        }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo centred above card */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.jpg" alt="Kalpavriksha" className="h-24 w-auto drop-shadow-lg" />
          <p className="text-white text-sm mt-2 font-medium tracking-wide">Attendance Management System</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Sign in</h2>
          <p className="text-xs text-gray-500 mb-6">Enter your credentials to continue</p>

          {/* Role badges */}
          <div className="flex gap-2 mb-5">
            {[
              { role: 'Admin', color: 'bg-red-50 text-red-600 border-red-100', icon: Shield },
              { role: 'Teacher', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: GraduationCap },
              { role: 'Student', color: 'bg-green-50 text-green-600 border-green-100', icon: Bell },
            ].map(({ role, color, icon: Icon }) => (
              <div key={role} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${color}`}>
                <Icon size={10} />{role}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input type="email" className="input" placeholder="admin@trust.edu"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="••••••••"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs text-gray-500">Email: <span className="font-mono text-gray-800 dark:text-gray-200">admin@trust.edu</span></p>
            <p className="text-xs text-gray-500 mt-1">Password: <span className="font-mono text-gray-800 dark:text-gray-200">Admin@1234</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}