import { sanitizeSlug } from './persistence';
import type { Category, Product, ProductVariant, ProductVariantConfig } from '../types/database';

export const CATEGORY_FIELDS = 'id, name, image_url, created_at';

export const PRODUCT_VARIANT_FIELDS =
  'id, product_id, sku, price, stock, image_url, attributes, active, created_at, updated_at';

export const PRODUCT_LIST_FIELDS =
  'id, name, slug, description, category_id, price, stock, featured, main_image_url, sku, brand, material, finish, warranty_info, has_variants, variant_config, is_new_arrival, is_active, created_at';

export const PRODUCT_DETAIL_FIELDS =
  'id, name, slug, description, category_id, price, stock, featured, main_image_url, additional_images, sku, brand, material, finish, warranty_info, has_variants, variant_config, is_new_arrival, is_active, created_at';

export const PRODUCT_RELATED_FIELDS =
  'id, name, slug, price, stock, featured, main_image_url, sku, brand, finish, has_variants, created_at';

export const PRODUCT_LIST_SELECT = `
  *,
  category:categories (${CATEGORY_FIELDS}),
  variants:product_variants (${PRODUCT_VARIANT_FIELDS})
`;

export const PRODUCT_DETAIL_SELECT = `
  *,
  category:categories (${CATEGORY_FIELDS}),
  variants:product_variants (${PRODUCT_VARIANT_FIELDS})
`;

export function parseProduct(raw: Record<string, unknown>): Product {
  const category = raw.category as Category | undefined;

  let variantConfig: ProductVariantConfig | null = null;
  if (raw.variant_config) {
    if (typeof raw.variant_config === 'string') {
      try {
        variantConfig = JSON.parse(raw.variant_config) as ProductVariantConfig;
      } catch {
        variantConfig = null;
      }
    } else if (typeof raw.variant_config === 'object') {
      variantConfig = raw.variant_config as ProductVariantConfig;
    }
  }

  const rawVariants = Array.isArray(raw.variants) ? (raw.variants as Record<string, unknown>[]) : [];
  const variants: ProductVariant[] = rawVariants.map((v) => ({
    id: String(v.id),
    product_id: String(v.product_id ?? raw.id),
    sku: (v.sku as string | null) ?? null,
    price: Number(v.price ?? 0),
    stock: Number(v.stock ?? 0),
    image_url: (v.image_url as string | null) ?? null,
    attributes: (v.attributes as Record<string, string>) || {},
    active: v.active !== false,
    created_at: v.created_at as string | undefined,
    updated_at: v.updated_at as string | undefined,
  }));

  const hasVariants = Boolean(raw.has_variants) || variants.length > 0;

  // Base price fallback: if has variants, display price can be the minimum active variant price
  let displayPrice = Number(raw.price ?? 0);
  if (hasVariants && variants.length > 0) {
    const activeVariants = variants.filter((v) => v.active);
    if (activeVariants.length > 0) {
      const minVariantPrice = Math.min(...activeVariants.map((v) => v.price));
      if (displayPrice === 0 || minVariantPrice < displayPrice) {
        displayPrice = minVariantPrice;
      }
    }
  }

  // Base stock fallback: sum of active variant stocks if base stock is 0
  let totalStock = Number(raw.stock ?? 0);
  if (hasVariants && variants.length > 0 && totalStock === 0) {
    totalStock = variants.reduce((acc, v) => acc + (v.active ? v.stock : 0), 0);
  }

  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    slug: sanitizeSlug(String(raw.slug ?? ''), String(raw.name ?? '')),
    description: (raw.description as string | null) ?? null,
    category_id: (raw.category_id as string | null) ?? null,
    price: displayPrice,
    stock: totalStock,
    featured: Boolean(raw.featured),
    main_image_url: String(raw.main_image_url ?? ''),
    additional_images: Array.isArray(raw.additional_images)
      ? (raw.additional_images as string[])
      : [],
    sku: (raw.sku as string | null) ?? null,
    brand: (raw.brand as string | null) ?? 'TRYVOAL',
    material: (raw.material as string | null) ?? null,
    finish: (raw.finish as string | null) ?? null,
    warranty_info: (raw.warranty_info as string | null) ?? null,
    has_variants: hasVariants,
    variant_config: variantConfig,
    variants: variants.length > 0 ? variants : undefined,
    is_new_arrival: Boolean(raw.is_new_arrival),
    is_active: raw.is_active !== false,
    shipping_fee: raw.shipping_fee !== undefined ? Number(raw.shipping_fee) : 0,
    created_at: (raw.created_at as string) || new Date().toISOString(),
    ...(category ? { category } : {}),
  };
}

