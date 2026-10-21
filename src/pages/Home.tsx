import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { useCatalogStore } from '../store/useCatalogStore';
import { ProductCard } from '../components/product/ProductCard';
import { fetchHeroConfig, getCachedHeroConfig, type HeroBannerConfig } from '../lib/heroConfig';
import { getAllAnimeSeries, fetchAnimeThumbnails, fetchCustomAnimeSeriesFromDB, type AnimeSeriesEntry } from '../lib/catalogQueries';



export const Home: React.FC = () => {
  const navigate = useNavigate();
  const products = useCatalogStore((s) => s.products);
  const productsLoading = useCatalogStore((s) => s.productsLoading);
  const initializeCatalog = useCatalogStore((s) => s.initializeCatalog);

  const [heroConfig, setHeroConfig] = useState<HeroBannerConfig>(getCachedHeroConfig);
  const [animeUniverses, setAnimeUniverses] = useState<AnimeSeriesEntry[]>(() =>
    getAllAnimeSeries().filter((s) => s.id !== 'all')
  );

  useEffect(() => {
    initializeCatalog();
    fetchHeroConfig().then(setHeroConfig);

    const handleUpdate = () => {
      setHeroConfig(getCachedHeroConfig());
    };
    window.addEventListener('hero_banner_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    // Cross-device sync for anime subcategories & thumbnails
    Promise.all([fetchAnimeThumbnails(), fetchCustomAnimeSeriesFromDB()]).then(() => {
      setAnimeUniverses(getAllAnimeSeries().filter((s) => s.id !== 'all'));
    });

    const handleAnimeThumbnailsUpdate = () => {
      setAnimeUniverses(getAllAnimeSeries().filter((s) => s.id !== 'all'));
    };
    window.addEventListener('anime_thumbnails_updated', handleAnimeThumbnailsUpdate);
    window.addEventListener('anime_custom_series_updated', handleAnimeThumbnailsUpdate);

    return () => {
      window.removeEventListener('hero_banner_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('anime_thumbnails_updated', handleAnimeThumbnailsUpdate);
      window.removeEventListener('anime_custom_series_updated', handleAnimeThumbnailsUpdate);
    };
  }, [initializeCatalog]);

  // Featured and trending products from the real catalog
  const featuredProducts = useMemo(() => {
    const featured = products.filter((p) => p.featured || p.is_new_arrival);
    return featured.length > 0 ? featured.slice(0, 8) : products.slice(0, 8);
  }, [products]);

  return (
    <div className="pb-16 bg-white text-gray-900 select-none">
      {/* BEGIN: HeroSection */}
      <section
        className="relative bg-brand-black text-white px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 overflow-hidden border-b border-neutral-800"
        data-purpose="hero-banner"
      >
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#4b5563_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg mx-auto">
          {heroConfig.hero_top_badge && (
            <span className="inline-block bg-red-600/90 text-white text-[11px] font-bold tracking-widest uppercase px-3.5 py-1 rounded-full mb-3 shadow-sm border border-red-500/30">
              {heroConfig.hero_top_badge}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase leading-tight mb-2 font-mono">
            {heroConfig.hero_main_title}
          </h1>
          {heroConfig.hero_sub_title && (
            <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed mb-6 sm:mb-8 max-w-md mx-auto">
              {heroConfig.hero_sub_title}
            </p>
          )}

          {/* Hero Showcase Card - Main Ad */}
          <div
            className="relative rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-900 text-left group mb-6"
            data-purpose="hero-showcase-banner"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-black">
              <img
                alt={heroConfig.title || 'Anime Hero Main Ad'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                src={heroConfig.image_url || '/anime_watch_hero.jpg'}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/anime_watch_hero.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
              {heroConfig.badge && (
                <div className="absolute top-3 left-3">
                  <span className="inline-block bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow">
                    {heroConfig.badge}
                  </span>
                </div>
              )}
              {heroConfig.tagline && (
                <div className="absolute top-3 right-3">
                  <span className="inline-block bg-black/80 backdrop-blur-md text-amber-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-700">
                    {heroConfig.tagline}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 bg-neutral-900 border-t border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase text-neutral-400 font-bold tracking-wider">
                  {heroConfig.item_label}
                </span>
                {heroConfig.status_text && (
                  <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {heroConfig.status_text}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-tight leading-snug mb-1.5 font-mono">
                {heroConfig.title}
              </h2>
              {heroConfig.description && (
                <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                  {heroConfig.description}
                </p>
              )}

              <Link
                to={heroConfig.button_link || '/shop'}
                className="w-full bg-white hover:bg-neutral-100 text-black font-extrabold text-xs uppercase tracking-wider py-3 rounded-lg flex items-center justify-center space-x-2 transition-transform active:scale-95 shadow"
              >
                <span>{heroConfig.button_text || 'EXPLORE STORE DROPS'}</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>

              {(heroConfig.feature_1 || heroConfig.feature_2) && (
                <div className="mt-3.5 pt-3 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400 font-medium">
                  {heroConfig.feature_1 && <span>{heroConfig.feature_1}</span>}
                  {heroConfig.feature_2 && <span>{heroConfig.feature_2}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* END: HeroSection */}

      {/* BEGIN: TrustBanner */}
      <section className="bg-neutral-900 text-white py-3.5 border-b border-neutral-800" data-purpose="trust-bar">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto no-scrollbar space-x-6 text-[11px] font-bold uppercase tracking-wider text-neutral-300 whitespace-nowrap justify-between sm:justify-center sm:gap-12">
          <div className="flex items-center space-x-1.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Free Shipping Across India</span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Money Back Guarantee</span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Authentic Merch</span>
          </div>
        </div>
      </section>
      {/* END: TrustBanner */}

      {/* BEGIN: Featured/Trending Catalog Products */}
      <section className="py-10 px-4 max-w-7xl mx-auto" data-purpose="popular-products">
        <div className="flex items-end justify-between mb-6">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Official Merch
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-gray-900 tracking-tight mt-0.5">
              Featured Collection
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-bold text-gray-950 hover:text-red-600 uppercase tracking-wide inline-flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-2xl aspect-[4/5]" />
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onNavigate={(slug) => navigate(`/product/${slug}`)}
                showFeaturedBadge={Boolean(product.featured)}
                showWishlist={false}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 px-4 rounded-2xl bg-neutral-50 border border-neutral-200">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 uppercase tracking-tight">
              New Drops Coming Soon
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
              Our curated collection is being prepared. Check our shop catalog or check back shortly!
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-black text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors shadow"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Explore Shop</span>
            </Link>
          </div>
        )}
      </section>
      {/* END: Featured/Trending Catalog Products */}

      {/* BEGIN: ShopByAnimeGrid */}
      <section
        id="shop-by-anime"
        className="py-10 px-4 bg-white border-t border-gray-200"
        data-purpose="anime-universes-grid"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-extrabold text-red-600 uppercase tracking-widest">
              Find Your Universe
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-gray-950">
              Shop By Anime
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {animeUniverses.map((universe) => (
              <button
                key={universe.id}
                type="button"
                onClick={() => navigate(`/shop?anime=${universe.id}`)}
                className="group relative rounded-xl overflow-hidden border border-gray-200 bg-black aspect-[16/10] shadow-sm text-left focus:outline-none"
              >
                <img
                  alt={universe.label}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-90 transition-all duration-300"
                  src={universe.image_url || '/placeholder.jpg'}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex items-end p-2.5 sm:p-3">
                  <span className="text-xs sm:text-sm font-black text-white uppercase flex items-center justify-between w-full">
                    <span>{universe.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1 text-red-500 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
      {/* END: ShopByAnimeGrid */}

      {/* BEGIN: ValueProposition & Stats */}
      <section className="py-10 px-4 bg-white border-t border-gray-200" data-purpose="why-choose-us">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-gray-950">
              Why Choose Us?
            </h2>
            <p className="text-xs text-gray-600 max-w-sm mx-auto mt-1">
              Tryvoal is built to serve authentic and coolest looking anime products to true anime lovers and fans!
            </p>
          </div>

          {/* Comparison Table */}
          <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-8">
            <div className="grid grid-cols-3 bg-brand-black text-white text-xs font-bold py-2.5 px-3 text-center items-center">
              <span className="text-left font-extrabold text-neutral-300">Feature</span>
              <span className="text-amber-400 font-black">TRYVOAL™</span>
              <span className="text-neutral-400 font-normal">Others</span>
            </div>
            <div className="divide-y divide-gray-100 text-xs">
              <div className="grid grid-cols-3 py-2.5 px-3 items-center text-center">
                <span className="text-left font-medium text-gray-900">Iconic Designs</span>
                <span className="text-emerald-600 font-bold text-sm">✔</span>
                <span className="text-red-500 font-bold text-sm">✖</span>
              </div>
              <div className="grid grid-cols-3 py-2.5 px-3 items-center text-center bg-gray-50/50">
                <span className="text-left font-medium text-gray-900">Quality Materials</span>
                <span className="text-emerald-600 font-bold text-sm">✔</span>
                <span className="text-red-500 font-bold text-sm">✖</span>
              </div>
              <div className="grid grid-cols-3 py-2.5 px-3 items-center text-center">
                <span className="text-left font-medium text-gray-900">(Actually) Fast Shipping</span>
                <span className="text-emerald-600 font-bold text-sm">✔</span>
                <span className="text-red-500 font-bold text-sm">✖</span>
              </div>
              <div className="grid grid-cols-3 py-2.5 px-3 items-center text-center bg-gray-50/50">
                <span className="text-left font-medium text-gray-900">Money Back Guarantee</span>
                <span className="text-emerald-600 font-bold text-sm">✔</span>
                <span className="text-red-500 font-bold text-sm">✖</span>
              </div>
            </div>
          </div>

          {/* Trust Milestones Section */}
          <div className="space-y-3">
            <div className="flex items-center p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-full border-2 border-brand-black flex items-center justify-center font-black text-xs shrink-0 bg-white font-mono">
                90%
              </div>
              <div className="ml-3.5">
                <h3 className="text-xs font-bold text-gray-900">More Than 4 Years In The Market!</h3>
                <p className="text-[11px] text-gray-500">Established source for rare imported drops.</p>
              </div>
            </div>

            <div className="flex items-center p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-full border-2 border-brand-black flex items-center justify-center font-black text-xs shrink-0 bg-white font-mono">
                95%
              </div>
              <div className="ml-3.5">
                <h3 className="text-xs font-bold text-gray-900">More than 10,000+ Happy Customers!</h3>
                <p className="text-[11px] text-gray-500">Serving manga lovers in 48+ countries.</p>
              </div>
            </div>

            <div className="flex items-center p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="w-12 h-12 rounded-full border-2 border-brand-black flex items-center justify-center font-black text-xs shrink-0 bg-white font-mono">
                99%
              </div>
              <div className="ml-3.5">
                <h3 className="text-xs font-bold text-gray-900">2000+ Viral Social Media Videos</h3>
                <p className="text-[11px] text-gray-500">Trending constantly across TikTok &amp; IG.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: ValueProposition & Stats */}
    </div>
  );
};
