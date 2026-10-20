import { supabase } from './supabase';
import type { Product } from '../types/database';

const STORAGE_KEY = 'tryvoal_pinned_product_ids';
const DB_PREFIX_TAG = 'PINNED_PRODUCTS_DATA:';

// Helper: Normalize product ID for matching
export function normalizeProductId(id: unknown): string {
  if (id === null || id === undefined) return '';
  return String(id).trim().toLowerCase();
}

// Get cached array of pinned product IDs from localStorage
export function getCachedPinnedProductIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('elitebath_pinned_product_ids');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => String(item).trim()).filter(Boolean)));
  } catch {
    return [];
  }
}

// Check if a specific product ID is pinned in cache
export function isProductPinned(productId: unknown): boolean {
  const norm = normalizeProductId(productId);
  if (!norm) return false;
  const ids = getCachedPinnedProductIds();
  return ids.some((id) => normalizeProductId(id) === norm);
}

// Robust helper to check if a Product is pinned across all possible fields and cache
export function isProductEffectivelyPinned(product: Product | null | undefined, pinnedIds?: string[]): boolean {
  if (!product) return false;
  if (product.is_pinned === true) return true;

  const cfg = product.variant_config as any;
  if (cfg) {
    if (cfg.is_pinned === true || cfg.is_pinned === 'true') return true;
    if (typeof cfg === 'string' && (cfg.includes('"is_pinned":true') || cfg.includes('"is_pinned":"true"'))) {
      return true;
    }
  }

  const normId = normalizeProductId(product.id);
  if (!normId) return false;

  const list = pinnedIds && pinnedIds.length > 0 ? pinnedIds : getCachedPinnedProductIds();
  return list.some((id) => normalizeProductId(id) === normId);
}

// Fetch pinned product IDs from Supabase database to ensure 100% sync across all devices
export async function fetchPinnedProductIds(): Promise<string[]> {
  const foundPinnedIds = new Set<string>();

  // 1. Primary: Check products table (variant_config JSONB)
  // Query ONLY guaranteed columns: id, variant_config
  try {
    const { data: prodData, error } = await supabase
      .from('products')
      .select('id, variant_config');

    if (!error && prodData && prodData.length > 0) {
      for (const p of prodData) {
        let cfg = p.variant_config;
        if (typeof cfg === 'string') {
          try {
            cfg = JSON.parse(cfg);
          } catch {
            cfg = null;
          }
        }
        if (cfg && (cfg.is_pinned === true || cfg.is_pinned === 'true')) {
          foundPinnedIds.add(String(p.id));
        }
      }
    }
  } catch (err) {
    console.warn('Could not check products variant_config for pinned items:', err);
  }

  // 2. Secondary: Check if native is_pinned column exists in products table
  try {
    const { data: colData, error: colErr } = await supabase
      .from('products')
      .select('id')
      .eq('is_pinned', true);

    if (!colErr && colData && colData.length > 0) {
      for (const c of colData) {
        foundPinnedIds.add(String(c.id));
      }
    }
  } catch {
    // Column is_pinned does not exist yet, safely continue
  }

  // 3. Redundancy: Check site_announcements backup storage
  try {
    const { data: annData, error: annErr } = await supabase
      .from('site_announcements')
      .select('id, message, created_at')
      .ilike('message', '%PINNED_PRODUCTS%')
      .order('created_at', { ascending: false });

    if (!annErr && annData && annData.length > 0) {
      for (const row of annData) {
        if (!row.message) continue;
        const start = row.message.indexOf('[');
        const end = row.message.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const parsed = JSON.parse(row.message.substring(start, end + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const id of parsed) {
                foundPinnedIds.add(String(id));
              }
              break; // Newest announcement row was found and parsed
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch pinned products from announcements:', err);
  }

  // 4. Redundancy: check site_settings table if it exists
  try {
    const { data: settingData, error: settingErr } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pinned_products')
      .maybeSingle();

    if (!settingErr && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (Array.isArray(val) && val.length > 0) {
        for (const id of val) {
          foundPinnedIds.add(String(id));
        }
      }
    }
  } catch {
    // site_settings table may not exist
  }

  // If database had pinned items, save to localStorage and return
  if (foundPinnedIds.size > 0) {
    const cleanList = Array.from(foundPinnedIds);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanList));
      window.dispatchEvent(new CustomEvent('pinned_products_updated', { detail: cleanList }));
    }
    return cleanList;
  }

  // Fallback to local storage cache if offline or DB empty
  return getCachedPinnedProductIds();
}

