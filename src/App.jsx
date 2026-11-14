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

// Chart colors for each theme (charts need real color codes, not Tailwind classes)
const CHART_THEME = {
  dark: {
    grid: '#1e293b', axis: '#64748b', bar: '#334155', cursor: '#1e293b',
    tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#e2e8f0',
  },
  light: {
    grid: '#e2e8f0', axis: '#94a3b8', bar: '#cbd5e1', cursor: '#f1f5f9',
    tooltipBg: '#ffffff', tooltipBorder: '#e2e8f0', tooltipText: '#0f172a',
  },
}

// Key findings and recommendations (from the full 2023–2025 analysis)
const INSIGHTS = [
  {
    tag: 'Growth',
    title: 'Strong growth, but slowing',
    finding: 'Arrivals rose 38.1% in 2024 and 15.1% in 2025. Part of the 2024 jump is recovery from a weak start to 2023.',
    action: 'Plan for steadier growth, not another 38% year.',
  },
  {
    tag: 'Seasonality',
    title: 'December peak, May low',
    finding: 'The same pattern repeats every year, with a smaller second peak in July–August.',
    action: 'Add staff and marketing for November–March; run promotions in May and September–October.',
  },
  {
    tag: 'Markets',
    title: 'One market dominates',
    finding: 'India brings 21.2% of all arrivals, and the top 10 markets make up 68.3%.',
    action: 'Spread marketing across more countries to lower the risk of one market slowing down.',
  },
  {
    tag: 'Opportunity',
    title: 'Fast-growing markets',
    finding: 'Bangladesh (+234%), Poland (+179%) and Italy (+127%) grew fastest from 2023 to 2025.',
    action: 'Run targeted campaigns in these growing markets.',
  },
  {
    tag: 'Risk',
    title: 'Russia falling, China flat',
    finding: 'Russia fell 5.5% and dropped to #3 in 2025. China stopped growing after a big jump in 2024.',
    action: 'Research the reasons before changing plans; the data does not explain why.',
  },
]

const STEPS = ['Python (Pandas)', 'MySQL', 'Power BI', 'React + Tailwind']

// A different color for each insight tag
const TAG_STYLES = {
  Growth: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  Seasonality: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  Markets: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  Opportunity: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  Risk: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
}

// Read the saved theme (falls back to dark if nothing is saved)
function getSavedTheme() {
  try {
    return localStorage.getItem('theme') || 'dark'
  } catch {
    return 'dark'
  }
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

// Shared card style for light and dark
const BOX = 'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-12px_rgba(15,23,42,0.15)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none'

// A reusable KPI card
function KpiCard({ label, value, note, color = 'text-slate-900 dark:text-white', accent = 'bg-slate-400' }) {
  return (
    <div className={`${BOX} relative overflow-hidden p-4 sm:p-5`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 break-words text-xl font-bold sm:text-2xl lg:text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{note}</p>
    </div>
  )
}

// A reusable box with a title, used around every chart
function Panel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`${BOX} p-4 sm:p-5 ${className}`}>
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mb-4 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
      {children}
    </div>
  )
}

