import { supabase } from './supabase';

export interface HeroBannerConfig {
  hero_top_badge: string;
  hero_main_title: string;
  hero_sub_title: string;
  badge: string;
  tagline: string;
  item_label: string;
  status_text: string;
  title: string;
  description: string;
  image_url: string;
  button_text: string;
  button_link: string;
  feature_1: string;
  feature_2: string;
}

export const DEFAULT_HERO_CONFIG: HeroBannerConfig = {
  hero_top_badge: 'Premium Japanese Streetwear',
  hero_main_title: 'Tryvoal : Anime store',
  hero_sub_title: 'Authentic apparel, cursed accessories, and oversized manga graphics designed for genuine fans.',
  badge: 'LIMITED DROP // RYŌSHIN ARCANE',
  tagline: 'Only 250 Pieces',
  item_label: 'RYŌSHIN ARCANE TIMEPIECE',
  status_text: 'In Stock & Ready to Ship',
  title: 'The Arcane Chronicle: Unleash The Power',
  description: 'Ultra-detailed custom mechanical anime timepiece with glowing crimson kanji indices, matte black steel link bracelet, and sapphire crystal dome.',
  image_url: '/anime_watch_hero.jpg',
  button_text: 'EXPLORE STORE DROPS',
  button_link: '/shop',
  feature_1: '⚡ Ultra-Detailed Mechanical Cut',
  feature_2: '🔥 Exclusive Online Drop',
};

const STORAGE_KEY = 'tryvoal_hero_config';
const PREFIX_TAG = '[HERO_BANNER_JSON]:';

export function getCachedHeroConfig(): HeroBannerConfig {
  if (typeof window === 'undefined') return DEFAULT_HERO_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('elitebath_hero_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_HERO_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Error reading hero config from localStorage:', err);
  }
  return DEFAULT_HERO_CONFIG;
}

export async function fetchHeroConfig(): Promise<HeroBannerConfig> {
  let config = getCachedHeroConfig();

  try {
    // 1. Try fetching from site_settings table if it exists
    const { data: settingData, error: settingError } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'hero_banner')
      .maybeSingle();

    if (!settingError && settingData?.value) {
      const val = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
      config = { ...DEFAULT_HERO_CONFIG, ...val };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      }
      return config;
    }
  } catch {
    // site_settings table might not exist yet, continue to site_announcements
  }

  try {
    // 2. Try fetching from site_announcements table looking for PREFIX_TAG
    const { data: annData } = await supabase
      .from('site_announcements')
      .select('message')
      .like('message', `${PREFIX_TAG}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (annData && annData.length > 0 && annData[0].message) {
      const jsonStr = annData[0].message.replace(PREFIX_TAG, '');
      const parsed = JSON.parse(jsonStr);
      config = { ...DEFAULT_HERO_CONFIG, ...parsed };
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      }
      return config;
    }
  } catch (err) {
    console.warn('Error fetching hero config from Supabase:', err);
  }

  return config;
}

export async function saveHeroConfig(config: HeroBannerConfig): Promise<{ success: boolean; error?: string }> {
  // 1. Immediately persist locally & notify listeners
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem('elitebath_hero_config', JSON.stringify(config));
    window.dispatchEvent(new Event('hero_banner_updated'));
  }

  let dbSynced = false;
  let lastError: string | undefined;

  // 2. Attempt saving to site_settings table
  try {
    const { error: setErr } = await supabase
      .from('site_settings')
      .upsert(
        { key: 'hero_banner', value: config, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    if (!setErr) {
      dbSynced = true;
    }
  } catch (err: any) {
    lastError = err?.message;
  }

  // 3. Also sync to site_announcements for robust redundancy
  try {
    const payload = `${PREFIX_TAG}${JSON.stringify(config)}`;
    // Deactivate previous hero configs in announcements
    await supabase
      .from('site_announcements')
      .update({ active: false })
      .like('message', `${PREFIX_TAG}%`);

    const { error: insErr } = await supabase
      .from('site_announcements')
      .insert({ message: payload, active: true });

    if (!insErr) {
      dbSynced = true;
    } else {
      lastError = insErr.message;
    }
  } catch (err: any) {
    lastError = err?.message;
  }

  return { success: dbSynced, error: dbSynced ? undefined : lastError };
}
