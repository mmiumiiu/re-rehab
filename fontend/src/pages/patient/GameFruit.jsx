import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCamera, useMicLevel } from '../../lib/useCamera.js'
import { usePoseLandmarker } from '../../lib/usePoseLandmarker.js'
import { useFallDetector } from '../../lib/useFallDetector.js'
import { toScreen, loudTarget, useLatest, fmtClock, sfx } from '../../lib/gameShared.js'
import { sessionHistory } from '../../lib/services.js'
import SOSButton from '../../components/SOSButton.jsx'
import FallAlert from '../../components/FallAlert.jsx'
import { ArrowLeft, Mic, Refresh, Home } from '../../components/icons.jsx'
import { Overlay, StatusLine } from '../../components/GameUI.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Game 1 — ฟันผลไม้ (LSVT BIG + LSVT LOUD)
// Fruits appear near the EDGES of the screen so the patient must reach wide and
// high (big movements). A fruit is only cut when a hand touches it WHILE the
// patient says "อา" at or above the loudness target.
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_SEC = 60
const FRUIT_LIFE = 5.5        // seconds a fruit stays before it is missed
const SPAWN_EVERY = 1.7       // seconds between spawns
const MAX_FRUITS = 3
const VOICE_HOLD_MS = 400     // a loud "อา" keeps the blade active this long

const FRUITS = [
  { e: '🍉', c: '#E8554D' }, { e: '🍎', c: '#E5234F' }, { e: '🍊', c: '#F59E0B' },
  { e: '🍋', c: '#EAB308' }, { e: '🍇', c: '#7C3AED' }, { e: '🍍', c: '#D9A616' },
  { e: '🥝', c: '#65A30D' }, { e: '🍑', c: '#FB923C' },
]

// Spawn zones (fractions of the screen) — all away from the centre so the
// patient has to stretch: far left, far right, and high up.
const ZONES = [
  { x: [0.06, 0.2], y: [0.18, 0.72] },
  { x: [0.8, 0.94], y: [0.18, 0.72] },
  { x: [0.22, 0.42], y: [0.08, 0.2] },
  { x: [0.58, 0.78], y: [0.08, 0.2] },
]
const rnd = (a, b) => a + Math.random() * (b - a)

const HANDS = [[15, 19], [16, 20]] // [wrist, index] for each hand