// Sun and moon icons for the theme button
function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function App() {
  const [data, setData] = useState([])
  const [year, setYear] = useState(2025)
  const [theme, setTheme] = useState(getSavedTheme)
  const isDark = theme === 'dark'
  const ct = CHART_THEME[theme] // chart colors for the current theme

  // Load the CSV once
  useEffect(() => {
    Papa.parse('/data/tourism_long.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (result) => setData(result.data),
    })
  }, [])

  // Every time the theme changes: switch the "dark" class and remember the choice
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // storage not available: the theme still works, it just isn't remembered
    }
  }, [theme, isDark])

  // Tooltip style that follows the theme
  const tooltipStyle = {
    contentStyle: {
      background: ct.tooltipBg,
      border: `1px solid ${ct.tooltipBorder}`,
      borderRadius: 8,
    },
    labelStyle: { color: ct.tooltipText },
    formatter: (v) => v.toLocaleString(),
  }

  // Y-axis labels drawn from the left edge, so they line up with the titles
  const leftTick = (format) => ({ y, payload }) => (
    <text x={0} y={y} dy={4} textAnchor="start" fill={ct.axis} fontSize={12}>
      {format(payload.value)}
    </text>
  )

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
    <div className="min-h-screen bg-gradient-to-br from-teal-50/70 via-slate-50 to-purple-50/70 text-slate-700 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 dark:text-slate-200">

      {/* Sticky navbar: stays at the top while scrolling */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/60 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">

          {/* Logo / name */}
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              SL Tourism<span className="hidden sm:inline"> Dashboard</span>
            </span>
          </div>

          {/* Year selector */}
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  y === year
                    ? 'bg-teal-500 text-white shadow'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Theme toggle button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Light mode' : 'Dark mode'}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:text-teal-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-teal-400"
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

        {/* Header (scrolls away) */}
        <header className="mb-10 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-teal-600 dark:text-teal-400">
            Data Analysis Project
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-teal-600 via-sky-600 to-purple-600 bg-clip-text pb-1 text-3xl font-bold sm:text-4xl text-transparent dark:from-teal-300 dark:via-sky-300 dark:to-purple-400">
            Sri Lanka Tourism Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Monthly tourist arrivals 2023–2025 · Source: SLTDA
          </p>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Total Arrivals"
            value={`${(total / 1000000).toFixed(2)}M`}
            note={`Tourists in ${year}`}
            accent="bg-sky-500"
          />
          <KpiCard
            label="YoY Growth"
            value={growth === null ? '--' : `+${growth.toFixed(1)}%`}
            note={growth === null ? 'No 2022 data' : `vs ${year - 1}`}
            color="text-emerald-600 dark:text-emerald-400"
            accent="bg-emerald-500"
          />
          <KpiCard
            label="Top Market"
            value={topMarket}
            note={`${topShare.toFixed(1)}% of arrivals`}
            color="text-teal-600 dark:text-teal-400"
            accent="bg-teal-500"
          />
          <KpiCard
            label="Peak Month"
            value={peakMonth}
            note={`${(monthTotals[peakMonth] || 0).toLocaleString()} arrivals`}
            color="text-purple-600 dark:text-purple-400"
            accent="bg-purple-500"
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
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {i + 1}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">{c.country}</span>
                    </div>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                      {c.arrivals.toLocaleString()}
                    </span>
                  </div>
                  <div className="ml-9 mt-1.5 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
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
            <div className="h-56 lg:h-[490px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byYear}>
                <CartesianGrid stroke={ct.grid} vertical={false} />
                <XAxis dataKey="year" stroke={ct.axis} tick={{ fontSize: 12 }} />
                <YAxis width={40} stroke={ct.axis}
                       tick={leftTick((v) => v / 1000000 + 'M')} />
                <Tooltip
                  {...tooltipStyle}
                  itemStyle={{ color: '#14b8a6' }}
                  cursor={{ fill: ct.cursor }}
                />
                <Bar dataKey="arrivals" name="Arrivals" radius={[8, 8, 0, 0]}>
                  {byYear.map((d) => (
                    <Cell
                      key={d.year}
                      fill={d.year === String(year) ? '#14b8a6' : ct.bar}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Seasonality */}
        <Panel
          title="Monthly Arrivals by Year"
          subtitle="Peak in December, lowest in May, every year"
          className="mt-6"
        >
          <div className="h-52 sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke={ct.axis} tick={{ fontSize: 12 }} />
              <YAxis width={45} stroke={ct.axis}
                     tick={leftTick((v) => v / 1000 + 'K')} />
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
          </div>
        </Panel>

        {/* Growth table */}
        <Panel
          title="Market Growth (2023 → 2025)"
          subtitle="Markets with 10,000+ arrivals in 2023, fastest growing first"
          className="mt-6"
        >
          <div className="max-h-96 overflow-y-auto pr-4 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] dark:[scrollbar-color:#334155_transparent]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-slate-500 shadow-[0_1px_0_#e2e8f0] dark:bg-slate-900 dark:text-slate-400 dark:shadow-[0_1px_0_#1e293b]">
                <tr>
                  <th className="py-2 font-medium">Country</th>
                  <th className="hidden py-2 text-right font-medium sm:table-cell">2023</th>
                  <th className="hidden py-2 text-right font-medium sm:table-cell">2025</th>
                  <th className="py-2 text-right font-medium">Change</th>
                  <th className="py-2 text-right font-medium">Growth</th>
                </tr>
              </thead>
              <tbody>
                {growthRows.map((r) => (
                  <tr key={r.country} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 text-slate-700 dark:text-slate-200">{r.country}</td>
                    <td className="hidden py-2 text-right tabular-nums sm:table-cell">{r.a23.toLocaleString()}</td>
                    <td className="hidden py-2 text-right tabular-nums sm:table-cell">{r.a25.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.change > 0 ? '+' : ''}{r.change.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${
                      r.pct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {r.pct > 0 ? '+' : ''}{r.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Key insights */}
        <section className="mt-10">
          <h2 className="text-center text-lg font-semibold text-slate-900 dark:text-white">
            Key Insights & Recommendations
          </h2>
          <p className="mb-4 text-center text-xs text-slate-400 dark:text-slate-500">
            Based on all 3 years of data (2023–2025)
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {INSIGHTS.map((item) => (
              <div
                key={item.title}
                className={`${BOX} w-full p-4 sm:p-5 md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]`}
              >
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TAG_STYLES[item.tag]}`}>
                  {item.tag}
                </span>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.finding}</p>
                <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-teal-700 dark:border-slate-800 dark:text-teal-300">
                  → {item.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* About */}
        <Panel title="About this Project" className="mt-6">
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Monthly tourist arrival data from the{' '}
            <a
              href="https://sltda.gov.lk/monthly-tourist-arrivals-reports"
              target="_blank"
              rel="noreferrer"
              className="text-teal-600 hover:underline dark:text-teal-400"
            >
              Sri Lanka Tourism Development Authority (SLTDA)
            </a>
            , cleaned and combined into one dataset of 6,936 rows covering 190+ countries.
          </p>

          {/* Process steps */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {step}
                </span>
                {i < STEPS.length - 1 && <span className="text-slate-400 dark:text-slate-600">→</span>}
              </div>
            ))}
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-400 dark:text-slate-500">
            <li>2023 started low, so part of the growth is recovery from a low base.</li>
            <li>A few countries appear only in some years (for example, Taiwan in 2023 only).</li>
            <li>The data shows what changed, not why.</li>
          </ul>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <a
              href="https://github.com/shihariAyodya/sri-lanka-tourism-analysis"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-teal-500 px-4 py-2 font-medium text-white hover:bg-teal-400"
            >
              View Full Analysis on GitHub
            </a>
            <a
              href="https://shihari.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-teal-400"
            >
              My Portfolio
            </a>
          </div>
        </Panel>

        <footer className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          Built by Shihari Ayodya · React, Tailwind CSS, Recharts
        </footer>
      </div>
    </div>
  )
}

export default App