import { createContext, useContext, useCallback, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
let nextId = 0

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5" />,
  error: <XCircle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
}

const STYLES = {
  success: 'text-correct',
  error: 'text-incorrect',
  info: 'text-primary',
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex items-start gap-3 rounded-2xl bg-white border border-gray-100 shadow-lift px-4 py-3.5"
          >
            <span className={`mt-0.5 shrink-0 ${STYLES[t.type]}`}>{ICONS[t.type]}</span>
            <p className="text-sm text-ink flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="p-1 -m-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId))
  }, [])

  const push = useCallback(
    (type, message) => {
      const toastId = ++nextId
      setToasts((prev) => [...prev, { id: toastId, type, message }])
      setTimeout(() => dismiss(toastId), 4000)
    },
    [dismiss]
  )

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
