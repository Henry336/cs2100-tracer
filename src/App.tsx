import { Suspense, useEffect, useState } from 'react'
import { href, useLocation } from './lib/router'
import { GROUPS, MODULES } from './modules/registry'
import { Home } from './pages/Home'

type Theme = 'system' | 'light' | 'dark'

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage blocked: theme still applies for this visit */
    }
  }, [theme])
  return [theme, setTheme]
}

export function BrandMark() {
  // A tiny 2x2 "die": four functional blocks, one lit.
  return (
    <svg className="brand-mark" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="1" width="24" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="5" width="7" height="7" fill="var(--sig-path)" />
      <rect x="14" y="5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="5" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default function App() {
  const { path } = useLocation()
  const [theme, setTheme] = useTheme()
  const [railOpen, setRailOpen] = useState(false)
  const mod = MODULES.find((m) => m.path === path)

  useEffect(() => {
    setRailOpen(false)
    document.title = mod ? `${mod.title} | CS2100 Tracer` : 'CS2100 Tracer'
    window.scrollTo(0, 0)
  }, [path, mod])

  const Page = mod?.component

  return (
    <div className={`app${railOpen ? ' rail-open' : ''}`}>
      <div className="topbar">
        <a className="brand" href={href('/')}>
          <BrandMark />
          <span className="brand-name">CS2100 Tracer</span>
        </a>
        <button type="button" aria-expanded={railOpen} onClick={() => setRailOpen((o) => !o)}>
          {railOpen ? 'Close' : 'Modules'}
        </button>
      </div>
      <nav className="rail" aria-label="Modules">
        <a className="brand" href={href('/')}>
          <BrandMark />
          <span className="brand-name">
            CS2100 Tracer
            <span className="brand-sub">Computer Organisation, traced</span>
          </span>
        </a>
        {GROUPS.map((g) => (
          <div className="rail-group" key={g}>
            <h2>{g}</h2>
            <ul>
              {MODULES.filter((m) => m.group === g).map((m) => (
                <li key={m.id}>
                  <a className="rail-link" href={href(m.path)} aria-current={m.path === path ? 'page' : undefined}>
                    <span>{m.title}</span>
                    <span className="rail-lec">{m.lectures}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="rail-foot">
          <div className="theme-switch" role="group" aria-label="Colour theme">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
          <p>
            Keys: <kbd>←</kbd> <kbd>→</kbd> step, <kbd>Space</kbd> play
          </p>
          <p>Unofficial study aid for NUS CS2100. Not affiliated with NUS. Do not use on graded work.</p>
        </div>
      </nav>
      <main className="app-main" id="main">
        {Page ? (
          <Suspense fallback={<p className="loading">Loading {mod.title}…</p>}>
            <Page />
          </Suspense>
        ) : path === '/' ? (
          <Home />
        ) : (
          <div className="workspace">
            <h1>No page at {path}</h1>
            <p>
              <a href={href('/')}>Go to the module map</a>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
