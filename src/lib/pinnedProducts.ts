import { supabase } from './supabase';

const STORAGE_KEY = 'tryvoal_pinned_product_ids';
const DB_PREFIX_TAG = 'PINNED_PRODUCTS_DATA:';

// Get cached array of pinned product IDs from localStorage
export function getCachedPinnedProductIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
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

// Fetch pinned product IDs from Supabase database to ensure sync across all devices
export async function fetchPinnedProductIds(): Promise<string[]> {
  // 1. Try fetching from site_announcements backup storage with active = false
  try {
    const { data: annData, error } = await supabase
      .from('site_announcements')
      .select('message')
      .ilike('message', '%PINNED_PRODUCTS%')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && annData && annData.length > 0 && annData[0].message) {
      const rawMsg = annData[0].message;
      const jsonStart = rawMsg.indexOf('[');
      const jsonEnd = rawMsg.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonStr = rawMsg.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          const cleanIds = Array.from(new Set(parsed.map(String)));
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanIds));
          }
          return cleanIds;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch pinned products from Supabase announcements:', err);
  }

  // 2. Try fetching from site_settings table if it exists
  try {
    const { data: settingData, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'pinned_products')
      .maybeSingle();

    if (!error && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (Array.isArray(val)) {
        const cleanIds = Array.from(new Set(val.map(String)));
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanIds));
        }
        return cleanIds;
      }
    }
  } catch {
    // site_settings table may not exist
  }

  // 3. Fallback: check products table for rows where is_pinned is true
  try {
    const { data: prodData } = await supabase
      .from('products')
      .select('id')
      .eq('is_pinned', true);

    if (prodData && prodData.length > 0) {
      const dbIds = prodData.map((p: any) => String(p.id));
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dbIds));
      }
      return dbIds;
    }
  } catch {
    // column is_pinned might not exist yet in products table
  }

  // Fallback to local storage if offline
  return getCachedPinnedProductIds();
}

// Persist pinned product IDs to local storage and sync to database across devices
export async function savePinnedProductIds(
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const uniqueIds = Array.from(new Set(ids.map(String)));

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueIds));
    }

    let dbSuccess = false;
    let dbNotice = '';

    // Primary Sync 1: site_announcements table with active: false
    try {
      const payload = `${DB_PREFIX_TAG}${JSON.stringify(uniqueIds)}`;
      const { data: existing, error: selectErr } = await supabase
        .from('site_announcements')
        .select('id, message')
        .ilike('message', '%PINNED_PRODUCTS%')
        .limit(1);

      if (!selectErr && existing && existing.length > 0) {
        const { error: updErr } = await supabase
          .from('site_announcements')
          .update({
            message: payload,
            active: false,
          })
          .eq('id', existing[0].id);

        if (!updErr) {
          dbSuccess = true;
        } else {
          dbNotice = updErr.message;
        }
      } else {
        const { error: insErr } = await supabase
          .from('site_announcements')
          .insert({
            message: payload,
            active: false,
          });

        if (!insErr) {
          dbSuccess = true;
        } else {
          dbNotice = insErr.message;
        }
      }
    } catch (e: any) {
      dbNotice = e?.message || String(e);
    }

    // Secondary Sync 2: site_settings upsert (if table exists)
    try {
      const { error } = await supabase.from('site_settings').upsert({
        key: 'pinned_products',
        value: uniqueIds,
        updated_at: new Date().toISOString(),
      });
      if (!error) dbSuccess = true;
    } catch {
      // Table may not exist
    }

    // Secondary Sync 3: Update is_pinned column in products table if possible
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
      // Column is_pinned may not exist yet in products table
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

  // Best effort: update is_pinned column directly for this product
  try {
    await supabase
      .from('products')
      .update({ is_pinned: newStatus })
      .eq('id', productId);
  } catch {
    // Safely ignore if column doesn't exist
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
