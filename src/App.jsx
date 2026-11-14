import { useEffect, useState } from 'react'
import Papa from 'papaparse'
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'

const YEARS = [2023, 2024, 2025]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LINE_COLORS = { 2023: '#60a5fa', 2024: '#a855f7', 2025: '#14b8a6' }

// Dark style for chart tooltips
const tooltipStyle = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#e2e8f0' },
  formatter: (v) => v.toLocaleString(),
}

// Adds up Arrivals for each value of a column (like GROUP BY in SQL)
function sumBy(rows, key) {
  const totals = {}
  rows.forEach((row) => {
    totals[row[key]] = (totals[row[key]] || 0) + row.Arrivals
  })
  return totals
}

// Returns the name with the biggest total (like ORDER BY ... DESC LIMIT 1)
function topName(totals) {
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : '...'
}

// A reusable KPI card
function KpiCard({ label, value, note, color = 'text-white' }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  )
}

// A reusable box with a title, used around every chart
function Panel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${className}`}>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </div>
  )
}

function App() {
  const [data, setData] = useState([])
  const [year, setYear] = useState(2025)

  useEffect(() => {
    Papa.parse('/data/tourism_long.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => setData(result.data),
    })
  }, [])

  // ---------- Calculations ----------
  const yearRows = data.filter((row) => row.Year === year)
  const prevRows = data.filter((row) => row.Year === year - 1)

  const total = yearRows.reduce((sum, row) => sum + row.Arrivals, 0)
  const prevTotal = prevRows.reduce((sum, row) => sum + row.Arrivals, 0)
  const growth = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null

  const countryTotals = sumBy(yearRows, 'Country')
  const monthTotals = sumBy(yearRows, 'Month')
  const topMarket = topName(countryTotals)
  const peakMonth = topName(monthTotals)
  const topShare = total > 0 ? (countryTotals[topMarket] / total) * 100 : 0

  // Top 10 countries for the selected year
  const top10 = Object.entries(countryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, arrivals]) => ({ country, arrivals }))
  const maxTop = top10.length > 0 ? top10[0].arrivals : 1

  // Total arrivals for each year
  const byYear = YEARS.map((y) => ({
    year: String(y),
    arrivals: data
      .filter((row) => row.Year === y)
      .reduce((sum, row) => sum + row.Arrivals, 0),
  }))

  // One row per month with a number for each year
  const monthly = MONTHS.map((m, i) => {
    const row = { month: m }
    YEARS.forEach((y) => {
      row[y] = data
        .filter((r) => r.Year === y && r.Month_Num === i + 1)
        .reduce((sum, r) => sum + r.Arrivals, 0)
    })
    return row
  })

  // Growth from 2023 to 2025 (only countries with 10,000+ arrivals in 2023)
  const c23 = sumBy(data.filter((r) => r.Year === 2023), 'Country')
  const c25 = sumBy(data.filter((r) => r.Year === 2025), 'Country')
  const growthRows = Object.keys(c23)
    .filter((c) => c23[c] >= 10000)
    .map((c) => {
      const a25 = c25[c] || 0
      return {
        country: c,
        a23: c23[c],
        a25,
        change: a25 - c23[c],
        pct: ((a25 - c23[c]) / c23[c]) * 100,
      }
    })
    .sort((a, b) => b.pct - a.pct)

  // ---------- Page ----------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <header className="mb-10 flex flex-col items-center gap-5 text-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-teal-400">
              Data Analysis Project
            </p>
            <h1 className="mt-2 text-4xl font-bold text-white">
              Sri Lanka Tourism Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Monthly tourist arrivals 2023–2025 · Source: SLTDA
            </p>
          </div>

          {/* Year selector */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900 p-1">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-lg px-5 py-2 text-sm font-medium transition ${
                  y === year
                    ? 'bg-teal-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Total Arrivals"
            value={`${(total / 1000000).toFixed(2)}M`}
            note={`Tourists in ${year}`}
          />
          <KpiCard
            label="YoY Growth"
            value={growth === null ? '--' : `+${growth.toFixed(1)}%`}
            note={growth === null ? 'No 2022 data' : `vs ${year - 1}`}
            color="text-emerald-400"
          />
          <KpiCard
            label="Top Market"
            value={topMarket}
            note={`${topShare.toFixed(1)}% of arrivals`}
            color="text-teal-400"
          />
          <KpiCard
            label="Peak Month"
            value={peakMonth}
            note={`${(monthTotals[peakMonth] || 0).toLocaleString()} arrivals`}
            color="text-purple-400"
          />
        </div>

        {/* Top 10 + by year */}
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <Panel
            title="Top 10 Source Markets"
            subtitle={`Arrivals by country in ${year}`}
            className="lg:col-span-3"
          >
            <ul className="space-y-3">
              {top10.map((c, i) => (
                <li key={c.country}>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400">
                        {i + 1}
                      </span>
                      <span className="text-slate-200">{c.country}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-white">
                      {c.arrivals.toLocaleString()}
                    </span>
                  </div>
                  <div className="ml-9 mt-1.5 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-teal-600 to-teal-400"
                      style={{ width: `${(c.arrivals / maxTop) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Total Arrivals by Year"
            subtitle="Selected year is highlighted"
            className="lg:col-span-2"
          >
            <ResponsiveContainer width="100%" height={560}>
              <BarChart data={byYear}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => v / 1000000 + 'M'}
                       stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip {...tooltipStyle} cursor={{ fill: '#1e293b' }} />
                <Bar dataKey="arrivals" radius={[8, 8, 0, 0]}>
                  {byYear.map((d) => (
                    <Cell
                      key={d.year}
                      fill={d.year === String(year) ? '#14b8a6' : '#334155'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>

        {/* Seasonality */}
        <Panel
          title="Monthly Arrivals by Year"
          subtitle="Peak in December, lowest in May, every year"
          className="mt-6"
        >
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthly}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => v / 1000 + 'K'}
                     stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              {YEARS.map((y) => (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={String(y)}
                  stroke={LINE_COLORS[y]}
                  strokeWidth={y === year ? 4 : 2}
                  strokeOpacity={y === year ? 1 : 0.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Growth table */}
        <Panel
          title="Market Growth (2023 → 2025)"
          subtitle="Markets with 10,000+ arrivals in 2023, fastest growing first"
          className="mt-6"
        >
          <div className="max-h-96 overflow-y-auto pr-4 [scrollbar-color:#334155_transparent] [scrollbar-width:thin]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Country</th>
                  <th className="py-2 text-right font-medium">2023</th>
                  <th className="py-2 text-right font-medium">2025</th>
                  <th className="py-2 text-right font-medium">Change</th>
                  <th className="py-2 text-right font-medium">Growth</th>
                </tr>
              </thead>
              <tbody>
                {growthRows.map((r) => (
                  <tr key={r.country} className="border-t border-slate-800">
                    <td className="py-2 text-slate-200">{r.country}</td>
                    <td className="py-2 text-right tabular-nums">{r.a23.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">{r.a25.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.change > 0 ? '+' : ''}{r.change.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${
                      r.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {r.pct > 0 ? '+' : ''}{r.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <footer className="mt-8 text-center text-xs text-slate-600">
          Built by Shihari Ayodya · React, Tailwind CSS, Recharts
        </footer>
      </div>
    </div>
  )
}

export default App