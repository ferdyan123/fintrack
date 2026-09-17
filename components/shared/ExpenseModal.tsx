'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store/appStore'
import { toISODate } from '@/lib/utils'
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
  const currentStore      = useAppStore((s) => s.currentStore)
  const expenseCategories = useAppStore((s) => s.expenseCategories)
  const setExpenseCategories = useAppStore((s) => s.setExpenseCategories)
  const addPendingSync    = useAppStore((s) => s.addPendingSync)

  // Form state
  const [nominal,   setNominal]   = useState('')
  const [catId,     setCatId]     = useState('')
  const [date,      setDate]      = useState(toISODate())
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  // Tambah kategori baru
  const [showNewCat,    setShowNewCat]    = useState(false)
  const [newCatName,    setNewCatName]    = useState('')
  const [savingCat,     setSavingCat]     = useState(false)
  const newCatRef = useRef<HTMLInputElement>(null)

  const isOffline  = typeof navigator !== 'undefined' && !navigator.onLine
  const isDummy    = currentStore?.id === 'dummy-store-001'
  const skipSupabase = isOffline || isDummy

  // Pakai kategori dari store atau fallback
  const cats = expenseCategories.length > 0 ? expenseCategories : FALLBACK_CATS

  // Reset form saat buka
  useEffect(() => {
    if (open) {
      setNominal('')
      setCatId(cats[0]?.id ?? '')
      setDate(toISODate())
      setNote('')
      setError('')
      setShowNewCat(false)
      setNewCatName('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input saat modal buka
  const nominalRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setTimeout(() => nominalRef.current?.focus(), 100)
  }, [open])

  // Focus input tambah kategori
  useEffect(() => {
    if (showNewCat) setTimeout(() => newCatRef.current?.focus(), 80)
  }, [showNewCat])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC to close
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  async function handleSaveCategory() {
    const name = newCatName.trim()
    if (!name || !currentStore) return
    setSavingCat(true)

    const newCat: ExpenseCategory = {
      id:         crypto.randomUUID(),
      store_id:   currentStore.id,
      name,
      icon:       '📌',
      color:      '#6B7280',
      is_default: false,
    }

    if (!skipSupabase) {
      const supabase = createClient()
      const { data, error: e } = await supabase
        .from('expense_categories')
        .insert({ ...newCat })
        .select()
        .single()
      if (!e && data) newCat.id = data.id
    } else {
      addPendingSync({ table: 'expense_categories', action: 'insert', payload: newCat })
    }

    setExpenseCategories([...expenseCategories, newCat])
    setCatId(newCat.id)
    setShowNewCat(false)
    setNewCatName('')
    setSavingCat(false)
  }

  async function handleSave() {
    const amount = parseDot(nominal)
    if (!amount || amount <= 0) { setError('Nominal harus diisi'); return }
    if (!catId)                  { setError('Pilih kategori dulu'); return }
    if (!currentStore)           { setError('Store belum dimuat');  return }

    setSaving(true)
    setError('')

    const selectedCat = cats.find((c) => c.id === catId)

    const tx: Transaction = {
      id:           crypto.randomUUID(),
      store_id:     currentStore.id,
      type:         'expense',
      category:     selectedCat?.name ?? 'Lain-lain',
      amount,
      profit:       0,
      note:         note.trim() || undefined,
      date,
      source:       'manual',
      created_at:   new Date().toISOString(),
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

  const S = {
    overlay: {
      position: 'fixed' as const, inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      animation: 'fadeIn 0.18s ease',
    },
    modal: {
      background: 'var(--bg-surface)',
      borderRadius: 20,
      width: '100%', maxWidth: 440,
      boxShadow: 'var(--shadow-md)',
      overflow: 'hidden',
      animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 20px 0',
    },
    body: { padding: '16px 20px 20px', display: 'flex', flexDirection: 'column' as const, gap: 14 },
    label: { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 6, display: 'block' },
    nominalWrap: {
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-elevated)',
      border: '2px solid var(--border)',
      borderRadius: 14, padding: '0 16px', height: 56,
    },
    prefix: { fontSize: 18, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 },
    nominalInput: {
      flex: 1, border: 'none', background: 'transparent', outline: 'none',
      fontSize: 24, fontWeight: 800, color: 'var(--text-primary)',
      fontFamily: 'Nunito, sans-serif', letterSpacing: '-0.5px',
      minWidth: 0,
    },
    chipsWrap: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
    chip: (active: boolean, color?: string) => ({
      padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', border: 'none', transition: 'all 0.15s',
      background: active ? (color ?? 'var(--accent)') : 'var(--bg-elevated)',
      color: active ? 'white' : 'var(--text-secondary)',
      outline: active ? `2px solid ${color ?? 'var(--accent)'}` : 'none',
      outlineOffset: 1,
    }),
    addCatBtn: {
      padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', border: '1.5px dashed var(--border-strong)',
      background: 'transparent', color: 'var(--text-muted)',
      display: 'flex', alignItems: 'center', gap: 4,
      transition: 'all 0.15s',
    },
    newCatRow: {
      display: 'flex', gap: 8, alignItems: 'center',
      marginTop: 8,
    },
    newCatInput: {
      flex: 1, border: '1.5px solid var(--border)', borderRadius: 10,
      padding: '8px 12px', fontSize: 13, background: 'var(--bg-elevated)',
      color: 'var(--text-primary)', outline: 'none',
    },
    dateInput: {
      width: '100%', border: '1.5px solid var(--border)', borderRadius: 12,
      padding: '10px 14px', fontSize: 14, background: 'var(--bg-elevated)',
      color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
    },
    noteInput: {
      width: '100%', border: '1.5px solid var(--border)', borderRadius: 12,
      padding: '10px 14px', fontSize: 14, background: 'var(--bg-elevated)',
      color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
      resize: 'none' as const, minHeight: 64,
    },
    errorMsg: { fontSize: 12, color: 'var(--danger)', marginTop: -6 },
    footer: {
      padding: '0 20px 20px', display: 'flex', gap: 10,
    },
    btnCancel: {
      flex: 1, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 600,
      cursor: 'pointer', border: '1.5px solid var(--border)',
      background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
    },
    btnSave: {
      flex: 2, padding: '13px', borderRadius: 14, fontSize: 14, fontWeight: 700,
      cursor: saving ? 'not-allowed' : 'pointer', border: 'none',
      background: saving ? 'var(--text-muted)' : 'var(--accent)',
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    },
  }

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
              💸 Catat Pengeluaran
            </div>
            {skipSupabase && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>
                ⚡ Mode offline — disimpan lokal
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'var(--bg-elevated)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Nominal */}
          <div>
            <label style={S.label}>Nominal</label>
            <div style={{
              ...S.nominalWrap,
              borderColor: nominal ? 'var(--accent)' : 'var(--border)',
            }}>
              <span style={S.prefix}>Rp</span>
              <input
                ref={nominalRef}
                inputMode="numeric"
                placeholder="0"
                value={nominal}
                onChange={(e) => setNominal(formatWithDot(e.target.value))}
                style={S.nominalInput}
              />
            </div>
          </div>

          {/* Kategori */}
          <div>
            <label style={S.label}>Kategori</label>
            <div style={S.chipsWrap}>
              {cats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCatId(cat.id)}
                  style={S.chip(catId === cat.id, cat.color)}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
              <button
                style={S.addCatBtn}
                onClick={() => setShowNewCat((v) => !v)}
              >
                <Plus size={13} /> Baru
              </button>
            </div>

            {/* Input kategori baru */}
            {showNewCat && (
              <div style={S.newCatRow}>
                <input
                  ref={newCatRef}
                  style={S.newCatInput}
                  placeholder="Nama kategori baru..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCategory() }}
                />
                <button
                  onClick={handleSaveCategory}
                  disabled={savingCat || !newCatName.trim()}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: 'none',
                    background: newCatName.trim() ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: newCatName.trim() ? 'white' : 'var(--text-muted)',
                    cursor: newCatName.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  {savingCat ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Tanggal */}
          <div>
            <label style={S.label}>Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={S.dateInput}
            />
          </div>

          {/* Catatan */}
          <div>
            <label style={S.label}>Catatan <span style={{ opacity: 0.5, fontWeight: 400 }}>(opsional)</span></label>
            <textarea
              placeholder="Contoh: Belanja sayuran dari Pasar Lama..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={S.noteInput}
              rows={2}
            />
          </div>

          {error && <p style={S.errorMsg}>⚠️ {error}</p>}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btnCancel} onClick={onClose}>Batal</button>
          <button style={S.btnSave} onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</>
              : '✓ Simpan Pengeluaran'
            }
          </button>
        </div>

      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}