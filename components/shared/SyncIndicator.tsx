'use client'

import { useAppStore } from '@/lib/store/appStore'

export function SyncIndicator() {
  const syncStatus = useAppStore((s) => s.syncStatus)

  const config = {
    synced:  { color: '#16A34A', label: 'Tersinkron',  pulse: false },
    syncing: { color: '#D97706', label: 'Menyinkron…', pulse: true  },
    offline: { color: '#DC2626', label: 'Offline',     pulse: false },
    error:   { color: '#DC2626', label: 'Gagal sync',  pulse: false },
  }[syncStatus]

  return (
    <div className="sync-indicator" title={config.label}>
      <span
        className={`sync-dot${config.pulse ? ' animate-pulse-dot' : ''}`}
        style={{ background: config.color }}
      />
      <span className="sync-label">{config.label}</span>

      <style jsx>{`
        .sync-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--text-muted);
          cursor: default;
        }
        .sync-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sync-label { display: none; }
        @media (min-width: 768px) { .sync-label { display: block; } }
      `}</style>
    </div>
  )
}
