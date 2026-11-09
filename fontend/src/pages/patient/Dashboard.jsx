import MetricRow from '../../components/MetricRow.jsx'
import FrequencyChart from '../../components/FrequencyChart.jsx'
import { Badge, SectionTitle } from '../../components/ui.jsx'
import { useSessionHistory, startOfDay } from '../../lib/useSessionHistory.js'
import { useLoudResults } from '../../lib/useLoudResults.js'
import LoudTrendChart from '../../components/LoudTrendChart.jsx'

const THAI_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const DAY_MS = 86400000

export default function Dashboard() {
  const rows = useSessionHistory()
  const loud = useLoudResults()

  // Distinct days trained within the last 7 days.
  const today0 = startOfDay(Date.now())
  const weekStart0 = today0 - 6 * DAY_MS
  const daysThisWeek = new Set(
    rows.filter((r) => startOfDay(r.ts) >= weekStart0).map((r) => startOfDay(r.ts)),
  ).size

  // 7-day BIG vs LOUD frequency (oldest → today) for the chart.
  const freq = Array.from({ length: 7 }, (_, i) => {
    const day0 = weekStart0 + i * DAY_MS
    const dayRows = rows.filter((r) => startOfDay(r.ts) === day0)
    return {
      day: THAI_DOW[new Date(day0).getDay()],
      big: dayRows.filter((r) => r.type === 'big').length,
      loud: dayRows.filter((r) => r.type === 'loud').length,
    }
  })

  const recent = rows.slice(0, 12)

  return (
    <div className="max-w-[900px]">
      <h1 className="font-heading text-[24px] font-semibold text-ink-primary mb-6">สรุปผลการฝึก</h1>

      <MetricRow
        items={[
          { value: String(rows.length), label: 'จำนวนครั้งที่ฝึก' },
          { value: `${daysThisWeek}/7`, label: 'วันที่ฝึกสัปดาห์นี้' },
        ]}
      />

      <div className="mb-7">
        <FrequencyChart data={freq} />
      </div>

      <SectionTitle>ประวัติล่าสุด</SectionTitle>
      {recent.length === 0 ? (
        <div className="card px-5 py-8 text-center text-[13.5px] text-ink-secondary">
          ยังไม่มีประวัติการฝึก — เริ่มฝึก LSVT BIG หรือ LOUD แล้วผลจะถูกบันทึกที่นี่อัตโนมัติ
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse card overflow-hidden min-w-[480px]">
            <thead>
              <tr className="bg-[#F1EFF9]">
                {['วันที่', 'ประเภทการฝึก', 'ระยะเวลา'].map((h) => (
                  <th key={h} className="text-left text-[11.5px] uppercase tracking-wide text-ink-muted px-5 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-5 py-3 text-[13.5px]">{r.date}</td>
                  <td className="px-5 py-3">
                    <Badge tone={r.type}>{r.game === 'fruit' ? 'เกมฟันผลไม้' : r.game === 'runner' ? 'เกมวิ่งหลบ' : r.type === 'big' ? 'LSVT BIG' : 'LSVT LOUD'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-[13.5px]">{r.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SectionTitle className="mt-8">ประวัติการทำ LSVT LOUD</SectionTitle>
      <LoudTrendChart rows={loud} />
    </div>
  )
}
