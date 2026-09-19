'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, Settings, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { toISODate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import type { Transaction, ExpenseCategory } from '@/types'

interface ExpenseModalProps {
  open: boolean
  onClose: () => void
  onSaved?: (tx: Transaction) => void
}

const FALLBACK_CATS: Pick<ExpenseCategory, 'id' | 'name' | 'icon' | 'color'>[] = [
  { id: 'f-1', name: 'Bahan Baku',   icon: '🛒', color: '#EF4444' },
  { id: 'f-2', name: 'Gas & Energi', icon: '🔥', color: '#F97316' },
  { id: 'f-3', name: 'Gaji',         icon: '👷', color: '#3B82F6' },
  { id: 'f-4', name: 'Transportasi', icon: '🚗', color: '#8B5CF6' },
  { id: 'f-5', name: 'Lain-lain',    icon: '🧾', color: '#6B7280' },
]

// Format angka dengan titik: 18000 → "18.000"
function formatWithDot(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('id-ID')
}

function parseDot(formatted: string): number {
  return parseInt(formatted.replace(/\./g, ''), 10) || 0
}

export function ExpenseModal({ open, onClose, onSaved }: ExpenseModalProps) {
  const router = useRouter()
  const currentStore         = useAppStore((s) => s.currentStore)
  const expenseCategories    = useAppStore((s) => s.expenseCategories)
  const addPendingSync       = useAppStore((s) => s.addPendingSync)

  // Form state — urutan: tanggal → nominal → kategori → catatan
  const [date,    setDate]    = useState(toISODate())
  const [nominal, setNominal] = useState('')
  const [catId,   setCatId]   = useState('')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  // Dropdown kategori state
  const [dropOpen,    setDropOpen]    = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const isOffline    = typeof navigator !== 'undefined' && !navigator.onLine
  const isDummy      = currentStore?.id === 'dummy-store-001'
  const skipSupabase = isOffline || isDummy

  // Pakai kategori dari store atau fallback
  const cats = expenseCategories.length > 0 ? expenseCategories : FALLBACK_CATS
  const selectedCat = cats.find((c) => c.id === catId) ?? cats[0]

  // Reset form saat buka
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

  // Focus nominal saat modal buka
  const nominalRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setTimeout(() => nominalRef.current?.focus(), 100)
  }, [open])

  // Tutup dropdown kalau klik luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (dropOpen) { setDropOpen(false); return }
        onClose()
      }
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose, dropOpen])

  async function handleSave() {
    const amount = parseDot(nominal)
    if (!amount || amount <= 0) { setError('Nominal harus diisi'); return }
    if (!catId && !selectedCat) { setError('Pilih kategori dulu'); return }
    if (!currentStore)           { setError('Store belum dimuat'); return }

    setSaving(true)
    setError('')

    const tx: Transaction = {
      id:         crypto.randomUUID(),
      store_id:   currentStore.id,
      type:       'expense',
      category:   selectedCat?.name ?? 'Lain-lain',
      amount,
      profit:     0,
      note:       note.trim() || undefined,
      date,
      source:     'manual',
      created_at: new Date().toISOString(),
    }

    if (!skipSupabase) {
      const supabase = createClient()
      const { data, error: e } = await supabase
        .from('transactions')
        .insert({
          store_id: tx.store_id,
          type:     tx.type,
          category: tx.category,
          amount:   tx.amount,
          profit:   0,
          note:     tx.note ?? null,
          date:     tx.date,
          source:   tx.source,
        })
        .select()
        .single()

      if (e) {
        setError('Gagal menyimpan: ' + e.message)
        setSaving(false)
        return
      }
      if (data) tx.id = data.id
    } else {
      addPendingSync({ table: 'transactions', action: 'insert', payload: tx })
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
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn 0.18s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 22,
          width: '100%', maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 20px 0',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              💸 Catat Pengeluaran
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'var(--bg-elevated)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)', transition: 'background 0.15s',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{
            padding: '20px 20px 0',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>

            {/* 1. TANGGAL */}
            <div>
              <label style={labelStyle}>Tanggal</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%', border: '1.5px solid var(--border)', borderRadius: 12,
                  padding: '11px 14px', fontSize: 14, background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 2. NOMINAL */}
            <div>
              <label style={labelStyle}>Nominal</label>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-elevated)',
                border: `2px solid ${nominal ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 14, padding: '0 16px', height: 54,
                transition: 'border-color 0.15s',
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                  Rp
                </span>
                <input
                  ref={nominalRef}
                  inputMode="numeric"
                  placeholder="0"
                  value={nominal}
                  onChange={(e) => setNominal(formatWithDot(e.target.value))}
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 22, fontWeight: 800, color: 'var(--text-primary)',
                    fontFamily: 'Nunito, sans-serif', letterSpacing: '-0.5px', minWidth: 0,
                  }}
                />
              </div>
            </div>

            {/* 3. KATEGORI — Dropdown */}
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Kategori</label>
                <button
                  onClick={() => { onClose(); router.push('/pengaturan') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  <Settings size={11} />
                  Kelola kategori
                </button>
              </div>

              {/* Dropdown trigger */}
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropOpen((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 12,
                    border: `1.5px solid ${dropOpen ? 'var(--accent)' : 'var(--border)'}`,
                    background: 'var(--bg-elevated)', cursor: 'pointer',
                    textAlign: 'left', transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                >
                  {selectedCat ? (
                    <>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: (selectedCat.color ?? '#6B7280') + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {selectedCat.icon}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedCat.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ flex: 1, fontSize: 14, color: 'var(--text-muted)' }}>
                      Pilih kategori...
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    color="var(--text-muted)"
                    style={{
                      flexShrink: 0,
                      transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }}
                  />
                </button>

                {/* Dropdown list */}
                {dropOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: 'var(--bg-surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 14,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    zIndex: 10, overflow: 'hidden',
                    animation: 'fadeIn 0.12s ease',
                    maxHeight: 240, overflowY: 'auto',
                  }}>
                    {cats.map((cat, i) => {
                      const isActive = catId === cat.id || (!catId && i === 0)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { setCatId(cat.id); setDropOpen(false) }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '11px 14px', border: 'none', cursor: 'pointer',
                            background: isActive ? 'var(--accent-subtle)' : 'transparent',
                            textAlign: 'left', transition: 'background 0.1s',
                            borderBottom: i < cats.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <div style={{
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: (cat.color ?? '#6B7280') + '18',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                          }}>
                            {cat.icon}
                          </div>
                          <span style={{
                            flex: 1, fontSize: 14,
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                          }}>
                            {cat.name}
                          </span>
                          {isActive && (
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--accent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
              <label style={labelStyle}>
                Catatan{' '}
                <span style={{ opacity: 0.5, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (opsional)
                </span>
              </label>
              <textarea
                placeholder="Contoh: Belanja sayuran dari Pasar Lama..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{
                  width: '100%', border: '1.5px solid var(--border)', borderRadius: 12,
                  padding: '11px 14px', fontSize: 14, background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                  resize: 'none', boxSizing: 'border-box', lineHeight: 1.5,
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--danger)', margin: '-8px 0 0' }}>
                ⚠️ {error}
              </p>
            )}
          </div>

          {/* ── Footer — hanya tombol Simpan ── */}
          <div style={{ padding: '18px 20px 20px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%', padding: '14px',
                borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', border: 'none',
                background: saving ? 'var(--text-muted)' : 'var(--accent)',
                color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.15s, transform 0.15s',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(217,43,43,0.30)',
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Menyimpan...
                </>
              ) : (
                '✓ Simpan Pengeluaran'
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  )
}

// Label style helper
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
  display: 'block',
}