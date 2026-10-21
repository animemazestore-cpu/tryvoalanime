import { supabase } from './supabase';

export interface AnimeSeriesEntry {
  id: string;
  label: string;
  short: string;
  aliases?: string[];
  image_url?: string;
}

// Curated default anime franchises with high-resolution imagery
export const DEFAULT_ANIME_SERIES: AnimeSeriesEntry[] = [
  {
    id: 'all',
    label: 'All Anime',
    short: 'ALL',
    aliases: ['all'],
    image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'jjk',
    label: 'Jujutsu Kaisen',
    short: 'JJK',
    aliases: ['jjk', 'jujutsu', 'gojo', 'sukuna', 'toji', 'megumi', 'itadori'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0ZCSciWsK6dS8B0y8-kCwJoe767WZC_bhcq9DE6LsWosBBcU-lwbaAac37AI3D0E49CTfRNRbmcfEMJNSYJLRS-W92-5eBRe-QBcukoZFCfuzdaynqJ3xU9C4pzgP_ruubdBh2RifK8kgwmWNFtUQiBfHK74KaedeG7X65e1GEyOYatIYDeGJ2uRpxh-wkZzxIdgB3V8JpNxpc7BHAelcDu7Bnm436jRO-IT0nzJpP7OW009lgANv',
  },
  {
    id: 'bleach',
    label: 'Bleach',
    short: 'BLEACH',
    aliases: ['bleach', 'ichigo', 'aizen', 'bankai', 'gotei', 'shinigami'],
    image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'naruto',
    label: 'Naruto',
    short: 'NARUTO',
    aliases: ['naruto', 'sasuke', 'itachi', 'akatsuki', 'kakashi', 'shippuden'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDaRYFPz-q905ExGzbkKsw5WSO621hvgM1gAWECOmAp3XQoaBrz0YBj4V2bTc0lJeUECeW3UgW2y9-HdW8gt3BO3LMYHUhn8ruF5AOizgqFyjgtO2gmM27jdVC9nPDoP0UGHS8Xw8rd3-g6w9qQ0x8y1tVq9EtP6TRmNl6DeDXMYbOn9bzcf9OttQDLHlxwC__rKxblyyfogboUYggb8_sQeyBrJPaJIB_vZqJ8F6Mfqq2pEU7YD72',
  },
  {
    id: 'one-piece',
    label: 'One Piece',
    short: 'ONE PIECE',
    aliases: ['one piece', 'luffy', 'zoro', 'sanji', 'nika', 'straw hat'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC-7bqnxN2IOKkyE16V7O2gbUd6aVJJldGCJml7GS2ZMmDp2Muke2DVZvTNDn_ruxJ0_OUDdcJplXgMCva563zCRoA3cfOqd5bEm7JycE_QmpB2ePI0T2tQdCD2oHiJ9suNBnjU3A8V6h4VXPwt8bao0NzHfaInZsqiCiNrO6JWy6aLzrTplacPqdZH7RfS0t80gM4l3hyyVgLnSW3AOftox688DCvZgqspL38RGGq7qrdCTQ9xqK4A',
  },
  {
    id: 'demon-slayer',
    label: 'Demon Slayer',
    short: 'DEMON SLAYER',
    aliases: ['demon slayer', 'kimetsu', 'tanjiro', 'nezuko', 'zenitsu', 'rengoku'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBabjgfmc6UZnVgbC9AjPJTwuFtz8nQUHj2n2EucLYqM8001QNkQ1_gRLwbPTon6_XivZr_UWr84veJ0C2kTXdopCxz4tGVWynGzzyBKa_JOat5fiQBGSiXbuOM6TbbADzFOZLpW3h2EfnaYIECtPBNnXVgMe4AMYI-NjohbHi2Nj63DneAlBwtVxwRQ1i594Od4JF2bl6Lm_LF1RcsXfWeBghBFdXRBX8XJcC6JSNocKTjfmhrMQAT',
  },
  {
    id: 'aot',
    label: 'Attack on Titan',
    short: 'AOT',
    aliases: ['attack on titan', 'aot', 'eren', 'levi', 'survey corps', 'mikasa', 'attack-on-titan'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2YH_KbzeU69GvYL12nSOEx060Y1hDz79G21wHSA8_z3amsgVThk1ihJg2pqLZMhUaLBEbSBaSOGbdwacWPj4vMANzy_dMV8sJ6yzpzdrE4KMTsuRcp_KRXxF3BD7UegAEQXBWI2aMl5IaCcaO0s-15blHYZPfht0JN81niMUU6kJJ9p0ruffiYI2C55ChqxvhT5f1oeB5ccqaBZnrGdAmQHKg4TZiURuvZJP0aaXz5uJ3UDP08uWP',
  },
  {
    id: 'dragon-ball',
    label: 'Dragon Ball',
    short: 'DRAGON BALL',
    aliases: ['dragon ball', 'goku', 'vegeta', 'gohan', 'saiyan', 'dbz'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAgcxsYKwS40umLMVrGk44s-cXJUCrWtdaMtRIqoYQZJq04nyWP3qaMUgeMAHH0LY3XCpZWTm5RUnI5mFiAI-JVbL3Oy4XnEhQ8vw8Jjfw6NtGpvJrA9Z5J0Y4fXBGnvltKz8cN-ift5neUgZxtKPB4UxTFsyTUM9307UhA40w8hSZqQgl50Q2DVdROMsVyZMFl9WQuWBid7qDsrx47o1VwECA9Sd2hAmCYDG3QqgAi19WqEZBC0tsU',
  },
  {
    id: 'solo-leveling',
    label: 'Solo Leveling',
    short: 'SOLO LEVELING',
    aliases: ['solo leveling', 'sung jinwoo', 'shadow monarch', 'arise'],
    image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'berserk',
    label: 'Berserk',
    short: 'BERSERK',
    aliases: ['berserk', 'guts', 'griffith', 'brand of sacrifice'],
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'chainsaw-man',
    label: 'Chainsaw Man',
    short: 'CHAINSAW MAN',
    aliases: ['chainsaw man', 'denji', 'makima', 'power', 'pochita'],
    image_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'hunter-x-hunter',
    label: 'Hunter X Hunter',
    short: 'HXH',
    aliases: ['hunter x hunter', 'hxh', 'killua', 'gon', 'kurapika'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApgys7WiFVf7R49osj_ZArHOrTz4RK9epq1Qad9dqIp_yvXVX2B1yMDkTKr0GKKQRj00WEB5ucSjR1zkWirkhTh-IiuIbs1q2qnNptef_omD5X7ee5G1Oax6ZBrAfjTaVRPb1kf76TQgzVBly7F4KeoZqx026uc0QAL-EHC_8KWJeZsfqf1TOsVWuUATON_eq98w-Lp1Vj_YmWmyZrXl1UuvzsSf-ngI2ft_p9hDUdacEWqTHzmvNW',
  },
  {
    id: 'death-note',
    label: 'Death Note',
    short: 'DEATH NOTE',
    aliases: ['death note', 'light', 'ryuk', 'l'],
    image_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'tokyo-revengers',
    label: 'Tokyo Revengers',
    short: 'TOKYO REVENGERS',
    aliases: ['tokyo revengers', 'mikey', 'draken', 'takemichi'],
    image_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCVGh2Q0HzwcGyFjGLbq6-l1JUQgzXG8j2ra6EKHMcUhCEYkQCJT65xPdPPz-Xs8V_CzeP2t90mY79zZZ9-481l8gIGKSChLIYz3KvvqLIER475JJ64B0fETwAWURwRLGDadZ_pRsZL904yrnhXqbpW9oGFAXQYQCISn-aMpMBM5O8bvJecWk6_HYzdIUQqZdsK175AMBytHSsRq5yrB1e8loTmW3DW9m2AHmzx9C7Q4Gk0AcTBkClv',
  },
];

const THUMBNAILS_STORAGE_KEY = 'tryvoal_anime_thumbnails';
const CUSTOM_SERIES_STORAGE_KEY = 'tryvoal_custom_anime_series';
const DB_PREFIX_TAG = '[ANIME_THUMBNAILS_JSON]:';
const DB_CUSTOM_SERIES_PREFIX_TAG = '[ANIME_CUSTOM_SERIES_JSON]:';

// Get cached thumbnails overrides map (id -> imageUrl)
export function getCachedAnimeThumbnails(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(THUMBNAILS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Get cached custom anime series
export function getCachedCustomAnimeSeries(): AnimeSeriesEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SERIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Get combined list of all anime series with custom thumbnails merged
export function getAllAnimeSeries(
  customList: AnimeSeriesEntry[] = getCachedCustomAnimeSeries(),
  thumbnailOverrides: Record<string, string> = getCachedAnimeThumbnails()
): AnimeSeriesEntry[] {
  // 1. Start with core series
  const seriesMap = new Map<string, AnimeSeriesEntry>();

  for (const s of DEFAULT_ANIME_SERIES) {
    seriesMap.set(s.id, {
      ...s,
      image_url: thumbnailOverrides[s.id] || s.image_url,
    });
  }

  // 2. Merge custom series
  for (const c of customList) {
    const existing = seriesMap.get(c.id);
    const resolvedImage = thumbnailOverrides[c.id] || c.image_url || existing?.image_url;
    seriesMap.set(c.id, {
      id: c.id,
      label: c.label || existing?.label || c.id,
      short: c.short || existing?.short || c.label?.slice(0, 3).toUpperCase() || 'ANM',
      aliases: c.aliases || existing?.aliases || [c.id, (c.label || '').toLowerCase()],
      image_url: resolvedImage,
    });
  }

  return Array.from(seriesMap.values());
}

export const CATEGORIES_THUMBNAILS_KEY = '__tryvoal_anime_thumbnails__';
export const CATEGORIES_CUSTOM_SERIES_KEY = '__tryvoal_custom_anime_series__';
export const CATEGORIES_SUBCAT_PREFIX = '__subcat_';

// Fetch thumbnails from Supabase across multiple robust channels to guarantee cross-device sync
export async function fetchAnimeThumbnails(): Promise<Record<string, string>> {
  let overrides = getCachedAnimeThumbnails();

  // 1. Channel 1: Primary `categories` table (Guaranteed public SELECT across all devices)
  try {
    const { data: catRows, error: catErr } = await supabase
      .from('categories')
      .select('name, image_url')
      .or(`name.eq.${CATEGORIES_THUMBNAILS_KEY},name.ilike.${CATEGORIES_SUBCAT_PREFIX}%`);

    if (!catErr && catRows && catRows.length > 0) {
      for (const row of catRows) {
        if (!row.image_url) continue;

        // Master JSON thumbnails map record
        if (row.name === CATEGORIES_THUMBNAILS_KEY) {
          try {
            const parsed = JSON.parse(row.image_url);
            if (parsed && typeof parsed === 'object') {
              overrides = { ...overrides, ...parsed };
            }
          } catch {}
        }
        // Individual sub-category row: __subcat_<seriesId>__
        else if (row.name.startsWith(CATEGORIES_SUBCAT_PREFIX) && row.name.endsWith('__')) {
          const sId = row.name.slice(CATEGORIES_SUBCAT_PREFIX.length, -2);
          if (sId && row.image_url.trim()) {
            overrides[sId] = row.image_url.trim();
          }
        }
      }
    }
  } catch (err) {
    console.warn('Categories table anime thumbnails sync notice:', err);
  }

  // 2. Channel 2: Supabase site_announcements backup broadcast
  try {
    const { data: annData } = await supabase
      .from('site_announcements')
      .select('id, message, created_at')
      .ilike('message', '%ANIME_THUMBNAILS%')
      .order('created_at', { ascending: false })
      .limit(5);

    if (annData && annData.length > 0) {
      for (const row of annData) {
        if (!row.message) continue;
        const start = row.message.indexOf('{');
        const end = row.message.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const parsed = JSON.parse(row.message.substring(start, end + 1));
            if (parsed && typeof parsed === 'object') {
              overrides = { ...overrides, ...parsed };
              break; // Newest found
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Site announcements anime thumbnails sync notice:', err);
  }

  // 3. Channel 3: Supabase site_settings table (if available)
  try {
    const { data: settingData, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'anime_thumbnails')
      .maybeSingle();

    if (!error && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (val && typeof val === 'object') {
        overrides = { ...overrides, ...val };
      }
    }
  } catch {}

  // 4. Cache back to localStorage for instant subsequent access
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(THUMBNAILS_STORAGE_KEY, JSON.stringify(overrides));
    } catch {}
  }

  return overrides;
}

// Save thumbnail for a specific anime sub-category with multi-channel DB sync
export async function saveAnimeSeriesThumbnail(
  seriesId: string,
  imageUrl: string
): Promise<{ success: boolean; dbSynced: boolean; error?: string }> {
  try {
    const cleanUrl = imageUrl.trim();
    const current = getCachedAnimeThumbnails();
    const updated = { ...current, [seriesId]: cleanUrl };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THUMBNAILS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
    }

    // Also update custom list if this is a custom series
    const customList = getCachedCustomAnimeSeries();
    const updatedCustom = customList.map((item) =>
      item.id === seriesId ? { ...item, image_url: cleanUrl } : item
    );
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(updatedCustom));
      } catch {}
    }

    let dbSuccess = false;
    const errors: string[] = [];

    // CHANNEL 1: Supabase `categories` table (100% universal read across all devices & anon users)
    try {
      // 1a. Upsert master thumbnails map into categories table
      const { error: catErr } = await supabase
        .from('categories')
        .upsert(
          {
            name: CATEGORIES_THUMBNAILS_KEY,
            image_url: JSON.stringify(updated),
            size_enabled: false,
          },
          { onConflict: 'name' }
        );

      if (!catErr) {
        dbSuccess = true;
      } else {
        errors.push(`Categories master: ${catErr.message}`);
      }

      // 1b. Upsert individual sub-category row into categories table
      const subcatRowName = `${CATEGORIES_SUBCAT_PREFIX}${seriesId}__`;
      const { error: singleCatErr } = await supabase
        .from('categories')
        .upsert(
          {
            name: subcatRowName,
            image_url: cleanUrl,
            size_enabled: false,
          },
          { onConflict: 'name' }
        );

      if (!singleCatErr) {
        dbSuccess = true;
      }
    } catch (e: any) {
      errors.push(`Categories exception: ${e?.message || e}`);
    }

    // CHANNEL 2: Supabase `site_announcements` table (Universal broadcast channel)
    try {
      const payload = `${DB_PREFIX_TAG}${JSON.stringify(updated)}`;
      const { data: existing } = await supabase
        .from('site_announcements')
        .select('id')
        .ilike('message', '%ANIME_THUMBNAILS%')
        .limit(1);

      if (existing && existing.length > 0) {
        const { error: updErr } = await supabase
          .from('site_announcements')
          .update({
            message: payload,
            active: false,
          })
          .eq('id', existing[0].id);

        if (!updErr) dbSuccess = true;
        else errors.push(`Announcements update: ${updErr.message}`);
      } else {
        const { error: insErr } = await supabase.from('site_announcements').insert({
          message: payload,
          active: false,
        });

        if (!insErr) dbSuccess = true;
        else errors.push(`Announcements insert: ${insErr.message}`);
      }
    } catch (e: any) {
      errors.push(`Announcements exception: ${e?.message || e}`);
    }

    // CHANNEL 3: Best-effort update on products matching this anime franchise
    try {
      const { data: matchProducts } = await supabase
        .from('products')
        .select('id, brand, variant_config')
        .or(`brand.ilike.${seriesId},brand.ilike.%${seriesId}%`)
        .limit(15);

      if (matchProducts && matchProducts.length > 0) {
        for (const prod of matchProducts) {
          const cfg = typeof prod.variant_config === 'object' && prod.variant_config !== null ? prod.variant_config : {};
          await supabase
            .from('products')
            .update({
              variant_config: { ...cfg, anime_thumbnail: cleanUrl },
            })
            .eq('id', prod.id);
        }
      }
    } catch {}

    // CHANNEL 4: Supabase `site_settings` table (if available)
    try {
      const { error: setErr } = await supabase.from('site_settings').upsert({
        key: 'anime_thumbnails',
        value: updated,
        updated_at: new Date().toISOString(),
      });
      if (!setErr) dbSuccess = true;
    } catch {}

    // Dispatch custom event so open components and pages update instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anime_thumbnails_updated', { detail: updated }));
    }

    return {
      success: true,
      dbSynced: dbSuccess,
      error: dbSuccess ? undefined : errors.join(' | ') || 'Database sync pending',
    };
  } catch (err: any) {
    return { success: false, dbSynced: false, error: err?.message || String(err) };
  }
}

// Fetch custom anime series from Supabase for cross-device sync
export async function fetchCustomAnimeSeriesFromDB(): Promise<AnimeSeriesEntry[]> {
  let customList = getCachedCustomAnimeSeries();

  // 1. Channel 1: Primary `categories` table
  try {
    const { data: catData, error: catErr } = await supabase
      .from('categories')
      .select('name, image_url')
      .eq('name', CATEGORIES_CUSTOM_SERIES_KEY)
      .maybeSingle();

    if (!catErr && catData?.image_url) {
      try {
        const parsed = JSON.parse(catData.image_url);
        if (Array.isArray(parsed) && parsed.length > 0) {
          customList = parsed;
        }
      } catch {}
    }
  } catch {}

  // 2. Channel 2: site_announcements table
  try {
    const { data: annData } = await supabase
      .from('site_announcements')
      .select('id, message, created_at')
      .ilike('message', '%ANIME_CUSTOM_SERIES%')
      .order('created_at', { ascending: false })
      .limit(3);

    if (annData && annData.length > 0) {
      for (const row of annData) {
        if (!row.message) continue;
        const start = row.message.indexOf('[');
        const end = row.message.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          try {
            const parsed = JSON.parse(row.message.substring(start, end + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
              customList = parsed;
              break;
            }
          } catch {}
        }
      }
    }
  } catch {}

  // 3. Channel 3: site_settings table
  try {
    const { data: settingData, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'custom_anime_series')
      .maybeSingle();

    if (!error && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (Array.isArray(val) && val.length > 0) {
        customList = val;
      }
    }
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(customList));
    } catch {}
  }

  return customList;
}

// Save custom anime series list to Supabase for cross-device sync
export async function saveCustomAnimeSeriesList(
  seriesList: AnimeSeriesEntry[]
): Promise<{ success: boolean; dbSynced: boolean; error?: string }> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(seriesList));
    } catch {}
  }

  let dbSuccess = false;
  const errors: string[] = [];

  // Channel 1: `categories` table
  try {
    const { error: catErr } = await supabase
      .from('categories')
      .upsert(
        {
          name: CATEGORIES_CUSTOM_SERIES_KEY,
          image_url: JSON.stringify(seriesList),
          size_enabled: false,
        },
        { onConflict: 'name' }
      );
    if (!catErr) dbSuccess = true;
    else errors.push(`Categories: ${catErr.message}`);
  } catch (e: any) {
    errors.push(`Categories exception: ${e?.message || e}`);
  }

  // Channel 2: `site_announcements`
  try {
    const payload = `${DB_CUSTOM_SERIES_PREFIX_TAG}${JSON.stringify(seriesList)}`;
    const { data: existing } = await supabase
      .from('site_announcements')
      .select('id')
      .ilike('message', '%ANIME_CUSTOM_SERIES%')
      .limit(1);

    if (existing && existing.length > 0) {
      const { error: updErr } = await supabase
        .from('site_announcements')
        .update({
          message: payload,
          active: false,
        })
        .eq('id', existing[0].id);
      if (!updErr) dbSuccess = true;
      else errors.push(`Announcements update: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from('site_announcements').insert({
        message: payload,
        active: false,
      });
      if (!insErr) dbSuccess = true;
      else errors.push(`Announcements insert: ${insErr.message}`);
    }
  } catch (err: any) {
    errors.push(`Announcements exception: ${err?.message || err}`);
  }

  // Channel 3: `site_settings`
  try {
    const { error } = await supabase.from('site_settings').upsert({
      key: 'custom_anime_series',
      value: seriesList,
      updated_at: new Date().toISOString(),
    });
    if (!error) dbSuccess = true;
  } catch {}

  // Dispatch event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('anime_custom_series_updated', { detail: seriesList }));
  }

  return {
    success: true,
    dbSynced: dbSuccess,
    error: dbSuccess ? undefined : errors.join(' | ') || 'Database sync pending',
  };
}

/**
 * 1-Click Master Sync: Push all current sub-category thumbnails and custom anime series
 * to cloud database across all channels so every device receives them immediately.
 */
export async function syncAllAnimeSubcategoriesToCloud(): Promise<{
  success: boolean;
  dbSynced: boolean;
  totalThumbnails: number;
  totalCustomSeries: number;
  errorNotice?: string;
}> {
  const currentThumbnails = getCachedAnimeThumbnails();
  const currentCustomSeries = getCachedCustomAnimeSeries();
  const totalThumbnails = Object.keys(currentThumbnails).length;
  const totalCustomSeries = currentCustomSeries.length;

  let dbSynced = false;
  const errorNotices: string[] = [];

  // 1. Sync thumbnails
  try {
    // 1a. Categories table master row
    const { error: catErr } = await supabase
      .from('categories')
      .upsert(
        {
          name: CATEGORIES_THUMBNAILS_KEY,
          image_url: JSON.stringify(currentThumbnails),
          size_enabled: false,
        },
        { onConflict: 'name' }
      );

    if (!catErr) {
      dbSynced = true;
    } else {
      errorNotices.push(`Categories master: ${catErr.message}`);
    }

    // 1b. Each individual subcategory row in categories table
    for (const [sId, url] of Object.entries(currentThumbnails)) {
      if (!url) continue;
      await supabase
        .from('categories')
        .upsert(
          {
            name: `${CATEGORIES_SUBCAT_PREFIX}${sId}__`,
            image_url: url.trim(),
            size_enabled: false,
          },
          { onConflict: 'name' }
        );
    }

    // 1c. site_announcements table
    const payload = `${DB_PREFIX_TAG}${JSON.stringify(currentThumbnails)}`;
    const { data: existing } = await supabase
      .from('site_announcements')
      .select('id')
      .ilike('message', '%ANIME_THUMBNAILS%')
      .limit(1);

    if (existing && existing.length > 0) {
      const { error: updErr } = await supabase
        .from('site_announcements')
        .update({
          message: payload,
          active: false,
        })
        .eq('id', existing[0].id);
      if (!updErr) dbSynced = true;
      else errorNotices.push(`Announcements: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from('site_announcements').insert({
        message: payload,
        active: false,
      });
      if (!insErr) dbSynced = true;
      else errorNotices.push(`Announcements insert: ${insErr.message}`);
    }

    // 1d. site_settings
    await supabase.from('site_settings').upsert({
      key: 'anime_thumbnails',
      value: currentThumbnails,
      updated_at: new Date().toISOString(),
    });
  } catch (err: any) {
    errorNotices.push(`Thumbnails sync error: ${err?.message || err}`);
  }

  // 2. Sync custom series
  if (currentCustomSeries.length > 0) {
    try {
      const res = await saveCustomAnimeSeriesList(currentCustomSeries);
      if (res.dbSynced) dbSynced = true;
      if (res.error) errorNotices.push(res.error);
    } catch (err: any) {
      errorNotices.push(`Custom series sync error: ${err?.message || err}`);
    }
  }

  // Dispatch global events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('anime_thumbnails_updated', { detail: currentThumbnails }));
  }

  return {
    success: true,
    dbSynced,
    totalThumbnails,
    totalCustomSeries,
    errorNotice: dbSynced ? undefined : errorNotices.join(' | ') || 'Cloud sync notice',
  };
}
