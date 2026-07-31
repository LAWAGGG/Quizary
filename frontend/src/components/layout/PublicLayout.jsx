import { AppMark } from '../ui'

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-dvh flex flex-col bg-paper">
      <header className="h-16 flex items-center gap-3 px-6 border-b border-gray-200 bg-white">
        <AppMark size="sm" />
        <span className="font-display font-bold text-lg text-ink">Quizary</span>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>
    </div>
  )
}
