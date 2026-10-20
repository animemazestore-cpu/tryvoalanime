import { supabase } from './supabase';

const STORAGE_KEY = 'tryvoal_pinned_product_ids';
const DB_PREFIX_TAG = '[PINNED_PRODUCTS_JSON]:';

// Get cached array of pinned product IDs from localStorage
export function getCachedPinnedProductIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Check if a specific product ID is pinned
export function isProductPinned(productId: string): boolean {
  if (!productId) return false;
  const ids = getCachedPinnedProductIds();
  return ids.includes(productId);
}

// Fetch pinned product IDs from Supabase database
export async function fetchPinnedProductIds(): Promise<string[]> {
  let pinnedIds = getCachedPinnedProductIds();

  // 1. Try fetching from site_settings table
  try {
    const { data: settingData, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pinned_products')
      .maybeSingle();

    if (!error && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (Array.isArray(val)) {
        pinnedIds = Array.from(new Set([...pinnedIds, ...val]));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
        }
        return pinnedIds;
      }
    }
  } catch {
    // site_settings table may not exist yet
  }

  // 2. Try fetching from site_announcements backup storage
  try {
    const { data: annData } = await supabase
      .from('site_announcements')
      .select('message')
      .like('message', `${DB_PREFIX_TAG}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (annData && annData.length > 0 && annData[0].message) {
      const jsonStr = annData[0].message.replace(DB_PREFIX_TAG, '');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        pinnedIds = Array.from(new Set([...pinnedIds, ...parsed]));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
        }
        return pinnedIds;
      }
    }
  } catch (err) {
    console.warn('Could not fetch pinned products from Supabase announcements:', err);
  }

  // 3. Fallback: check if products table has rows with is_pinned = true
  try {
    const { data: prodData } = await supabase
      .from('products')
      .select('id')
      .eq('is_pinned', true);

    if (prodData && prodData.length > 0) {
      const dbIds = prodData.map((p: any) => p.id);
      pinnedIds = Array.from(new Set([...pinnedIds, ...dbIds]));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedIds));
      }
      return pinnedIds;
    }
  } catch {
    // column is_pinned might not exist yet in products table
  }

  return pinnedIds;
}

// Persist pinned product IDs to local storage and sync to database
export async function savePinnedProductIds(
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const uniqueIds = Array.from(new Set(ids));

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds));
    }

    let dbSuccess = false;
    let dbNotice = '';

    // Attempt 1: site_settings upsert
    try {
      const { error } = await supabase.from('site_settings').upsert({
        key: 'pinned_products',
        value: uniqueIds,
        updated_at: new Date().toISOString(),
      });
      if (!error) dbSuccess = true;
      else dbNotice = error.message;
    } catch (e: any) {
      dbNotice = e?.message || String(e);
    }

    // Attempt 2: site_announcements backup
    try {
      const payload = `${DB_PREFIX_TAG}${JSON.stringify(uniqueIds)}`;
      const { data: existing } = await supabase
        .from('site_announcements')
        .select('id')
        .like('message', `${DB_PREFIX_TAG}%`)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('site_announcements')
          .update({
            message: payload,
            is_active: false,
          })
          .eq('id', existing[0].id);
        dbSuccess = true;
      } else {
        await supabase.from('site_announcements').insert({
          message: payload,
          is_active: false,
        });
        dbSuccess = true;
      }
    } catch (e) {
      // ignore backup error
    }

    // Dispatch event for instant UI re-render across open pages
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pinned_products_updated', { detail: uniqueIds })
      );
    }

    return { success: true, error: dbSuccess ? undefined : dbNotice };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// Toggle pin status of a single product
export async function togglePinProduct(
  productId: string
): Promise<{ success: boolean; is_pinned: boolean; ids: string[]; error?: string }> {
  const current = getCachedPinnedProductIds();
  const isCurrentlyPinned = current.includes(productId);
  const updated = isCurrentlyPinned
    ? current.filter((id) => id !== productId)
    : [...current, productId];

  const newStatus = !isCurrentlyPinned;

  // Best effort: update is_pinned column in products table if present
  try {
    await supabase
      .from('products')
      .update({ is_pinned: newStatus })
      .eq('id', productId);
  } catch {
    // Column might not exist in Supabase, safely ignored
  }

  const res = await savePinnedProductIds(updated);

  return {
    success: res.success,
    is_pinned: newStatus,
    ids: updated,
    error: res.error,
  };
}

// Explicitly set pin status of a product
export async function setProductPinStatus(
  productId: string,
  isPinned: boolean
): Promise<{ success: boolean; is_pinned: boolean; ids: string[]; error?: string }> {
  const current = getCachedPinnedProductIds();
  const updated = isPinned
    ? Array.from(new Set([...current, productId]))
    : current.filter((id) => id !== productId);

  try {
    await supabase
      .from('products')
      .update({ is_pinned: isPinned })
      .eq('id', productId);
  } catch {
    // Safely ignore if column doesn't exist
  }

  const res = await savePinnedProductIds(updated);

  return {
    success: res.success,
    is_pinned: isPinned,
    ids: updated,
    error: res.error,
  };
}