export function parseProducts(rows: Record<string, unknown>[] | null): Product[] {
  return rows ? rows.map(parseProduct) : [];
}

export function findProductBySlug(products: Product[], slug: string): Product | undefined {
  return products.find(
    (p) => p.slug === slug || sanitizeSlug(p.slug, p.name) === slug
  );
}

// ============================================================================
// Fallback Anime Categories (TRYVOAL - Official Drops)
// ============================================================================

export const CATEGORY_HOODIES_ID = 'f09925b1-9b67-4065-b982-49acc3488931';
export const CATEGORY_TSHIRTS_ID = 'b7fd3cc1-3088-43e1-ad2c-b6cdee8d1325';
export const CATEGORY_FIGURES_ID = 'e2905f6f-69a2-4fb0-956f-837e236236bc';
export const CATEGORY_KATANAS_ID = 'a1905f6f-69a2-4fb0-956f-837e236236bd';
export const CATEGORY_POSTERS_ID = 'c3905f6f-69a2-4fb0-956f-837e236236be';
export const CATEGORY_ACCESSORIES_ID = 'd4905f6f-69a2-4fb0-956f-837e236236bf';

export const FALLBACK_CATEGORIES: Category[] = [
  {
    id: CATEGORY_HOODIES_ID,
    name: 'Hoodies & Sweatshirts',
    image_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=600',
    size_enabled: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: CATEGORY_TSHIRTS_ID,
    name: 'Oversized T-Shirts',
    image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=600',
    size_enabled: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: CATEGORY_FIGURES_ID,
    name: 'Action Figures & Statues',
    image_url: 'https://images.unsplash.com/photo-1608889175123-8ec330b86f84?auto=format&fit=crop&q=80&w=600',
    size_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: CATEGORY_KATANAS_ID,
    name: 'Cosplay Swords & Katanas',
    image_url: 'https://images.unsplash.com/photo-1594901840134-21fbe66d764e?auto=format&fit=crop&q=80&w=600',
    size_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: CATEGORY_POSTERS_ID,
    name: 'Posters & Wall Scrolls',
    image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80&w=600',
    size_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: CATEGORY_ACCESSORIES_ID,
    name: 'Anime Accessories',
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600',
    size_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
  },
];

// Curated Anime Universes / Sub-categories
export const ANIME_SERIES_LIST = [
  { id: 'all', label: 'All Anime', short: 'All' },
  { id: 'jjk', label: 'Jujutsu Kaisen', short: 'JJK', aliases: ['jjk', 'jujutsu', 'gojo', 'sukuna', 'toji', 'megumi', 'itadori'] },
  { id: 'bleach', label: 'Bleach', short: 'BLEACH', aliases: ['bleach', 'ichigo', 'aizen', 'bankai', 'gotei', 'shinigami'] },
  { id: 'naruto', label: 'Naruto', short: 'NARUTO', aliases: ['naruto', 'sasuke', 'itachi', 'akatsuki', 'kakashi', 'shippuden'] },
  { id: 'one-piece', label: 'One Piece', short: 'ONE PIECE', aliases: ['one piece', 'luffy', 'zoro', 'sanji', 'nika', 'straw hat'] },
  { id: 'demon-slayer', label: 'Demon Slayer', short: 'DEMON SLAYER', aliases: ['demon slayer', 'kimetsu', 'tanjiro', 'nezuko', 'zenitsu', 'rengoku'] },
  { id: 'aot', label: 'Attack on Titan', short: 'AOT', aliases: ['attack on titan', 'aot', 'eren', 'levi', 'survey corps', 'mikasa'] },
  { id: 'dragon-ball', label: 'Dragon Ball', short: 'DRAGON BALL', aliases: ['dragon ball', 'goku', 'vegeta', 'gohan', 'saiyan', 'dbz'] },
  { id: 'solo-leveling', label: 'Solo Leveling', short: 'SOLO LEVELING', aliases: ['solo leveling', 'sung jinwoo', 'shadow monarch', 'arise'] },
  { id: 'berserk', label: 'Berserk', short: 'BERSERK', aliases: ['berserk', 'guts', 'griffith', 'brand of sacrifice'] },
  { id: 'chainsaw-man', label: 'Chainsaw Man', short: 'CHAINSAW MAN', aliases: ['chainsaw man', 'denji', 'makima', 'power', 'pochita'] },
  { id: 'hunter-x-hunter', label: 'Hunter X Hunter', short: 'HXH', aliases: ['hunter x hunter', 'hxh', 'killua', 'gon', 'kurapika'] },
  { id: 'death-note', label: 'Death Note', short: 'DEATH NOTE', aliases: ['death note', 'light', 'ryuk', 'l'] },
];

export const FALLBACK_PRODUCTS: Product[] = [];
