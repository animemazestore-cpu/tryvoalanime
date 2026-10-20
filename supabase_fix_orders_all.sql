-- ==============================================================================
-- TRYVOAL ANIME STORE - COMPREHENSIVE ORDERS & FULFILLMENT SCHEMA FIX
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Ensure estimated_delivery_date column exists on orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMPTZ;

-- 2. Relax status and payment_status constraints to allow all lifecycle statuses
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN (
      'PENDING_PAYMENT',
      'PENDING_VERIFICATION',
      'PAID',
      'PROCESSING',
      'PACKED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED'
    )),
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN (
      'PENDING_PAYMENT',
      'PENDING_VERIFICATION',
      'PAID',
      'COMPLETED',
      'FAILED',
      'REJECTED'
    ));

-- 3. Ensure order_items has optional product variant fields
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_variant TEXT,
  ADD COLUMN IF NOT EXISTS selected_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS selected_attributes JSONB DEFAULT '{}'::jsonb;

-- 4. Ensure payment_proofs table exists
CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  screenshot_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Fix RLS policies on orders to guarantee customers can create orders and admin can view/manage them
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow users to create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admins full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own order payment status" ON public.orders;

CREATE POLICY "Anyone can create orders" 
  ON public.orders FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can read orders" 
  ON public.orders FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can update orders" 
  ON public.orders FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 6. Fix RLS policies on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow users to insert own order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admins full access to order items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can read order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order_items" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can update order_items" ON public.order_items;

CREATE POLICY "Anyone can read order_items" 
  ON public.order_items FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert order_items" 
  ON public.order_items FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update order_items" 
  ON public.order_items FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 7. Fix RLS policies on payment_proofs
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow users to read own payment proof" ON public.payment_proofs;
DROP POLICY IF EXISTS "Allow users to insert own payment proof" ON public.payment_proofs;
DROP POLICY IF EXISTS "Allow admins full access to payment proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "Anyone can read payment_proofs" ON public.payment_proofs;
DROP POLICY IF EXISTS "Anyone can insert payment_proofs" ON public.payment_proofs;

CREATE POLICY "Anyone can read payment_proofs" 
  ON public.payment_proofs FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can insert payment_proofs" 
  ON public.payment_proofs FOR INSERT 
  WITH CHECK (true);
