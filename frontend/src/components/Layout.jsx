import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, ClipboardCheck, BarChart3,
  LogOut, Menu, X, Moon, Sun, Bell, ChevronRight, ScanFace
} from 'lucide-react'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { path: '/face-attendance', label: 'Face Attendance', icon: ScanFace },
  { path: '/students', label: 'Students', icon: Users },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [dark, setDark] = useState(false)

  const toggleDark = () => {
    setDark(d => !d)
    document.documentElement.classList.toggle('dark')
  }

  const handleLogout = () => { logout(); navigate('/login') }
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200`}>
        <div className="h-14 flex items-center px-4 gap-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <img src="/logo.jpg" alt="logo" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 shadow-sm" />
          {sidebarOpen && <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">Kalpavriksha</span>}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <button key={path} onClick={() => navigate(path)}
                className={`sidebar-link w-full ${active ? 'active' : ''}`}>
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
                {sidebarOpen && active && <ChevronRight size={14} className="ml-auto" />}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300">{initials}</div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
            <LogOut size={16} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
            {navItems.find(n => n.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 relative">
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}