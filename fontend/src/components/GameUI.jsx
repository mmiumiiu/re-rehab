// Shared overlays for the camera games.
export function Overlay({ children }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/45">
      <div className="bg-white rounded-card p-7 md:p-9 text-center w-full max-w-[560px] max-h-[92vh] overflow-auto shadow-soft">
        {children}
      </div>
    </div>
  )
}

export function StatusLine({ status, poseReady }) {
  let msg = 'กำลังเปิดกล้อง…'
  let ok = false
  if (status === 'denied') msg = 'ไม่ได้รับอนุญาตใช้กล้อง — กรุณาอนุญาตในเบราว์เซอร์'
  else if (status === 'error') msg = 'เปิดกล้องไม่สำเร็จ'
  else if (status === 'live' && !poseReady) msg = 'กล้องพร้อม · กำลังโหลด AI จับท่าทาง…'
  else if (status === 'live') { msg = 'กล้องและ AI พร้อมแล้ว'; ok = true }
  return <p className={`text-[13.5px] mb-4 font-semibold ${ok ? 'text-teal-700' : 'text-ink-muted'}`}>{ok ? '✅ ' : '⏳ '}{msg}</p>
}
