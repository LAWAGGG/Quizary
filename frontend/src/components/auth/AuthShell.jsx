import { AppMark, AuroraBg } from '../ui'

const BUBBLES = Array.from({ length: 16 }, (_, i) => i)

export function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-ink text-white p-12 overflow-hidden relative">
        <AuroraBg base="#6C5CE7" className="opacity-40" />
        <div className="absolute inset-0 dot-grid-light opacity-50 pointer-events-none" aria-hidden="true" />
        <div className="flex items-center gap-3 relative">
          <AppMark size="sm" />
          <span className="font-display font-bold text-lg">Quizary</span>
        </div>

        <div className="relative max-w-md">
          <div
            className="absolute -top-20 -left-24 w-64 h-64 rounded-full bg-primary/25 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <p className="eyebrow !text-primary-300">Form &amp; Quiz Studio</p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1.15] tracking-tight">
            Make a quiz.<br />Share a link.<br />Read the answers.
          </h2>
          <p className="mt-4 text-white/50 text-base leading-relaxed">
            Quizzes get scheduled timers, anti-cheat, auto-grading, and leaderboards.
            Surveys stay plain and simple.
          </p>
        </div>

        <div className="flex items-center gap-4 relative">
          <div className="grid grid-cols-4 gap-2.5">
            {BUBBLES.map((i) => (
              <span
                key={i}
                className={`w-6 h-6 rounded-full border-2 transition-colors ${
                  i === 3 || i === 6 || i === 9 || i === 14 ? 'border-primary bg-primary' : 'border-white/25'
                }`}
              />
            ))}
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-primary-300">4/16</p>
            <p className="text-xs text-white/40 mt-0.5">bubbles filled</p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-paper dark:bg-ink-950 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <AppMark size="sm" />
            <span className="font-display font-bold text-lg text-ink dark:text-gray-100">Quizary</span>
          </div>

          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink dark:text-gray-100">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
