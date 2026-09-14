'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertCircle,
  info:    Info,
}

const COLORS: Record<ToastType, { bg: string; text: string; icon: string }> = {
  success: { bg: 'var(--success-bg)',  text: '#14532D', icon: 'var(--success)' },
  error:   { bg: 'var(--danger-bg)',   text: '#7F1D1D', icon: 'var(--danger)'  },
  warning: { bg: 'var(--warning-bg)',  text: '#78350F', icon: 'var(--warning)' },
  info:    { bg: '#DBEAFE',            text: '#1E3A8A', icon: '#2563EB'        },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev.slice(-3), { id, type, message }])
    timers.current[id] = setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 80, left: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 8,
        zIndex: 100, pointerEvents: 'none',
      }}>
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          const c = COLORS[t.type]
          return (
            <div key={t.id} className="animate-slide-up" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: c.bg, color: c.text,
              border: `1px solid ${c.icon}30`,
              borderRadius: 14, padding: '12px 14px',
              fontSize: 14, fontWeight: 500,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              pointerEvents: 'auto',
            }}>
              <Icon size={18} color={c.icon} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: c.text, opacity: 0.6, padding: 2, flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
