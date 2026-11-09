import { useEffect, useRef } from 'react'
import { loudSettings } from './services.js'

// Map a MediaPipe landmark (normalised to the raw video frame) onto the screen
// when the <video> is drawn mirrored with `object-fit: cover` filling W×H.
export function toScreen(lm, video, W, H) {
  const vw = video?.videoWidth || 1280
  const vh = video?.videoHeight || 720
  const s = Math.max(W / vw, H / vh)
  const dw = vw * s
  const dh = vh * s
  const ox = (W - dw) / 2
  const oy = (H - dh) / 2
  return { x: ox + (1 - lm.x) * dw, y: oy + lm.y * dh }
}

// Loudness the patient must reach (on the 40–90 meter scale from useMicLevel).
// Uses the therapist's "min" target when set; clamped so it stays reachable.
export function loudTarget() {
  const s = loudSettings.get()
  const v = s?.min ?? 65
  return Math.max(50, Math.min(80, v))
}

// Keep the latest value of a prop/state in a ref so a requestAnimationFrame loop
// can read it without re-subscribing every render.
export function useLatest(value) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value }, [value])
  return ref
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Simple synthesized sound effects (no audio files needed).
let actx = null
export function sfx(kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)()
    const t = actx.currentTime
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.connect(g); g.connect(actx.destination)
    const presets = {
      slice: { type: 'triangle', f0: 880, f1: 1500, d: 0.12, v: 0.18 },
      coin: { type: 'square', f0: 990, f1: 1320, d: 0.1, v: 0.08 },
      hit: { type: 'sawtooth', f0: 220, f1: 70, d: 0.3, v: 0.2 },
      miss: { type: 'sine', f0: 300, f1: 180, d: 0.18, v: 0.1 },
      go: { type: 'sine', f0: 660, f1: 990, d: 0.25, v: 0.15 },
      tick: { type: 'sine', f0: 520, f1: 520, d: 0.08, v: 0.12 },
    }
    const p = presets[kind] || presets.tick
    o.type = p.type
    o.frequency.setValueAtTime(p.f0, t)
    o.frequency.exponentialRampToValueAtTime(p.f1, t + p.d)
    g.gain.setValueAtTime(p.v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.d)
    o.start(t); o.stop(t + p.d + 0.02)
  } catch { /* audio not available */ }
}
