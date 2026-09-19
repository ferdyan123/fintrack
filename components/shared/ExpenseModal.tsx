'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, Settings, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { toISODate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { Expense, ExpenseCategory } from '@/types'

interface ExpenseModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (tx: Expense) => void
}

const FALLBACK_CATS: Pick<ExpenseCategory, 'id' | 'name' | 'icon' | 'color'>[] = [
  { id: 'f-1', name: 'Bahan Baku',   icon: '🛒', color: '#EF4444' },
  { id: 'f-2', name: 'Gas & Energi', icon: '🔥', color: '#F97316' },
  { id: 'f-3', name: 'Gaji',         icon: '👷', color: '#3B82F6' },
  { id: 'f-4', name: 'Transportasi', icon: '🚗', color: '#8B5CF6' },
  { id: 'f-5', name: 'Lain-lain',    icon: '🧾', color: '#6B7280' },
]

function formatWithDot(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('id-ID')
}

function parseDot(formatted: string): number {
  return parseInt(formatted.replace(/\./g, ''), 10) || 0
}

export function ExpenseModal({ open, onClose, onSaved }: ExpenseModalProps) {
  const router              = useRouter()
  const currentStore        = useAppStore((s) => s.currentStore)
  const expenseCategories   = useAppStore((s) => s.expenseCategories)
  const addPendingSync      = useAppStore((s) => s.addPendingSync)

  const [date,     setDate]     = useState(toISODate())
  const [nominal,  setNominal]  = useState('')
  const [catId,    setCatId]    = useState('')
  const [note,     setNote]     = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [dropOpen, setDropOpen] = useState(false)

  const dropRef    = useRef<HTMLDivElement>(null)
  const nominalRef = useRef<HTMLInputElement>(null)

  const isOffline    = typeof navigator !== 'undefined' && !navigator.onLine
  const isDummy      = !currentStore || currentStore.id === 'dummy-store-001'
  const skipSupabase = isOffline || isDummy

  const cats        = expenseCategories.length > 0 ? expenseCategories : FALLBACK_CATS
  const selectedCat = cats.find((c) => c.id === catId) ?? cats[0]

  // Reset form
  useEffect(() => {
    if (open) {
      setDate(toISODate())
      setNominal('')
      setCatId(cats[0]?.id ?? '')
      setNote('')
      setError('')
      setDropOpen(false)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus nominal
  useEffect(() => {
    if (open) setTimeout(() => nominalRef.current?.focus(), 120)
  }, [open])

  // Tutup dropdown klik luar
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (dropOpen) { setDropOpen(false); return } onClose() }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose, dropOpen])

  async function handleSave() {
    const amount = parseDot(nominal)
    if (!amount || amount <= 0) { setError('Nominal harus diisi'); return }
    if (!currentStore)           { setError('Store belum dimuat'); return }

    setSaving(true)
    setError('')

    const tx: Expense = {
      id:         crypto.randomUUID(),
      store_id:   currentStore.id,
      category:   selectedCat?.name ?? 'Lain-lain',
      amount,
      note:       note.trim() || undefined,
      date,
      source:     'manual',
      created_at: new Date().toISOString(),
    }

    if (!skipSupabase) {
      const supabase = createClient()
      const { data, error: e } = await supabase
        .from('expenses')
        .insert({
          store_id: tx.store_id,
          category: tx.category,
          amount:   tx.amount,
          note:     tx.note ?? null,
          date:     tx.date,
          source:   tx.source,
        })
        .select()
        .single()

      if (e) {
        setError('Gagal menyimpan. Coba lagi.')
        setSaving(false)
        return
      }
      if (data) tx.id = data.id
    } else {
      addPendingSync({ table: 'expenses', action: 'insert', payload: tx })
    }

    onSaved?.(tx)
    setSaving(false)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Sheet — bottom sheet on mobile, centered on desktop */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480,
          boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
          maxHeight: '92dvh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.22s cubic-bezier(0.32,0.72,0,1)',
        }}>

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border)' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 0' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
              💸 Catat Pengeluaran
            </div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--bg-elevated)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* 1. TANGGAL */}
            <div>
              <label style={lbl}>Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputBase }}
              />
            </div>

            {/* 2. NOMINAL */}
            <div>
              <label style={lbl}>Nominal</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)',
                border: `2px solid ${nominal ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '0 14px', height: 48,
                transition: 'border-color 0.15s',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>Rp</span>
                <input
                  ref={nominalRef}
                  inputMode="numeric"
                  placeholder="0"
                  value={nominal}
                  onChange={(e) => setNominal(formatWithDot(e.target.value))}
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', minWidth: 0 }}
                />
              </div>
            </div>

            {/* 3. KATEGORI */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Kategori</label>
                <button
                  onClick={() => { onClose(); router.push('/pengaturan') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Settings size={10} />
                  Kelola
                </button>
              </div>

              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropOpen((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '9px 12px', borderRadius: 12,
                    border: `1.5px solid ${dropOpen ? 'var(--accent)' : 'var(--border)'}`,
                    background: 'var(--bg-elevated)', cursor: 'pointer',
                    textAlign: 'left', transition: 'border-color 0.15s', boxSizing: 'border-box',
                  }}
                >
                  {selectedCat && (
                    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: (selectedCat.color ?? '#6B7280') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                      {selectedCat.icon}
                    </div>
                  )}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedCat?.name ?? 'Pilih kategori...'}
                  </span>
                  <ChevronDown size={15} color="var(--text-muted)" style={{ flexShrink: 0, transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>

                {dropOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
                    background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 10, overflow: 'hidden', maxHeight: 200, overflowY: 'auto',
                    animation: 'fadeIn 0.1s ease',
                  }}>
                    {cats.map((cat, i) => {
                      const isActive = catId === cat.id || (!catId && i === 0)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { setCatId(cat.id); setDropOpen(false) }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                            padding: '9px 12px', border: 'none', cursor: 'pointer',
                            background: isActive ? 'var(--accent-subtle)' : 'transparent',
                            textAlign: 'left',
                            borderBottom: i < cats.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: (cat.color ?? '#6B7280') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                            {cat.icon}
                          </div>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {cat.name}
                          </span>
                          {isActive && (
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 4. CATATAN */}
            <div>
              <label style={lbl}>
                Catatan <span style={{ opacity: 0.45, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opsional)</span>
              </label>
              <textarea
                placeholder="Contoh: Belanja sayuran dari Pasar Lama..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{ ...inputBase, resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10 }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 11, color: 'var(--danger)', margin: '-4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* Footer — fixed di bawah */}
          <div style={{ padding: '12px 18px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '13px',
                borderRadius: 13, fontSize: 14, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', border: 'none',
                background: saving ? 'var(--text-muted)' : 'var(--accent)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: saving ? 'none' : '0 4px 14px rgba(217,43,43,0.28)',
                transition: 'transform 0.12s',
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {saving ? (
                <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</>
              ) : (
                '✓ Simpan Pengeluaran'
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); }  to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; }               to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        /* Desktop: tampilkan modal di tengah, bukan bottom sheet */
        @media (min-width: 640px) {
          .expense-modal-overlay {
            align-items: center !important;
            padding: 20px !important;
          }
          .expense-modal-sheet {
            border-radius: 20px !important;
            max-height: 90vh !important;
          }
        }
      `}</style>
    </>
  )
}

// ─── Shared styles ──────────────────────────────────────────────────────────

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 5,
  display: 'block',
}

const inputBase: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid var(--border)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}