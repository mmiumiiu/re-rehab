import { Link } from 'react-router-dom'
import { useSessionHistory } from '../lib/useSessionHistory.js'

export const GAMES = [
  {
    id: 'fruit',
    to: '/games/fruit',
    emoji: '🍉🔪',
    title: 'เกมฟันผลไม้',
    tags: ['LSVT BIG', 'LSVT LOUD'],
    desc: 'ผลไม้จะโผล่ที่ขอบจอ กางแขนเอื้อมไปให้สุด แล้วพูด "อา" ดังๆ เพื่อฟัน',
    meta: '60 วินาที · ใช้กล้อง + ไมค์',
    bg: '#FDE8E4', accent: '#E8554D', dark: '#7A241F', shadow: '#B33630',
  },
  {
    id: 'runner',
    to: '/games/runner',
    emoji: '🏃‍♂️🚧',
    title: 'เกมวิ่งหลบสิ่งกีดขวาง',
    tags: ['LSVT BIG'],
    desc: 'ถนน 3 เลน ก้าวเท้ากว้างๆ ไปซ้าย/ขวาเพื่อสไลด์เปลี่ยนเลน หลบสิ่งกีดขวางและเก็บเหรียญ',
    meta: '90 วินาที · ใช้กล้อง',
    bg: '#E3F6E9', accent: '#2FA65A', dark: '#14522B', shadow: '#1E7A40',
  },
]

export function useBestScores() {
  const rows = useSessionHistory()
  const best = {}
  for (const r of rows) {
    if (!r.game) continue
    best[r.game] = Math.max(best[r.game] ?? 0, r.points ?? 0)
  }
  const playedToday = new Set(rows.filter((r) => r.game && new Date(r.ts).toDateString() === new Date().toDateString()).map((r) => r.game))
  return { best, playedToday }
}

export default function GameCards() {
  const { best, playedToday } = useBestScores()
  return (
    <div className={`grid gap-[18px] ${GAMES.length > 1 ? 'md:grid-cols-2' : 'max-w-[460px]'}`}>
      {GAMES.map((g) => (
        <div key={g.id} className="rounded-card p-6 flex flex-col" style={{ background: g.bg }}>
          <div className="flex items-start justify-between mb-3">
            <div className="text-[46px] leading-none">{g.emoji}</div>
            {playedToday.has(g.id) && (
              <span className="text-[12px] font-bold px-3 py-1.5 rounded-pill bg-white" style={{ color: g.dark }}>✓ เล่นแล้ววันนี้</span>
            )}
          </div>
          <h3 className="font-heading text-[22px] font-semibold mb-1.5" style={{ color: g.dark }}>{g.title}</h3>
          <div className="flex gap-1.5 mb-2.5">
            {g.tags.map((t) => (
              <span key={t} className="text-[11.5px] font-bold px-2.5 py-1 rounded-md bg-white" style={{ color: g.accent }}>{t}</span>
            ))}
          </div>
          <p className="text-[14.5px] mb-2" style={{ color: g.dark }}>{g.desc}</p>
          <p className="text-[13px] font-semibold mb-4 opacity-80" style={{ color: g.dark }}>
            {g.meta}{best[g.id] ? ` · คะแนนสูงสุด ${best[g.id]}` : ''}
          </p>
          <Link
            to={g.to}
            className="mt-auto text-center rounded-btn font-heading font-bold text-[16px] py-3.5 text-white active:translate-y-[3px] active:shadow-none transition-all"
            style={{ background: g.accent, border: `2.5px solid ${g.shadow}`, boxShadow: `0 4px 0 ${g.shadow}` }}
          >
            เล่นเลย ›
          </Link>
        </div>
      ))}
    </div>
  )
}
