import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCamera } from '../../lib/useCamera.js'
import { usePoseLandmarker } from '../../lib/usePoseLandmarker.js'
import { useFallDetector } from '../../lib/useFallDetector.js'
import { useLatest, fmtClock, sfx } from '../../lib/gameShared.js'
import { sessionHistory } from '../../lib/services.js'
import SOSButton from '../../components/SOSButton.jsx'
import FallAlert from '../../components/FallAlert.jsx'
import { ArrowLeft, Refresh, Home } from '../../components/icons.jsx'
import { Overlay, StatusLine } from '../../components/GameUI.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Game 2 — วิ่งหลบสิ่งกีดขวาง (3 lanes, LSVT BIG side steps)
// The runner switches lanes when the patient steps/slides their whole body left
// or right in front of the camera. Obstacles come down the lanes; dodge them and
// collect coins.
// ─────────────────────────────────────────────────────────────────────────────

const ROUND_SEC = 90
const LIVES = 3
const PLAYER_F = 0.9           // depth position of the runner (0 = horizon, 1 = bottom)
const STEP_ON = 0.1            // body offset (fraction of frame width) to enter a side lane
const STEP_OFF = 0.065         // …and to come back to the middle (hysteresis)

const OBSTACLES = ['barrier', 'cone', 'crate']

