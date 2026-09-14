import { createClient } from './client'
import { useAppStore } from '@/lib/store/appStore'
import type { Product, ExpenseCategory } from '@/types'

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Belanja Bahan Baku', icon: '🛒', color: '#EF4444', is_default: true },
  { name: 'Gas & Energi', icon: '🔥', color: '#F97316', is_default: true },
  { name: 'Gaji Karyawan', icon: '👷', color: '#3B82F6', is_default: true },
  { name: 'Transportasi', icon: '🚗', color: '#8B5CF6', is_default: true },
  { name: 'Packaging & Kemasan', icon: '📦', color: '#EC4899', is_default: true },
  { name: 'Perawatan & Servis', icon: '🔧', color: '#14B8A6', is_default: true },
  { name: 'Promosi & Marketing', icon: '📣', color: '#F59E0B', is_default: true },
  { name: 'Lain-lain', icon: '🧾', color: '#6B7280', is_default: true },
]

// Pull semua data store dari Supabase ke LocalStorage cache
export async function pullFromSupabase(storeId: string) {
  const supabase = createClient()
  const { setSyncStatus, setProducts, setExpenseCategories } = useAppStore.getState()

  setSyncStatus('syncing')

  try {
    // Pull products
    const { data: products, error: pErr } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('name')

    if (pErr) throw pErr
    if (products) setProducts(products as Product[])

    // Pull expense categories
    const { data: cats, error: cErr } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('store_id', storeId)
      .order('is_default', { ascending: false })

    if (cErr) throw cErr
    if (cats) setExpenseCategories(cats as ExpenseCategory[])

    setSyncStatus('synced')
  } catch (err) {
    console.error('Pull from Supabase failed:', err)
    setSyncStatus('error')
  }
}

// Push pending sync queue ke Supabase
export async function pushPendingSync() {
  const supabase = createClient()
  const { pendingSync, clearPendingSync, setSyncStatus } = useAppStore.getState()

  if (pendingSync.length === 0) {
    setSyncStatus('synced')
    return
  }

  setSyncStatus('syncing')

  try {
    for (const item of pendingSync) {
      if (item.action === 'insert') {
        await supabase.from(item.table).insert(item.payload)
      } else if (item.action === 'update') {
        const { id, ...rest } = item.payload as Record<string, unknown>
        await supabase.from(item.table).update(rest).eq('id', id)
      } else if (item.action === 'delete') {
        const { id } = item.payload as Record<string, unknown>
        await supabase.from(item.table).delete().eq('id', id as string)
      }
    }
    clearPendingSync()
    setSyncStatus('synced')
  } catch (err) {
    console.error('Push pending sync failed:', err)
    setSyncStatus('error')
  }
}

// Setup online listener — auto sync saat koneksi balik
export function setupOnlineListener() {
  const handleOnline = async () => {
    const { currentStore } = useAppStore.getState()
    await pushPendingSync()
    if (currentStore) await pullFromSupabase(currentStore.id)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', () => {
    useAppStore.getState().setSyncStatus('offline')
  })

  // Set initial status
  if (!navigator.onLine) {
    useAppStore.getState().setSyncStatus('offline')
  }

  return () => {
    window.removeEventListener('online', handleOnline)
  }
}

// Seed default expense categories untuk store baru
export async function seedDefaultCategories(storeId: string) {
  const supabase = createClient()

  const categories = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
    ...cat,
    store_id: storeId,
  }))

  const { error } = await supabase.from('expense_categories').insert(categories)
  if (error) console.error('Seed categories failed:', error)
}
