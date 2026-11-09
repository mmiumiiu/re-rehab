import { Link, useNavigate } from 'react-router-dom'
import { SectionTitle } from '../../components/ui.jsx'
import { Flame, Chart } from '../../components/icons.jsx'
import GameCards, { GAMES, useBestScores } from '../../components/GameCards.jsx'
import { useSessionHistory, trainingStreak } from '../../lib/useSessionHistory.js'

export default function Home() {
  const navigate = useNavigate()
  const { playedToday } = useBestScores()
  const gamesLeft = GAMES.filter((g) => !playedToday.has(g.id)).length

  const rows = useSessionHistory()
  const streak = trainingStreak(rows)

  return (
    <div className="max-w-[900px]">
      {/* Streak hero */}
      <div
        className="rounded-card p-7 mb-7 text-white flex items-center gap-6 relative overflow-hidden"
        style={{ background: '#5B50E0', boxShadow: '0 14px 32px rgba(91,80,224,.35)' }}
      >
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.16) 2px, transparent 2.6px)', backgroundSize: '26px 26px' }} />
        <div className="absolute -top-8 right-28 w-28 h-28 rounded-full" style={{ background: 'rgba(247,193,50,.25)' }} />
        <div className="relative flex-1 min-w-0">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill text-[13.5px] font-bold" style={{ background: '#F7C132', color: '#5C4400' }}>
            <Flame size={15} /> ฝึกต่อเนื่อง {streak} วัน
          </span>
          <div className="font-heading text-[27px] font-semibold mt-3 mb-1">{gamesLeft ? `วันนี้เหลืออีก ${gamesLeft} เกม 🎮` : 'วันนี้เล่นครบทุกเกมแล้ว 🎉'}</div>
          <div className="text-[14.5px] opacity-85">เล่นเกมฝึกทุกวันเพื่อรักษาสถิติของคุณ</div>
        </div>
        <button
          onClick={() => navigate('/games')}
          className="relative flex-shrink-0 rounded-[16px] font-heading font-bold text-[16px] px-7 min-h-[56px] active:translate-y-[3px] active:shadow-none transition-all"
          style={{ background: '#F7C132', color: '#3A2C00', border: '2.5px solid #D9A616', boxShadow: '0 4px 0 #D9A616' }}
        >
          เล่นเกม ›
        </button>
      </div>

      <SectionTitle>เลือกเกมฝึกวันนี้</SectionTitle>
      <GameCards />

      <Link
        to="/dashboard"
        className="mt-[18px] flex items-center justify-between rounded-[18px] px-5 py-4 min-h-[56px] font-bold"
        style={{ background: '#E7F0FE', color: '#1D5FBF' }}
      >
        <span className="flex items-center gap-3 text-[15px]">
          <span className="w-9 h-9 rounded-full text-white flex items-center justify-center" style={{ background: '#3D87E8' }}><Chart size={17} /></span>
          ดูสรุปผลและความคืบหน้าของคุณ
        </span>
        <span className="text-[20px]">›</span>
      </Link>
    </div>
  )
}
