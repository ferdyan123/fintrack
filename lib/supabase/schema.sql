-- ================================================
-- FINTRACK V2 — Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── STORES ──────────────────────────────────────────────────────────────────
CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  store_code  TEXT UNIQUE NOT NULL, -- kode 6 karakter untuk kasir
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '🍽️',
  photo_url   TEXT,
  price       BIGINT NOT NULL DEFAULT 0,
  hpp         BIGINT NOT NULL DEFAULT 0,
  unit        TEXT NOT NULL DEFAULT 'porsi',
  stock_qty   INT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EXPENSE CATEGORIES ──────────────────────────────────────────────────────
CREATE TABLE expense_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '📦',
  color       TEXT NOT NULL DEFAULT '#6B7280',
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT,
  category        TEXT NOT NULL DEFAULT 'Umum',
  qty             INT DEFAULT 1,
  amount          BIGINT NOT NULL DEFAULT 0,
  profit          BIGINT DEFAULT 0,
  note            TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('kasir', 'catering', 'manual')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CATERING PACKAGES ───────────────────────────────────────────────────────
CREATE TABLE catering_packages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  price       BIGINT NOT NULL DEFAULT 0,
  hpp         BIGINT NOT NULL DEFAULT 0,
  min_qty     INT NOT NULL DEFAULT 1,
  icon        TEXT NOT NULL DEFAULT '🍱',
  photo_url   TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CATERING ORDERS ─────────────────────────────────────────────────────────
CREATE TABLE catering_orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_name     TEXT NOT NULL,
  customer_phone    TEXT NOT NULL,
  customer_org      TEXT,
  event_date        DATE NOT NULL,
  event_time        TIME,
  delivery_address  TEXT NOT NULL,
  notes             TEXT,
  total_amount      BIGINT NOT NULL DEFAULT 0,
  dp_amount         BIGINT NOT NULL DEFAULT 0,
  remaining_amount  BIGINT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dp_paid', 'paid')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CATERING ORDER ITEMS ─────────────────────────────────────────────────────
CREATE TABLE catering_order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID REFERENCES catering_orders(id) ON DELETE CASCADE NOT NULL,
  package_id  UUID REFERENCES catering_packages(id) ON DELETE SET NULL,
  item_name   TEXT NOT NULL,
  qty         INT NOT NULL DEFAULT 1,
  unit_price  BIGINT NOT NULL DEFAULT 0,
  hpp         BIGINT NOT NULL DEFAULT 0,
  subtotal    BIGINT NOT NULL DEFAULT 0
);

-- ─── CATERING PAYMENTS ────────────────────────────────────────────────────────
CREATE TABLE catering_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES catering_orders(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('dp', 'final')),
  amount          BIGINT NOT NULL DEFAULT 0,
  paid_at         TIMESTAMPTZ DEFAULT NOW(),
  transaction_id  UUID REFERENCES transactions(id) ON DELETE SET NULL
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_payments ENABLE ROW LEVEL SECURITY;

-- Stores: owner bisa CRUD data tokonya sendiri
CREATE POLICY "stores_owner" ON stores FOR ALL
  USING (auth.uid() = user_id);

-- Products: akses via store yang dimiliki user
CREATE POLICY "products_store_owner" ON products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Expense categories: akses via store
CREATE POLICY "expense_categories_store_owner" ON expense_categories FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Transactions: akses via store
CREATE POLICY "transactions_store_owner" ON transactions FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Catering packages: akses via store
CREATE POLICY "catering_packages_store_owner" ON catering_packages FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Catering orders: akses via store
CREATE POLICY "catering_orders_store_owner" ON catering_orders FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Catering order items: via order
CREATE POLICY "catering_items_store_owner" ON catering_order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM catering_orders
    WHERE store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  ));

-- Catering payments: via store
CREATE POLICY "catering_payments_store_owner" ON catering_payments FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- ─── AUTO UPDATE updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catering_orders_updated_at
  BEFORE UPDATE ON catering_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── DEFAULT EXPENSE CATEGORIES (di-insert via app saat register) ─────────────
-- Ini contoh, insert via fungsi register di app:
-- INSERT INTO expense_categories (store_id, name, icon, color, is_default) VALUES
--   (store_id, 'Belanja Bahan Baku', '🛒', '#EF4444', TRUE),
--   (store_id, 'Gas & Energi', '🔥', '#F97316', TRUE),
--   (store_id, 'Gaji Karyawan', '👷', '#3B82F6', TRUE),
--   (store_id, 'Transportasi', '🚗', '#8B5CF6', TRUE),
--   (store_id, 'Packaging', '📦', '#EC4899', TRUE),
--   (store_id, 'Perawatan & Servis', '🔧', '#14B8A6', TRUE),
--   (store_id, 'Promosi & Marketing', '📣', '#F59E0B', TRUE),
--   (store_id, 'Lain-lain', '🧾', '#6B7280', TRUE);
