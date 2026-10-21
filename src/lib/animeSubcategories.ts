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

// Fetch thumbnails from Supabase to stay updated across all devices
export async function fetchAnimeThumbnails(): Promise<Record<string, string>> {
  let overrides = getCachedAnimeThumbnails();

  // 1. Check site_settings table if it exists
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
  } catch {
    // Continue to announcements table
  }

  // 2. Check site_announcements table (Guaranteed cross-device sync)
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
    console.warn('Could not fetch anime thumbnails from Supabase announcements:', err);
  }

  // Cache to localStorage for instant local access
  if (typeof window !== 'undefined') {
    localStorage.setItem(THUMBNAILS_STORAGE_KEY, JSON.stringify(overrides));
  }

  return overrides;
}

// Save thumbnail for a specific anime sub-category
export async function saveAnimeSeriesThumbnail(
  seriesId: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = getCachedAnimeThumbnails();
    const updated = { ...current, [seriesId]: imageUrl.trim() };

    if (typeof window !== 'undefined') {
      localStorage.setItem(THUMBNAILS_STORAGE_KEY, JSON.stringify(updated));
    }

    // Also update custom list if this is a custom series
    const customList = getCachedCustomAnimeSeries();
    const updatedCustom = customList.map((item) =>
      item.id === seriesId ? { ...item, image_url: imageUrl.trim() } : item
    );
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(updatedCustom));
    }

    let dbSuccess = false;
    let dbNotice = '';

    // Attempt 1: site_settings table (if available)
    try {
      const { error } = await supabase.from('site_settings').upsert({
        key: 'anime_thumbnails',
        value: updated,
        updated_at: new Date().toISOString(),
      });
      if (!error) dbSuccess = true;
    } catch (e: any) {
      // Continue to announcements
    }

    // Attempt 2: site_announcements table (100% universal across devices)
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
            active: false, // Correct column is 'active', NOT 'is_active'
          })
          .eq('id', existing[0].id);

        if (!updErr) dbSuccess = true;
        else dbNotice = updErr.message;
      } else {
        const { error: insErr } = await supabase.from('site_announcements').insert({
          message: payload,
          active: false, // Correct column is 'active', NOT 'is_active'
        });

        if (!insErr) dbSuccess = true;
        else dbNotice = insErr.message;
      }
    } catch (e: any) {
      dbNotice = e?.message || String(e);
    }

    // Dispatch custom event so open pages / components update instantly
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('anime_thumbnails_updated', { detail: updated }));
    }

    return { success: true, error: dbSuccess ? undefined : dbNotice };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// Fetch custom anime series from Supabase for cross-device sync
export async function fetchCustomAnimeSeriesFromDB(): Promise<AnimeSeriesEntry[]> {
  let customList = getCachedCustomAnimeSeries();

  // 1. Try site_settings
  try {
    const { data: settingData, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'custom_anime_series')
      .maybeSingle();

    if (!error && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      if (Array.isArray(val)) {
        customList = val;
      }
    }
  } catch {}

  // 2. Try site_announcements
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

  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(customList));
  }

  return customList;
}

// Save custom anime series list to Supabase for cross-device sync
export async function saveCustomAnimeSeriesList(
  seriesList: AnimeSeriesEntry[]
): Promise<{ success: boolean; error?: string }> {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CUSTOM_SERIES_STORAGE_KEY, JSON.stringify(seriesList));
  }

  let dbSuccess = false;
  let dbNotice = '';

  // 1. Try site_settings
  try {
    const { error } = await supabase.from('site_settings').upsert({
      key: 'custom_anime_series',
      value: seriesList,
      updated_at: new Date().toISOString(),
    });
    if (!error) dbSuccess = true;
  } catch {}

  // 2. Try site_announcements
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
      else dbNotice = updErr.message;
    } else {
      const { error: insErr } = await supabase.from('site_announcements').insert({
        message: payload,
        active: false,
      });
      if (!insErr) dbSuccess = true;
      else dbNotice = insErr.message;
    }
  } catch (err: any) {
    dbNotice = err?.message || String(err);
  }

  return { success: true, error: dbSuccess ? undefined : dbNotice };
}
