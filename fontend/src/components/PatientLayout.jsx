import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, Gamepad, Chart, User, Chat } from './icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// Colorful nav — one hue per item (indigo / green / blue / red / pink)
const NAV = [
  { to: '/home', label: 'หน้าแรก', icon: Home, color: '#5B50E0', tint: '#EFEBFE' },
  { to: '/games', label: 'เกมฝึก', icon: Gamepad, match: '/games', color: '#2FA65A', tint: '#E3F6E9' },
  { to: '/dashboard', label: 'สรุปผล', icon: Chart, color: '#3D87E8', tint: '#E7F0FE' },
  { to: '/chat', label: 'แชท', icon: Chat, color: '#E8554D', tint: '#FDE8E4' },
  { to: '/profile', label: 'โปรไฟล์', icon: User, match: '/profile', color: '#D9538F', tint: '#FBE7F1' },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return { text: 'สวัสดีตอนดึก', emoji: '🌙' }
  if (h < 12) return { text: 'สวัสดีตอนเช้า', emoji: '☀️' }
  if (h < 17) return { text: 'สวัสดีตอนบ่าย', emoji: '🌤️' }
  if (h < 20) return { text: 'สวัสดีตอนเย็น', emoji: '🌇' }
  return { text: 'สวัสดีตอนค่ำ', emoji: '🌙' }
}

// Re-renders every minute so the greeting tracks the real time of day.
function useGreeting() {
  const [g, setG] = useState(greeting)
  useEffect(() => {
    const id = setInterval(() => setG(greeting()), 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return g
}

function isOn(match, isActive) {
  return isActive || (match && location.pathname.startsWith(match))
}

export default function PatientLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const name = user?.name || 'ผู้ใช้งาน'
  const initials = name.slice(0, 2)
  const hello = useGreeting()

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[236px] flex-shrink-0 flex-col p-4 bg-surface border-r border-line">
        <div className="mb-6 px-1.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-white border border-line flex items-center justify-center overflow-hidden" style={{ boxShadow: '0 6px 14px rgba(47,166,90,.22)' }}>
            <img src="/logo.png" alt="RehabAI" className="w-[30px] h-[30px] object-contain" />
          </div>
          <b className="font-heading text-[17px] text-ink-primary">RehabAI</b>
        </div>
        <nav className="flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon, match, color, tint }) => (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 rounded-2xl text-[15px] font-bold min-h-[52px] transition-all"
              style={({ isActive }) => (isOn(match, isActive)
                ? { background: color, color: '#fff', boxShadow: `0 8px 18px ${color}55` }
                : { background: 'transparent', color: '#2B2650' })}
            >
              {({ isActive }) => {
                const on = isOn(match, isActive)
                return (
                  <>
                    <span className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center flex-shrink-0" style={on ? { background: 'rgba(255,255,255,.25)', color: '#fff' } : { background: tint, color }}>
                      <Icon size={18} />
                    </span>
                    {label}
                  </>
                )
              }}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 px-1 py-3.5 border-t border-line">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0" style={{ background: '#F7C132', color: '#5C4400' }}>{initials}</div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-ink-primary truncate">{name}</div>
            <div className="text-[11.5px] text-ink-muted">ผู้ป่วย · {user?.parkinsonStage === 'stage2' ? 'ระยะ 2' : 'ระยะ 1'}</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 bg-bg flex flex-col">
        <header className="flex justify-between items-center px-4 md:px-8 py-4 border-b border-line bg-surface">
          <div>
            <p className="text-[13px] text-ink-secondary m-0">{hello.text} {hello.emoji}</p>
            <p className="font-heading text-[16px] md:text-[18px] font-semibold text-ink-primary m-0 truncate max-w-[180px] md:max-w-none">{name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/profile')} title="โปรไฟล์" className="w-11 h-11 rounded-[14px] flex items-center justify-center text-[12px] font-bold" style={{ background: '#FBE7F1', color: '#B03A76' }}>
              {initials}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <div className="max-w-[960px] mx-auto w-full px-4 md:px-8 py-5 md:py-7">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-line bg-surface">
        {NAV.map(({ to, label, icon: Icon, match, color }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition-colors"
            style={({ isActive }) => ({ color: isOn(match, isActive) ? color : '#9B95BD' })}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