export default function GameRunner() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('intro') // intro | countdown | play | end
  const [count, setCount] = useState(3)
  const [hud, setHud] = useState({ score: 0, lives: LIVES, coins: 0, left: ROUND_SEC, lane: 0 })
  const [result, setResult] = useState(null)
  const [center, setCenter] = useState(null) // calibrated body centre (0–1, mirrored)

  const { videoRef, status } = useCamera(true)
  const { landmarks, ready: poseReady } = usePoseLandmarker(videoRef, status === 'live')
  const { fallen, dismiss } = useFallDetector(landmarks, phase === 'play')

  const lmRef = useLatest(landmarks)
  const centerRef = useLatest(center)
  const pausedRef = useLatest(fallen)
  const canvasRef = useRef(null)
  const keyLane = useRef(null)
  const bodyLane = useRef(0)

  // body centre in mirrored screen space (0 = left edge of the screen)
  function bodyX(lm) {
    if (!lm) return null
    const ok = (i) => lm[i] && (lm[i].visibility ?? 1) > 0.4
    if (ok(23) && ok(24)) return 1 - (lm[23].x + lm[24].x) / 2
    if (ok(11) && ok(12)) return 1 - (lm[11].x + lm[12].x) / 2
    return null
  }

  // keyboard fallback (for testing / carers)
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'ArrowLeft') keyLane.current = Math.max(-1, (keyLane.current ?? 0) - 1)
      if (e.key === 'ArrowRight') keyLane.current = Math.min(1, (keyLane.current ?? 0) + 1)
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  // countdown — calibrate the body centre at the end of it
  useEffect(() => {
    if (phase !== 'countdown') return
    setCount(3); sfx('tick')
    let n = 3
    const id = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(id)
        setCenter(bodyX(lmRef.current) ?? 0.5)
        bodyLane.current = 0
        keyLane.current = null
        sfx('go'); setPhase('play')
      } else { setCount(n); sfx('tick') }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── main loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'play') return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const g = {
      t: 0, left: ROUND_SEC, speed: 0.32, dist: 0, coins: 0, lives: LIVES,
      lane: 0, px: 0, objs: [], spawnIn: 1.2, inv: 0, flash: 0, switches: 0,
      dodged: 0, hits: 0, last: performance.now(), hudAt: 0, stride: 0,
    }
    let raf

    function spawnRow() {
      const free = Math.floor(Math.random() * 3) - 1
      const blocked = [-1, 0, 1].filter((l) => l !== free && Math.random() < (g.t < 20 ? 0.55 : 0.8))
      if (blocked.length === 0) blocked.push([-1, 0, 1].filter((l) => l !== free)[Math.floor(Math.random() * 2)])
      blocked.forEach((l) => g.objs.push({ kind: OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)], lane: l, d: 1, hit: false, passed: false }))
      for (let i = 0; i < 3; i++) g.objs.push({ kind: 'coin', lane: free, d: 1 + i * 0.07, taken: false })
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - g.last) / 1000)
      g.last = now
      const W = canvas.clientWidth, H = canvas.clientHeight
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H }

      // ── input: body position → lane ──
      const bx = bodyX(lmRef.current)
      const c = centerRef.current
      if (bx != null && c != null) {
        const off = bx - c
        let l = bodyLane.current
        if (l === 0) { if (off < -STEP_ON) l = -1; else if (off > STEP_ON) l = 1 }
        else if (l === -1) { if (off > -STEP_OFF) l = off > STEP_ON ? 1 : 0 }
        else if (l === 1) { if (off < STEP_OFF) l = off < -STEP_ON ? -1 : 0 }
        bodyLane.current = l
      }
      const want = keyLane.current ?? bodyLane.current
      if (want !== g.lane) { g.lane = want; g.switches += 1 }
      g.px += (g.lane - g.px) * Math.min(1, dt * 9) // smooth slide

      const paused = pausedRef.current || (bx == null && keyLane.current == null)

      if (!paused) {
        g.t += dt
        g.left -= dt
        g.speed = 0.32 + Math.min(0.28, g.t * 0.004)
        g.dist += g.speed * dt * 40
        g.stride += dt * (6 + g.speed * 8)
        g.spawnIn -= dt
        if (g.spawnIn <= 0) { spawnRow(); g.spawnIn = Math.max(1.5, 2.6 - g.t * 0.012) }
        g.objs.forEach((o) => { o.d -= g.speed * dt })
        g.inv = Math.max(0, g.inv - dt)
      }
      g.flash = Math.max(0, g.flash - dt)

      // collisions at the runner's depth
      const pLane = Math.round(g.px)
      g.objs.forEach((o) => {
        const f = 1 - o.d
        if (o.kind === 'coin') {
          if (!o.taken && Math.abs(f - PLAYER_F) < 0.04 && o.lane === pLane) {
            o.taken = true; g.coins += 1; sfx('coin')
          }
        } else if (!o.hit && !o.passed) {
          if (Math.abs(f - PLAYER_F) < 0.03 && o.lane === pLane && g.inv <= 0) {
            o.hit = true; g.lives -= 1; g.hits += 1; g.inv = 1.4; g.flash = 0.5; sfx('hit')
          } else if (f > PLAYER_F + 0.04) { o.passed = true; g.dodged += 1 }
        }
      })
      g.objs = g.objs.filter((o) => o.d > -0.15 && !(o.kind === 'coin' && o.taken))

      draw(ctx, W, H, g, now)

      if (now - g.hudAt > 120) {
        g.hudAt = now
        setHud({ score: Math.round(g.dist) + g.coins * 10, lives: g.lives, coins: g.coins, left: g.left, lane: g.lane, noPerson: bx == null && keyLane.current == null })
      }

      if (g.left <= 0 || g.lives <= 0) {
        cancelAnimationFrame(raf)
        const total = g.dodged + g.hits
        const res = {
          score: Math.round(g.dist) + g.coins * 10, meters: Math.round(g.dist), coins: g.coins,
          dodged: g.dodged, hits: g.hits, switches: g.switches, time: fmtClock(g.t), finished: g.lives > 0,
        }
        sessionHistory.add({ type: 'big', game: 'runner', score: total ? Math.round((g.dodged / total) * 100) : null, reps: g.switches, goal: null, duration: fmtClock(g.t), points: res.score })
        setResult(res)
        setPhase('end')
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  return (
    <div className="fixed inset-0 overflow-hidden select-none bg-[#8FD3FF]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* top bar */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between gap-3 z-10">
        <button onClick={() => navigate('/games')} className="flex items-center gap-2 bg-white/90 text-ink-primary rounded-pill px-4 py-2.5 font-bold text-[15px]">
          <ArrowLeft size={18} /> ออก
        </button>
        {phase === 'play' && (
          <div className="flex gap-2.5">
            <Pill label="คะแนน" value={hud.score} color="#F7C132" />
            <Pill label="เหรียญ" value={`🪙 ${hud.coins}`} color="#D9A616" />
            <Pill label="ชีวิต" value={'❤️'.repeat(Math.max(0, hud.lives)) || '—'} color="#E5234F" />
            <Pill label="เวลา" value={fmtClock(hud.left)} color="#3D87E8" />
          </div>
        )}
      </div>
      {phase === 'play' && <SOSButton reason="fall" />}

      {/* camera feed is only used for pose tracking — kept out of sight */}
      <video ref={videoRef} muted playsInline className="absolute left-0 top-0 w-px h-px opacity-0 pointer-events-none" />

      {phase === 'play' && hud.noPerson && (
        <div className="absolute bottom-6 left-6 z-10 px-5 py-3 rounded-2xl text-white text-[17px] font-bold" style={{ background: 'rgba(35,30,54,.8)' }}>
          ⏸ ไม่เห็นตัวคุณในกล้อง — ถอยออกมาให้เห็นทั้งตัว
        </div>
      )}
      {phase === 'play' && !hud.noPerson && (
        <div className="absolute bottom-6 left-6 z-10 px-5 py-3 rounded-2xl text-white text-[17px] font-bold max-w-[50vw]" style={{ background: 'rgba(35,30,54,.72)' }}>
          ก้าวเท้ากว้างๆ ไปซ้าย/ขวา เพื่อเปลี่ยนเลน · กลับมายืนตรงกลางเพื่ออยู่เลนกลาง
        </div>
      )}

      {phase === 'intro' && (
        <Overlay>
          <div className="text-[60px] leading-none mb-2">🏃‍♂️🚧</div>
          <h1 className="font-heading text-[30px] font-bold text-ink-primary mb-1">เกมวิ่งหลบสิ่งกีดขวาง</h1>
          <p className="text-[15px] text-ink-secondary mb-5">LSVT BIG · ก้าวข้าง ถ่ายน้ำหนัก · เล่น {ROUND_SEC} วินาที</p>
          <ol className="text-left text-[16px] text-ink-primary space-y-2.5 mb-6 max-w-[460px] mx-auto">
            <li>1. ยืนตรงกลางหน้ากล้อง ให้เห็นตัวตั้งแต่หัวถึงสะโพก</li>
            <li>2. ตอนนับถอยหลัง <b>ยืนนิ่งตรงกลาง</b> — ระบบจะจำตำแหน่งนี้เป็นเลนกลาง</li>
            <li>3. <b>ก้าวเท้ากว้างๆ</b> ไปทางซ้ายหรือขวาเพื่อสไลด์เปลี่ยนเลน หลบสิ่งกีดขวาง และเก็บเหรียญ 🪙</li>
            <li>4. ชนได้ {LIVES} ครั้ง · มีปุ่ม SOS ตลอดเวลา</li>
          </ol>
          <StatusLine status={status} poseReady={poseReady} />
          <button disabled={status !== 'live'} onClick={() => setPhase('countdown')} className="btn-primary max-w-[320px] text-[18px] py-4">
            เริ่มเกม
          </button>
          <p className="text-[12px] text-ink-muted mt-3">ผู้ดูแลกดปุ่มลูกศร ← → บนคีย์บอร์ดช่วยบังคับได้</p>
        </Overlay>
      )}

      {phase === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 text-white">
          <div className="font-heading font-bold text-[140px] leading-none drop-shadow-lg">{count}</div>
          <p className="text-[18px] mt-3 bg-black/40 rounded-pill px-5 py-2">ยืนนิ่งตรงกลาง — กำลังจำตำแหน่งเลนกลาง</p>
        </div>
      )}

      {phase === 'end' && result && (
        <Overlay>
          <div className="text-[56px] leading-none mb-2">{result.finished ? '🏆' : '💪'}</div>
          <h1 className="font-heading text-[28px] font-bold text-ink-primary mb-4">{result.finished ? 'วิ่งครบเวลา! เก่งมาก' : 'จบเกม — ลองอีกครั้งนะ'}</h1>
          <div className="grid grid-cols-2 gap-3 mb-6 max-w-[420px] mx-auto">
            <Result k="คะแนน" v={result.score} />
            <Result k="ระยะทาง" v={`${result.meters} ม.`} />
            <Result k="เปลี่ยนเลน (ก้าวข้าง)" v={`${result.switches} ครั้ง`} />
            <Result k="หลบได้" v={`${result.dodged} ครั้ง`} />
            <Result k="เหรียญ" v={result.coins} />
            <Result k="เวลาที่วิ่ง" v={result.time} />
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setResult(null); setCenter(null); setPhase('countdown') }} className="btn-primary !w-auto px-7 flex items-center gap-2">
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

// ── rendering ────────────────────────────────────────────────────────────────
function draw(ctx, W, H, g, now) {
  const hy = H * 0.3                     // horizon
  const cx = W / 2
  const topHalf = W * 0.05
  const botHalf = W * 0.48
  const K = (f) => f * f                 // perspective curve
  const yAt = (f) => hy + (H - hy) * K(f) * 1.02
  const half = (f) => topHalf + (botHalf - topHalf) * K(f)
  const laneX = (lane, f) => cx + lane * (half(f) * 2 / 3)
  const sc = (f) => 0.06 + 0.94 * K(f)

  // sky + hills
  const sky = ctx.createLinearGradient(0, 0, 0, hy)
  sky.addColorStop(0, '#6EC1FF'); sky.addColorStop(1, '#CDEBFF')
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 1)
  ctx.fillStyle = '#FFE38A'; ctx.beginPath(); ctx.arc(W * 0.82, hy * 0.42, hy * 0.18, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#7CCB7C'
  ctx.beginPath(); ctx.moveTo(0, hy)
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, hy - 18 - Math.sin(x / 130) * 16 - Math.sin(x / 47) * 6)
  ctx.lineTo(W, hy); ctx.fill()

  // grass
  ctx.fillStyle = '#5DBB63'; ctx.fillRect(0, hy, W, H - hy)
  // sidewalks
  ctx.fillStyle = '#E9D8B4'
  quad(ctx, cx - half(0) - W * 0.012, hy, cx - half(0), hy, cx - botHalf, H, cx - botHalf - W * 0.09, H)
  quad(ctx, cx + half(0), hy, cx + half(0) + W * 0.012, hy, cx + botHalf + W * 0.09, H, cx + botHalf, H)
  // road
  ctx.fillStyle = '#4B5563'
  quad(ctx, cx - half(0), hy, cx + half(0), hy, cx + botHalf, H, cx - botHalf, H)

  // scrolling lane stripes
  const phase = (g.dist * 0.08) % 1
  ctx.fillStyle = '#F8FAFC'
  for (const l of [-0.5, 0.5]) {
    for (let i = 0; i < 12; i++) {
      const f0 = ((i + phase) / 12)
      const f1 = Math.min(1, f0 + 0.035)
      const x0 = cx + l * (half(f0) * 2 / 3), x1 = cx + l * (half(f1) * 2 / 3)
      const w0 = 2 + 6 * K(f0), w1 = 2 + 6 * K(f1)
      quad(ctx, x0 - w0, yAt(f0), x0 + w0, yAt(f0), x1 + w1, yAt(f1), x1 - w1, yAt(f1))
    }
  }
  // roadside trees scrolling
  for (let i = 0; i < 8; i++) {
    const f = ((i + phase * 2) / 8) % 1
    for (const side of [-1, 1]) {
      const x = cx + side * (half(f) + W * 0.06 * sc(f) + 30 * sc(f))
      tree(ctx, x, yAt(f), sc(f) * 1.3)
    }
  }

  // objects, far → near
  const objs = [...g.objs].sort((a, b) => b.d - a.d)
  const playerY = yAt(PLAYER_F)
  let playerDrawn = false
  const drawPlayer = () => {
    const blink = g.inv > 0 && Math.floor(now / 100) % 2 === 0
    if (!blink) runner(ctx, cx + g.px * (half(PLAYER_F) * 2 / 3), playerY, sc(PLAYER_F) * 1.05, g.stride, g.px - g.lane)
    playerDrawn = true
  }
  for (const o of objs) {
    const f = 1 - o.d
    if (f < 0 || f > 1.15) continue
    if (!playerDrawn && f > PLAYER_F) drawPlayer()
    const x = laneX(o.lane, Math.min(f, 1.1)), y = yAt(Math.min(f, 1.1)), s = sc(Math.min(f, 1.1))
    if (o.kind === 'coin') coin(ctx, x, y, s, now)
    else obstacle(ctx, o.kind, x, y, s, o.hit)
  }
  if (!playerDrawn) drawPlayer()

  if (g.flash > 0) { ctx.fillStyle = `rgba(229,35,79,${g.flash * 0.5})`; ctx.fillRect(0, 0, W, H) }
}