// Persist pinned product IDs to local storage and sync to database across devices
export async function savePinnedProductIds(
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const uniqueIds = Array.from(new Set(ids.map(String).filter(Boolean)));

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds));
      window.dispatchEvent(new CustomEvent('pinned_products_updated', { detail: uniqueIds }));
    }

    let dbSuccess = false;
    let dbNotice = '';

    // 1. Redundancy: site_announcements table
    try {
      const payload = `${DB_PREFIX_TAG}${JSON.stringify(uniqueIds)}`;
      const { data: existingRows } = await supabase
        .from('site_announcements')
        .select('id')
        .ilike('message', '%PINNED_PRODUCTS%');

      if (existingRows && existingRows.length > 0) {
        const updateIds = existingRows.map((r: any) => r.id);
        const { error: updErr } = await supabase
          .from('site_announcements')
          .update({ message: payload, active: false })
          .in('id', updateIds);

        if (!updErr) dbSuccess = true;
      } else {
        const { error: insErr } = await supabase
          .from('site_announcements')
          .insert({ message: payload, active: false });

        if (!insErr) dbSuccess = true;
      }
    } catch (e: any) {
      dbNotice = e?.message || String(e);
    }

    // 2. Redundancy: site_settings upsert (if table exists)
    try {
      await supabase.from('site_settings').upsert({
        key: 'pinned_products',
        value: uniqueIds,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Table may not exist
    }

    // 3. Best-effort: update is_pinned column in products table if possible
    try {
      await supabase
        .from('products')
        .update({ is_pinned: false })
        .eq('is_pinned', true);

      if (uniqueIds.length > 0) {
        await supabase
          .from('products')
          .update({ is_pinned: true })
          .in('id', uniqueIds);
      }
      dbSuccess = true;
    } catch {
      // Column is_pinned may not exist yet
    }

    return { success: true, error: dbSuccess ? undefined : dbNotice };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// Explicitly set pin status of a single product
export async function setProductPinStatus(
  productId: string,
  isPinned: boolean
): Promise<{ success: boolean; is_pinned: boolean; ids: string[]; error?: string }> {
  const normTarget = normalizeProductId(productId);
  const current = getCachedPinnedProductIds();
  const updated = isPinned
    ? Array.from(new Set([...current.filter((id) => normalizeProductId(id) !== normTarget), productId]))
    : current.filter((id) => normalizeProductId(id) !== normTarget);

  // 1. Immediately update local storage and notify listeners
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('pinned_products_updated', { detail: updated }));
  }

  // 2. Fast single-product update in Supabase products table (variant_config JSONB)
  try {
    const { data: prodData } = await supabase
      .from('products')
      .select('variant_config')
      .eq('id', productId)
      .maybeSingle();

    let cfg = prodData?.variant_config;
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    } else if (!cfg || typeof cfg !== 'object') {
      cfg = {};
    }

    cfg.is_pinned = isPinned;

    await supabase
      .from('products')
      .update({ variant_config: cfg })
      .eq('id', productId);
  } catch (err) {
    console.warn('Failed to update product variant_config on pin set:', err);
  }

  // 3. Best-effort update of native is_pinned column
  try {
    await supabase
      .from('products')
      .update({ is_pinned: isPinned })
      .eq('id', productId);
  } catch {
    // Safely ignore if column does not exist
  }

  // 4. Sync full array to backup storage (site_announcements & site_settings)
  const res = await savePinnedProductIds(updated);

  return {
    success: res.success,
    is_pinned: isPinned,
    ids: updated,
    error: res.error,
  };
}

// Toggle pin status of a single product
export async function togglePinProduct(
  productId: string
): Promise<{ success: boolean; is_pinned: boolean; ids: string[]; error?: string }> {
  const normTarget = normalizeProductId(productId);
  const current = getCachedPinnedProductIds();
  const isCurrentlyPinned = current.some((id) => normalizeProductId(id) === normTarget);
  const newStatus = !isCurrentlyPinned;

  return setProductPinStatus(productId, newStatus);
}
