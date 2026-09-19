// ─── Auth & Store ────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
}

export interface Store {
  id: string
  user_id: string
  name: string
  logo_url?: string
  store_code: string
  created_at: string
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  store_id: string
  name: string
  icon: string
  photo_url?: string
  price: number
  hpp: number
  unit: string
  stock_qty?: number
  is_active: boolean
  created_at: string
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionType   = 'income' | 'expense'
export type PaymentMethodType = 'cash' | 'qris'

export interface Transaction {
  id: string
  store_id: string
  type: TransactionType
  product_id?: string
  product_name?: string
  category: string
  qty?: number
  amount: number
  profit?: number
  note?: string
  date: string
  source: 'kasir' | 'catering' | 'manual'
  payment_method?: PaymentMethodType
  created_at: string
}

// ─── Sales (kasir) — tabel `sales` ─────────────────────────────────────────────
export interface Sale {
  id: string
  store_id: string
  product_id?: string
  product_name?: string
  category: string
  qty: number
  amount: number
  profit: number
  payment_method?: PaymentMethodType
  note?: string
  date: string
  source: 'kasir' | 'catering'
  created_at: string
}

// ─── Expenses (pengeluaran manual) — tabel `expenses` ──────────────────────────
export interface Expense {
  id: string
  store_id: string
  category: string
  amount: number
  note?: string
  date: string
  source: 'manual'
  created_at: string
}

// ─── Expense Categories ───────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: string
  store_id: string
  name: string
  icon: string
  color: string
  is_default: boolean
}

// ─── Catering ────────────────────────────────────────────────────────────────

export interface CateringPackage {
  id: string
  store_id: string
  name: string
  description?: string
  price: number
  hpp: number
  min_qty: number
  icon: string
  photo_url?: string
  is_active: boolean
  created_at: string
}

export type OrderStatus = 'pending' | 'dp_paid' | 'paid'

export interface CateringOrder {
  id: string
  store_id: string
  customer_name: string
  customer_phone: string
  customer_org?: string
  event_date: string
  event_time?: string
  delivery_address: string
  notes?: string
  total_amount: number
  dp_amount: number
  remaining_amount: number
  status: OrderStatus
  items?: CateringOrderItem[]
  created_at: string
  updated_at: string
}

export interface CateringOrderItem {
  id: string
  order_id: string
  package_id?: string
  item_name: string
  qty: number
  unit_price: number
  hpp: number
  subtotal: number
}

// ─── Kasir / POS ─────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product
  qty: number
  subtotal: number
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DailySummary {
  date: string
  income: number
  expense: number
  profit: number
  transaction_count: number
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  profit: number
  catering_income: number
  kasir_income: number
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'offline' | 'syncing' | 'error'

export interface PendingSync {
  id: string
  table: string
  action: 'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  created_at: string
}