function quad(ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill()
}

function tree(ctx, x, y, s) {
  ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x - 6 * s, y - 50 * s, 12 * s, 50 * s)
  ctx.fillStyle = '#2F8F46'
  ctx.beginPath(); ctx.arc(x, y - 70 * s, 34 * s, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3FA75A'
  ctx.beginPath(); ctx.arc(x - 12 * s, y - 80 * s, 20 * s, 0, Math.PI * 2); ctx.fill()
}

function coin(ctx, x, y, s, now) {
  const r = 26 * s, wob = Math.abs(Math.cos(now / 220))
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#F7C132'; ctx.strokeStyle = '#B8860B'; ctx.lineWidth = Math.max(1, 4 * s)
  ctx.beginPath(); ctx.ellipse(x, y - r * 2, r * (0.35 + 0.65 * wob), r, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
}

function obstacle(ctx, kind, x, y, s, hit) {
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, 95 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = hit ? 0.45 : 1
  if (kind === 'barrier') {
    const w = 180 * s, h = 60 * s
    ctx.fillStyle = '#6B7280'
    ctx.fillRect(x - w / 2 + 8 * s, y - h - 40 * s, 10 * s, h + 40 * s); ctx.fillRect(x + w / 2 - 18 * s, y - h - 40 * s, 10 * s, h + 40 * s)
    ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y - h - 40 * s, w, h); ctx.clip()
    for (let i = -6; i < 12; i++) { ctx.fillStyle = i % 2 ? '#F8FAFC' : '#E5234F'; quad(ctx, x - w / 2 + i * 26 * s, y - 40 * s, x - w / 2 + (i + 1) * 26 * s, y - 40 * s, x - w / 2 + (i + 1) * 26 * s + h, y - h - 40 * s, x - w / 2 + i * 26 * s + h, y - h - 40 * s) }
    ctx.restore()
  } else if (kind === 'cone') {
    for (const dx of [-55, 55]) {
      ctx.fillStyle = '#F97316'; quad(ctx, x + dx * s - 10 * s, y - 95 * s, x + dx * s + 10 * s, y - 95 * s, x + dx * s + 34 * s, y - 8 * s, x + dx * s - 34 * s, y - 8 * s)
      ctx.fillStyle = '#F8FAFC'; quad(ctx, x + dx * s - 18 * s, y - 62 * s, x + dx * s + 18 * s, y - 62 * s, x + dx * s + 24 * s, y - 44 * s, x + dx * s - 24 * s, y - 44 * s)
      ctx.fillStyle = '#C2410C'; ctx.fillRect(x + dx * s - 40 * s, y - 10 * s, 80 * s, 10 * s)
    }
  } else {
    const w = 130 * s
    ctx.fillStyle = '#B7793E'; ctx.fillRect(x - w / 2, y - w, w, w)
    ctx.strokeStyle = '#7A4A1D'; ctx.lineWidth = Math.max(1, 7 * s)
    ctx.strokeRect(x - w / 2, y - w, w, w)
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - w); ctx.lineTo(x + w / 2, y); ctx.moveTo(x + w / 2, y - w); ctx.lineTo(x - w / 2, y); ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// Original runner character seen from behind (cap, backpack, swinging limbs).
function runner(ctx, x, y, s, stride, lean) {
  const sw = Math.sin(stride)
  const u = 1.25 * s
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-lean * 0.25)
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 60 * u, 16 * u, 0, 0, Math.PI * 2); ctx.fill()
  const limb = (x0, y0, len, ang, w, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = w * u; ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x0 * u, y0 * u); ctx.lineTo((x0 + Math.sin(ang) * len) * u, (y0 + Math.cos(ang) * len) * u); ctx.stroke()
  }
  // legs
  limb(-14, -70, 64, sw * 0.5, 20, '#2B2650')
  limb(14, -70, 64, -sw * 0.5, 20, '#2B2650')
  ctx.fillStyle = '#F8FAFC'
  ctx.beginPath(); ctx.ellipse((-14 + Math.sin(sw * 0.5) * 64) * u, (-70 + Math.cos(sw * 0.5) * 64) * u, 14 * u, 8 * u, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse((14 + Math.sin(-sw * 0.5) * 64) * u, (-70 + Math.cos(sw * 0.5) * 64) * u, 14 * u, 8 * u, 0, 0, Math.PI * 2); ctx.fill()
  // body
  ctx.fillStyle = '#2FA65A'
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-36 * u, -150 * u, 72 * u, 86 * u, 22 * u) : ctx.rect(-36 * u, -150 * u, 72 * u, 86 * u); ctx.fill()
  // arms (swinging, hanging down)
  limb(-36, -138, 56, -0.35 + sw * 0.5, 15, '#F2C7A5')
  limb(36, -138, 56, 0.35 + sw * 0.5, 15, '#F2C7A5')
  // backpack
  ctx.fillStyle = '#F7C132'
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-24 * u, -140 * u, 48 * u, 52 * u, 12 * u) : ctx.rect(-24 * u, -140 * u, 48 * u, 52 * u); ctx.fill()
  ctx.fillStyle = '#D9A616'; ctx.fillRect(-16 * u, -112 * u, 32 * u, 8 * u)
  // head + cap
  ctx.fillStyle = '#3B2A20'; ctx.beginPath(); ctx.arc(0, -175 * u, 30 * u, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5B50E0'; ctx.beginPath(); ctx.arc(0, -182 * u, 31 * u, Math.PI, 0); ctx.fill()
  ctx.fillRect(-31 * u, -184 * u, 62 * u, 8 * u)
  ctx.restore()
}

function Pill({ label, value, color }) {
  return (
    <div className="rounded-2xl bg-white/92 px-4 py-2 text-center min-w-[88px]" style={{ boxShadow: `0 4px 0 ${color}` }}>
      <div className="text-[12px] font-semibold text-ink-secondary">{label}</div>
      <div className="font-heading text-[21px] font-bold leading-tight" style={{ color }}>{value}</div>
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