export default function GameFruit() {
  const navigate = useNavigate()
  // ?debug=1 → mouse acts as a hand and holding Space counts as a loud "อา" (demo/testing)
  const [params] = useSearchParams()
  const debug = params.get('debug') === '1'
  const mouseRef = useRef(null)
  const spaceRef = useRef(false)
  const [phase, setPhase] = useState('intro') // intro | countdown | play | end
  const [count, setCount] = useState(3)
  const [hud, setHud] = useState({ score: 0, sliced: 0, missed: 0, combo: 0, left: ROUND_SEC })
  const [result, setResult] = useState(null)

  const { videoRef, status } = useCamera(true)
  const { landmarks, ready: poseReady } = usePoseLandmarker(videoRef, status === 'live')
  const { db, status: micStatus } = useMicLevel(phase !== 'intro')
  const { fallen, dismiss } = useFallDetector(landmarks, phase === 'play')

  const target = useRef(loudTarget()).current
  const lmRef = useLatest(landmarks)
  const dbRef = useLatest(db)
  const phaseRef = useLatest(phase)
  const pausedRef = useLatest(fallen)
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!debug) return
    const mv = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY } }
    const kd = (e) => { if (e.code === 'Space') { spaceRef.current = true; e.preventDefault() } }
    const ku = (e) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('pointermove', mv); window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  }, [debug])

  // ── countdown (mic calibrates during the first second — stay quiet) ──────
  useEffect(() => {
    if (phase !== 'countdown') return
    setCount(3)
    sfx('tick')
    let n = 3
    const id = setInterval(() => {
      n -= 1
      if (n <= 0) { clearInterval(id); sfx('go'); setPhase('play') }
      else { setCount(n); sfx('tick') }
    }, 1000)
    return () => clearInterval(id)
  }, [phase])

  // ── main game loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const g = {
      fruits: [], pieces: [], parts: [], pops: [], trails: [[], []],
      score: 0, sliced: 0, missed: 0, combo: 0, best: 0, peakDb: 0, voicedMs: 0,
      lastVoice: -1e9, spawnIn: 0.6, left: ROUND_SEC, last: performance.now(), hudAt: 0,
    }
    let raf

    function spawn(W, H) {
      const z = ZONES[Math.floor(Math.random() * ZONES.length)]
      const f = FRUITS[Math.floor(Math.random() * FRUITS.length)]
      g.fruits.push({
        x: rnd(...z.x) * W, y: rnd(...z.y) * H, r: Math.min(W, H) * 0.075,
        age: 0, f, hint: 0, wob: Math.random() * 6,
      })
    }

    function slice(fr, hx, hy) {
      g.sliced += 1
      g.combo += 1
      g.best = Math.max(g.best, g.combo)
      const pts = 10 + Math.min(g.combo - 1, 5) * 2
      g.score += pts
      sfx('slice')
      const ang = Math.atan2(fr.y - hy, fr.x - hx) + Math.PI / 2
      for (const side of [-1, 1]) {
        g.pieces.push({ x: fr.x, y: fr.y, vx: Math.cos(ang) * side * 180, vy: -220, rot: 0, vr: side * 4, side, f: fr.f, r: fr.r, t: 0 })
      }
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2, sp = rnd(80, 320)
        g.parts.push({ x: fr.x, y: fr.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: fr.f.c, t: 0, life: rnd(0.4, 0.8) })
      }
      g.pops.push({ x: fr.x, y: fr.y, txt: g.combo > 1 ? `+${pts}  x${g.combo}` : `+${pts}`, t: 0 })
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - g.last) / 1000)
      g.last = now
      const W = canvas.clientWidth, H = canvas.clientHeight
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }
      ctx.clearRect(0, 0, W, H)

      const lm = lmRef.current
      const d = dbRef.current
      const paused = pausedRef.current || (!lm && !debug)
      if (d > g.peakDb) g.peakDb = d
      const loudNow = d >= target || (debug && spaceRef.current)
      if (loudNow) { g.lastVoice = now; if (!paused) g.voicedMs += dt * 1000 }
      const voiced = now - g.lastVoice < VOICE_HOLD_MS

      // hands (screen space)
      const hands = []
      if (lm) {
        HANDS.forEach(([w, i], k) => {
          const a = lm[w], b = lm[i]
          if (!a || (a.visibility ?? 1) < 0.4) { g.trails[k] = []; return }
          const p = toScreen(b && (b.visibility ?? 1) > 0.3 ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a, videoRef.current, W, H)
          hands.push(p)
          g.trails[k].push({ ...p, t: now })
          g.trails[k] = g.trails[k].filter((q) => now - q.t < 220)
        })
      }

      if (debug && mouseRef.current) {
        const r = canvas.getBoundingClientRect()
        const p = { x: mouseRef.current.x - r.left, y: mouseRef.current.y - r.top }
        hands.push(p)
        g.trails[0].push({ ...p, t: now }); g.trails[0] = g.trails[0].filter((q) => now - q.t < 220)
      }

      if (!paused) {
        g.left -= dt
        g.spawnIn -= dt
        if (g.spawnIn <= 0 && g.fruits.length < MAX_FRUITS) { spawn(W, H); g.spawnIn = SPAWN_EVERY }
      }

      // fruits
      g.fruits = g.fruits.filter((fr) => {
        if (!paused) fr.age += dt
        fr.wob += dt * 2
        let touched = null
        for (const h of hands) if (Math.hypot(h.x - fr.x, h.y - fr.y) < fr.r * 1.25) touched = h
        if (touched && voiced && !paused) { slice(fr, touched.x, touched.y); return false }
        fr.hint = touched ? 0.6 : Math.max(0, fr.hint - dt)
        if (fr.age > FRUIT_LIFE) { g.missed += 1; g.combo = 0; sfx('miss'); return false }
        // draw
        const fade = fr.age > FRUIT_LIFE - 1 ? Math.max(0.25, FRUIT_LIFE - fr.age) : 1
        const pulse = 1 + Math.sin(fr.wob) * 0.04
        ctx.save()
        ctx.globalAlpha = fade
        // glow ring + life ring
        ctx.beginPath(); ctx.arc(fr.x, fr.y, fr.r * 1.18, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill()
        ctx.beginPath(); ctx.arc(fr.x, fr.y, fr.r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - fr.age / FRUIT_LIFE))
        ctx.strokeStyle = fr.f.c; ctx.lineWidth = 5; ctx.stroke()
        ctx.font = `${fr.r * 1.6 * pulse}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(fr.f.e, fr.x, fr.y + fr.r * 0.08)
        if (fr.hint > 0) {
          ctx.globalAlpha = Math.min(1, fr.hint * 2)
          bubble(ctx, fr.x, fr.y - fr.r * 1.7, 'พูด "อา" ดังๆ!')
        }
        ctx.restore()
        return true
      })

      // cut halves
      g.pieces = g.pieces.filter((p) => {
        p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1)
        ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        ctx.beginPath(); ctx.rect(p.side < 0 ? -p.r * 2 : 0, -p.r * 2, p.r * 2, p.r * 4); ctx.clip()
        ctx.font = `${p.r * 1.6}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(p.f.e, 0, p.r * 0.08)
        ctx.restore()
        return p.t < 1.1
      })

      // juice particles
      g.parts = g.parts.filter((p) => {
        p.t += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt
        ctx.globalAlpha = Math.max(0, 1 - p.t / p.life)
        ctx.fillStyle = p.c
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
        return p.t < p.life
      })

      // score pops
      g.pops = g.pops.filter((p) => {
        p.t += dt
        ctx.globalAlpha = Math.max(0, 1 - p.t)
        ctx.font = 'bold 30px Sarabun, sans-serif'
        ctx.textAlign = 'center'
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.45)'
        ctx.strokeText(p.txt, p.x, p.y - p.t * 70)
        ctx.fillStyle = '#FFE066'
        ctx.fillText(p.txt, p.x, p.y - p.t * 70)
        ctx.globalAlpha = 1
        return p.t < 1
      })

      // blade trails + hand cursors
      g.trails.forEach((tr) => {
        if (tr.length < 2) return
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'
        ctx.strokeStyle = voiced ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)'
        ctx.lineWidth = voiced ? 12 : 5
        ctx.shadowColor = voiced ? '#7DD3FC' : 'transparent'; ctx.shadowBlur = voiced ? 18 : 0
        ctx.beginPath(); ctx.moveTo(tr[0].x, tr[0].y)
        tr.forEach((q) => ctx.lineTo(q.x, q.y))
        ctx.stroke()
        ctx.shadowBlur = 0
      })
      hands.forEach((h) => {
        ctx.beginPath(); ctx.arc(h.x, h.y, voiced ? 22 : 16, 0, Math.PI * 2)
        ctx.fillStyle = voiced ? 'rgba(125,211,252,0.9)' : 'rgba(255,255,255,0.55)'
        ctx.fill()
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke()
      })

      if (now - g.hudAt > 120) {
        g.hudAt = now
        setHud({ score: g.score, sliced: g.sliced, missed: g.missed, combo: g.combo, left: g.left, voiced, noPerson: !lm && !debug })
      }

      if (g.left <= 0) {
        cancelAnimationFrame(raf)
        const res = {
          score: g.score, sliced: g.sliced, missed: g.missed, best: g.best,
          peakDb: Math.round(g.peakDb), voicedSec: Math.round(g.voicedMs / 100) / 10,
        }
        sessionHistory.add({ type: 'loud', game: 'fruit', score: Math.min(100, Math.round((g.sliced / Math.max(1, g.sliced + g.missed)) * 100)), reps: g.sliced, goal: g.sliced + g.missed, duration: fmtClock(ROUND_SEC), points: g.score })
        setResult(res)
        setPhase('end')
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const meterPct = Math.max(0, Math.min(100, ((db - 40) / 50) * 100))
  const targetPct = ((target - 40) / 50) * 100
  const loud = db >= target

  return (
    <div className="fixed inset-0 bg-cam overflow-hidden select-none">
      <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)', opacity: 0.85 }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(35,30,54,.35), rgba(35,30,54,.1) 30%, rgba(35,30,54,.35))' }} />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* top bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between gap-3 z-10">
        <button onClick={() => navigate('/games')} className="flex items-center gap-2 bg-white/90 text-ink-primary rounded-pill px-4 py-2.5 font-bold text-[15px]">
          <ArrowLeft size={18} /> ออก
        </button>
        {phase === 'play' && (
          <div className="flex gap-2.5">
            <Stat label="คะแนน" value={hud.score} color="#F7C132" />
            <Stat label="ฟันได้" value={hud.sliced} color="#2FA65A" />
            <Stat label="เวลา" value={fmtClock(hud.left)} color="#3D87E8" />
          </div>
        )}
      </div>
      {phase === 'play' && <SOSButton reason="fall" />}

      {/* loudness meter */}
      {phase !== 'intro' && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2">
          <div className="relative w-9 h-[46vh] rounded-full bg-black/40 border-2 border-white/60 overflow-hidden">
            <div className="absolute bottom-0 inset-x-0 transition-[height] duration-75" style={{ height: `${meterPct}%`, background: loud ? '#2FA65A' : '#F7C132' }} />
            <div className="absolute inset-x-0 h-[3px] bg-white" style={{ bottom: `${targetPct}%` }} />
          </div>
          <div className={`rounded-xl px-2.5 py-1.5 text-center text-[13px] font-bold ${loud ? 'bg-teal-600 text-white' : 'bg-white/90 text-ink-primary'}`}>
            <Mic size={14} className="inline -mt-0.5" /> {db || 0} dB
            <div className="text-[10.5px] font-semibold opacity-80">เป้า {target}</div>
          </div>
        </div>
      )}

      {phase === 'play' && hud.noPerson && (
        <Banner>ถอยออกมาให้กล้องเห็นตัวคุณ ตั้งแต่หัวถึงเอว</Banner>
      )}
      {phase === 'play' && !hud.noPerson && (
        <Banner tone={hud.voiced ? 'ok' : 'info'}>
          {hud.voiced ? '🔪 มีดพร้อม! เอื้อมมือไปแตะผลไม้เลย' : 'เอื้อมมือไปที่ผลไม้ แล้วพูด "อา" ดังๆ เพื่อฟัน'}
          {hud.combo > 1 && <span className="ml-2 text-[#FFE066]">คอมโบ x{hud.combo}</span>}
        </Banner>
      )}

      {phase === 'intro' && (
        <Overlay>
          <div className="text-[64px] leading-none mb-2">🍉🔪</div>
          <h1 className="font-heading text-[30px] font-bold text-ink-primary mb-1">เกมฟันผลไม้</h1>
          <p className="text-[15px] text-ink-secondary mb-5">LSVT BIG + LSVT LOUD · เล่น {ROUND_SEC} วินาที</p>
          <ol className="text-left text-[16px] text-ink-primary space-y-2.5 mb-6 max-w-[440px] mx-auto">
            <li>1. ยืนห่างกล้องให้เห็นตัวตั้งแต่หัวถึงเอว มีพื้นที่ว่างรอบตัว</li>
            <li>2. ผลไม้จะโผล่ที่<b>ขอบจอ</b> — กางแขนเอื้อมไปให้สุดแบบท่าใหญ่ๆ</li>
            <li>3. ตอนมือแตะผลไม้ ให้พูด <b>"อา"</b> ดังๆ จนเกินเส้นเป้าหมาย ผลไม้จึงจะขาด</li>
          </ol>
          <StatusLine status={status} poseReady={poseReady} />
          <button disabled={status !== 'live'} onClick={() => setPhase('countdown')} className="btn-primary max-w-[320px] text-[18px] py-4">
            เริ่มเกม
          </button>
        </Overlay>
      )}

      {phase === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-white">
          <div className="font-heading font-bold text-[140px] leading-none drop-shadow-lg">{count}</div>
          <p className="text-[18px] mt-3 bg-black/40 rounded-pill px-5 py-2">
            {micStatus === 'calibrating' ? 'เงียบสักครู่… กำลังวัดเสียงรอบข้าง' : micStatus === 'denied' ? 'ไม่ได้รับอนุญาตใช้ไมค์' : 'เตรียมตัว!'}
          </p>
        </div>
      )}

      {phase === 'end' && result && (
        <Overlay>
          <div className="text-[56px] leading-none mb-2">🏆</div>
          <h1 className="font-heading text-[28px] font-bold text-ink-primary mb-4">จบเกม! เก่งมาก</h1>
          <div className="grid grid-cols-2 gap-3 mb-6 max-w-[420px] mx-auto">
            <Result k="คะแนน" v={result.score} />
            <Result k="ฟันผลไม้ได้" v={`${result.sliced} ลูก`} />
            <Result k="คอมโบสูงสุด" v={`x${result.best}`} />
            <Result k="เสียงดังสุด" v={`${result.peakDb} dB`} />
            <Result k="ผลไม้ที่พลาด" v={`${result.missed} ลูก`} />
            <Result k="เวลาที่เปล่งเสียง" v={`${result.voicedSec} วิ`} />
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setResult(null); setHud({ score: 0, sliced: 0, missed: 0, combo: 0, left: ROUND_SEC }); setPhase('countdown') }} className="btn-primary !w-auto px-7 flex items-center gap-2">
              <Refresh size={18} /> เล่นอีกครั้ง
            </button>
            <button onClick={() => navigate('/games')} className="rounded-btn px-7 py-3 font-heading font-bold text-[15px] bg-white border-2 border-line text-ink-secondary flex items-center gap-2">
              <Home size={18} /> เลือกเกม
            </button>
          </div>
        </Overlay>
      )}

      {fallen && phase === 'play' && <FallAlert onSafe={dismiss} onCall={() => navigate('/emergency-alert?reason=fall')} />}
    </div>
  )
}

function bubble(ctx, x, y, text) {
  ctx.font = 'bold 20px Sarabun, sans-serif'
  const w = ctx.measureText(text).width + 24
  ctx.fillStyle = '#E8554D'
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x - w / 2, y - 18, w, 36, 18) : ctx.rect(x - w / 2, y - 18, w, 36)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + 1)
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-white/92 px-4 py-2 text-center min-w-[92px]" style={{ boxShadow: `0 4px 0 ${color}` }}>
      <div className="text-[12px] font-semibold text-ink-secondary">{label}</div>
      <div className="font-heading text-[24px] font-bold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
}

function Banner({ children, tone = 'info' }) {
  const bg = tone === 'ok' ? 'rgba(30,122,64,.92)' : 'rgba(35,30,54,.78)'
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-6 py-3.5 rounded-2xl text-white text-[18px] font-bold text-center max-w-[90vw]" style={{ background: bg }}>
      {children}
    </div>
  )
}

function Result({ k, v }) {
  return (
    <div className="rounded-xl bg-bg px-4 py-3">
      <div className="text-[12.5px] text-ink-secondary">{k}</div>
      <div className="font-heading text-[22px] font-bold text-ink-primary">{v}</div>
    </div>
  )
}
