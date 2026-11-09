import { SectionTitle } from '../../components/ui.jsx'
import GameCards from '../../components/GameCards.jsx'

export default function GamesHub() {
  return (
    <div className="max-w-[900px]">
      <h1 className="font-heading text-[26px] font-semibold text-ink-primary mb-1">เกมฝึกกายภาพ 🎮</h1>
      <p className="text-[14.5px] text-ink-secondary mb-6">
        ฝึกตามหลัก LSVT BIG (ขยับร่างกายให้ใหญ่) และ LSVT LOUD (พูดให้ดัง) ผ่านเกม — เปิดกล้องและไมค์ ยืนในที่โล่ง มีเก้าอี้หรือคนดูแลอยู่ใกล้ๆ
      </p>
      <SectionTitle>เลือกเกม</SectionTitle>
      <GameCards />
      <div className="mt-6 rounded-[18px] px-5 py-4 text-[14px]" style={{ background: '#FFF4D6', color: '#7A5A00' }}>
        ⚠️ ระหว่างเล่นมีปุ่ม <b>SOS ฉุกเฉิน</b> ด้านบนจอ และระบบจะตรวจจับการล้มอัตโนมัติ หากรู้สึกเวียนหัวหรือเหนื่อย ให้หยุดพักทันที
      </div>
    </div>
  )
}
