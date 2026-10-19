import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import type { Product } from '../types/database';

// Popular / Trending items defined in reference
const POPULAR_ITEMS = [
  {
    id: 'popular-toji-worm',
    name: "Fushiguro Toji's Worm",
    slug: 'fushiguro-toji-worm',
    price: 3499,
    priceDisplay: '$39.99',
    badge: 'HOT',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD-7WziCC7G0rN-kOiDROf5U_l-_-7MCbr4lFfrpoP-yKWsUNwy_mMEJRxlHDsufRp2AkZJiFy--eWRPmzxbV2c7ZVBeWg1NWC2zzwtIWLpWPSo_C8bQE0HulEv6oxGf9ZGMW_BUAp2pqsvWegAT0eJ4iLEYxVKn90DZX0TKSFGUW4I_TPsiSMiTABJIBoiBe-4TfFK4d9OfTY-Hb8sw5TBp90tM3EV5ZoRIt8r07v-Wkg4i4N5axdY',
  },
  {
    id: 'popular-ds-sticker',
    name: 'Demon Slayer 3D Sticker',
    slug: 'demon-slayer-3d-sticker',
    price: 799,
    priceDisplay: 'From $9.99',
    badge: null,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB0SVblqPU9uWzjreMvAqqxM5cQUwvCn6wDEZfxXfYzP15HXa74PGqa0u67nFAkoqKlomZh8QC4CeUa1zxTG4_OsLG1F2v4g53n6pNnxRRaZ4jMnGtQpko38fY-WH6cOElfjL5TKifKZFQ1HInGI8RmwqxtFWmXV05S45VuCc2eT-0glPbiJ9_A34HAFt7FxUwgt1W0dxn2ShT9YINm_iFagzPmgI-QN0NJAL5LA16PCNwu4FY9Gbvo',
  },
  {
    id: 'popular-spear-heaven',
    name: 'Inverted Spear of Heaven',
    slug: 'inverted-spear-of-heaven',
    price: 2999,
    priceDisplay: '$35.99',
    badge: null,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCMR5V4VFtH0bbCf6eRZfX4j7HasiJfkvOR_sJA4tVyR-_7kLbO4NOht3_1b0OofDuETigKU1-u41-0_dmmBwkxMh031nF_hZBErgAMuPTQH6zuCELXYHXPTcvqLT_imk2EBWsQ79ltnY16X8VMBb3W1z46vz__6ahLF8TkIa9fqyoR7Nkc7zypRu7V2_f-ov_ZTkuyGEpoWOEzD_sbSg8PFixELNzeEEwUb8RNMUn6cnyj9ZBW9QWV',
  },
  {
    id: 'popular-gojo-glasses',
    name: 'Gojo BlackLens Glasses',
    slug: 'gojo-blacklens-glasses',
    price: 3999,
    priceDisplay: '$49.99',
    badge: null,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB-BDnCHo5LECJXtLeMg0wnHMRM5TUqcb9pxu4mMVeTeb6vo_5LRzJfQaGZy6qErzVtokag3OVPVvyksqr5g7xadpY5sTWdPdB-nVcHo1I5QJa3M5XBNXqoCMvPFmOOBSDhopjNzVjnr0nZerl1rfVbpmv-z8Bf5U3s1n__1EnzT0NtFQW-sCdHA0_vLYeU3b9OWPUZ2cFGskYMu1KQxqO_I6dF1OCuyBoV27iRwfPgck81pZYrWAId',
  },
  {
    id: 'popular-cat-plush',
    name: 'Jujutsu Cat-Ear Plush',
    slug: 'jujutsu-cat-ear-plush',
    price: 2899,
    priceDisplay: 'From $37.00',
    badge: null,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAvVh81qw1eAC4X0vkefKfCJ6lU5QjYb2jqtIzo91LjPrXIfXZ6aqg4TUKatus72vyN8pCSfcWyqKcEx56ibOi-PIXY2Ue5snAx2bi63WX_D7kHgMKcsTfGC-y9sPrSm0mRjnOB0KUCAQvkQlXPhdb03CRjVsyHKRzYPemflvnCJsfxujWjZc-KD9no0F1FzJvrCVqTu96c_jRAhhXPSDPZsRsPIbD_xcort5vTomVu26FfB3NiloP9',
  },
];

// Streetwear Hoodies
const HOODIE_ITEMS = [
  {
    id: 'hoodie-aot-harajuku',
    name: 'AoT Harajuku Hoodie',
    slug: 'aot-harajuku-hoodie',
    price: 3999,
    priceDisplay: '$49.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBJ3MDmUSbsOaB1aj7A-Ml6Qj6QBA9gUiz5oMU4GjoNq8fVPPK_iEQyqkqFTwQbd-GlSe-Hbw_qMOtVBYKB9RVA2We_3IdxqMQ2-DvzKm9zhMCO_SB4x-6Yxu5SBUlaWmMn6QgPVrTzDmfsm8QC9Mfoz9eambr0orPL91yNzBxC_kcSJ9UkH5S58IYv8OuzlupNQzVxbE9EipLANKq6o5EIBAWF_7NSB6RPbruapFPtvwlaCYCTX8C5',
  },
  {
    id: 'hoodie-nezuko-graphic',
    name: 'Nezuko Graphic Hoodie',
    slug: 'nezuko-graphic-hoodie',
    price: 2899,
    priceDisplay: '$34.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDw7V180Uty6vggpCF7pJ5iKvHVhBZmchf9jCR3ho1HqoWrZATEotcNIIX3RcULikx13hU-gEmD0BBRC4epq4hfoHCtqEDeDEWjLXyBajpF6ZhIftfnDPw0Zq8ceG2IHrinkdwFKtmKas1g9gTX3_64QoLk5me7QU0trvreM2u5eM8rOLMbvl59clOApXYUn1ThJ2-0ddcxXnjyb8DdjfIK5SkoV3sNLtBWf_-YfKnQG5AdSHNS8JCS',
  },
  {
    id: 'hoodie-jujutsu-kaisen',
    name: 'Jujutsu Kaisen Hoodie',
    slug: 'jujutsu-kaisen-hoodie',
    price: 4499,
    priceDisplay: '$59.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC0eK2xIif2afQk7OQShzVBYjr6n4Zu7WwoNqeYpX1k5VZ8UtTYiYoYx0dNAskR7RxJn8VQZx7wkq2e1-STEjBL_Abedxk5hac29wFjIOQYUuM7yt6r--JNPkDx6N7D0yX9c9xfuRtYM8eeVDUtTpch-Q_WuTJs2Ig3jLJ58pHnCBHjfo1RiXKRjHzvhIRPyuHJYMztkaiVTOzZ7bTyGeUiiiZkSaf_2imXCLzJEn6BOsGnopGSPIW2',
  },
  {
    id: 'hoodie-one-piece-sun-god',
    name: 'One Piece Sun God Hoodie',
    slug: 'one-piece-sun-god-hoodie',
    price: 3199,
    priceDisplay: '$39.90',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDebxfMxFEyfrn0-r0G2uzN7KhNQhS151oeW61M6eH7zyreiCa0VETagz5GjH1FLKyQwm-_V98rB_OsBunF_L6xFwDnTQGXqcHWqOC2e6y3j2y7ENbin063KmxIV5P_2lte-WHTSnGXVCpYYypxVbljzNX9v9oiu5qbRKxFqgbjr-zhKJseHyJ08eWZ3Q0Ra_y9TC4VfLKln1osgJOQv7GKJyXRXaD57EngOu9FnqkAp9WkmBRQYGnO',
  },
];

// Graphic T-Shirts
const TSHIRT_ITEMS = [
  {
    id: 'tee-attack-on-titan',
    name: 'Attack on Titan T-Shirt',
    slug: 'attack-on-titan-tshirt',
    price: 2399,
    priceDisplay: '$29.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCNW603OUS2TNjE0ty_tSvyet8ZmoUXeu6xaQ96vudT9aivsjRbb2SOLQhLtynBgO3GNuNdR_G7HsGCrXY78u0nmYBcK5dH2kTnCS2plpv6_scLwnSNLh0rDKK-ndCm6nefBpRDdlI9NB7SZTr1hxNABrORI0GKY8aIOBiuOEgwFqwycmC0xcyLHVBV5OGmUvzT2FLvAyD7fofvynLgOcIr7MJ_J6NaxWQTwlVCH7arOR9Kihsv4wiD',
  },
  {
    id: 'tee-one-piece-washed',
    name: 'One Piece Washed Tee',
    slug: 'one-piece-washed-tee',
    price: 2999,
    priceDisplay: '$39.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAiy3BMEGxtgNToJjAiO5lvNym1EtJzZX_IoF06JB_Ue7YT3WuG_NkxyzTbnQp42rKHv12SLlMP45TzuVOMWRBiHbiN3RCg_z_5M1JmM3fqPiXyunC9-59-ZFNm4OUOkndts7G9i9tNhwFgpWoadKFyPTRS1N2069XQ5pdaCjdTQZrkB27qiPGuZp-rpb3ymN018rfKOWY-JizgPKFo0MyVNSqQhaZQOIMt9hbwGTuRgZTZwniOGH7a',
  },
  {
    id: 'tee-jojo-bizarre',
    name: "JoJo's Bizarre Adventure Tee",
    slug: 'jojo-bizarre-adventure-tee',
    price: 2399,
    priceDisplay: '$29.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDt8aTLVY_VKhmzCL0pth_9ofsRt8y2iX3u9fyAc4JTN0b7rHm8lv5DfwiyBYxgEFMaHtPgsgoGtQvICKyakqDtE1abUTfEnM1uAK7GQJlcR3UTDk14XREIvw6G2DWZ52LWgcssYw-Zsa6ZBfzo7eOIYMKJ_sg-fU2M5Aqwzb0PJ1H90Zpbnoh1EfT_HtYsWWHgUv02ki1ta2eQEj-0QrwZZ-jBSAcyno9ItXAcavUT8iH1Z5Y6SBUl',
  },
  {
    id: 'tee-toji-streetwear',
    name: 'Toji Streetwear Tee',
    slug: 'toji-streetwear-tee',
    price: 3799,
    priceDisplay: '$49.99',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDolOPRm3GQBRcISX65qiQyvxHNwpozZNaJCgqRHf5R0cc2OlckbN9IBVcj45NqNQtg2C-EK8ZQyLJadf-nYObjK5rgmGw-83PB8YIR0uBObO_a21-fBOmr-6AfAn77hJ_Hhy3rv_0ykvYZb6AfBNwixjOSWJPPf_0hVagaSLbFLNSwf1CgSM7OneY8OACMHKG9d3v6O6ah-o0UUL5-Xp5pZCgYtIjEJiqcfzZ9_tpRdON0tku_dzym',
  },
];

// Anime Universes Grid
const ANIME_UNIVERSES = [
  {
    name: 'Attack On Titan',
    slug: 'attack-on-titan',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB2YH_KbzeU69GvYL12nSOEx060Y1hDz79G21wHSA8_z3amsgVThk1ihJg2pqLZMhUaLBEbSBaSOGbdwacWPj4vMANzy_dMV8sJ6yzpzdrE4KMTsuRcp_KRXxF3BD7UegAEQXBWI2aMl5IaCcaO0s-15blHYZPfht0JN81niMUU6kJJ9p0ruffiYI2C55ChqxvhT5f1oeB5ccqaBZnrGdAmQHKg4TZiURuvZJP0aaXz5uJ3UDP08uWP',
  },
  {
    name: 'Demon Slayer',
    slug: 'demon-slayer',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBabjgfmc6UZnVgbC9AjPJTwuFtz8nQUHj2n2EucLYqM8001QNkQ1_gRLwbPTon6_XivZr_UWr84veJ0C2kTXdopCxz4tGVWynGzzyBKa_JOat5fiQBGSiXbuOM6TbbADzFOZLpW3h2EfnaYIECtPBNnXVgMe4AMYI-NjohbHi2Nj63DneAlBwtVxwRQ1i594Od4JF2bl6Lm_LF1RcsXfWeBghBFdXRBX8XJcC6JSNocKTjfmhrMQAT',
  },
  {
    name: 'Jujutsu Kaisen',
    slug: 'jujutsu-kaisen',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB0ZCSciWsK6dS8B0y8-kCwJoe767WZC_bhcq9DE6LsWosBBcU-lwbaAac37AI3D0E49CTfRNRbmcfEMJNSYJLRS-W92-5eBRe-QBcukoZFCfuzdaynqJ3xU9C4pzgP_ruubdBh2RifK8kgwmWNFtUQiBfHK74KaedeG7X65e1GEyOYatIYDeGJ2uRpxh-wkZzxIdgB3V8JpNxpc7BHAelcDu7Bnm436jRO-IT0nzJpP7OW009lgANv',
  },
  {
    name: 'Dragon Ball',
    slug: 'dragon-ball',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAgcxsYKwS40umLMVrGk44s-cXJUCrWtdaMtRIqoYQZJq04nyWP3qaMUgeMAHH0LY3XCpZWTm5RUnI5mFiAI-JVbL3Oy4XnEhQ8vw8Jjfw6NtGpvJrA9Z5J0Y4fXBGnvltKz8cN-ift5neUgZxtKPB4UxTFsyTUM9307UhA40w8hSZqQgl50Q2DVdROMsVyZMFl9WQuWBid7qDsrx47o1VwECA9Sd2hAmCYDG3QqgAi19WqEZBC0tsU',
  },
  {
    name: 'One Piece',
    slug: 'one-piece',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC-7bqnxN2IOKkyE16V7O2gbUd6aVJJldGCJml7GS2ZMmDp2Muke2DVZvTNDn_ruxJ0_OUDdcJplXgMCva563zCRoA3cfOqd5bEm7JycE_QmpB2ePI0T2tQdCD2oHiJ9suNBnjU3A8V6h4VXPwt8bao0NzHfaInZsqiCiNrO6JWy6aLzrTplacPqdZH7RfS0t80gM4l3hyyVgLnSW3AOftox688DCvZgqspL38RGGq7qrdCTQ9xqK4A',
  },
  {
    name: 'Naruto',
    slug: 'naruto',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDaRYFPz-q905ExGzbkKsw5WSO621hvgM1gAWECOmAp3XQoaBrz0YBj4V2bTc0lJeUECeW3UgW2y9p-HdW8gt3BO3LMYHUhn8ruF5AOizgqFyjgtO2gmM27jdVC9nPDoP0UGHS8Xw8rd3-g6w9qQ0x8y1tVq9EtP6TRmNl6DeDXMYbOn9bzcf9OttQDLHlxwC__rKxblyyfogboUYggb8_sQeyBrJPaJIB_vZqJ8F6Mfqq2pEU7YD72',
  },
  {
    name: 'Tokyo Revengers',
    slug: 'tokyo-revengers',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCVGh2Q0HzwcGyFjGLbq6-l1JUQgzXG8j2ra6EKHMcUhCEYkQCJT65xPdPPz-Xs8V_CzeP2t90mY79zZZ9-481l8gIGKSChLIYz3KvvqLIER475JJ64B0fETwAWURwRLGDadZ_pRsZL904yrnhXqbpW9oGFAXQYQCISn-aMpMBM5O8bvJecWk6_HYzdIUQqZdsK175AMBytHSsRq5yrB1e8loTmW3DW9m2AHmzx9C7Q4Gk0AcTBkClv',
  },
  {
    name: 'Hunter X Hunter',
    slug: 'hunter-x-hunter',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuApgys7WiFVf7R49osj_ZArHOrTz4RK9epq1Qad9dqIp_yvXVX2B1yMDkTKr0GKKQRj00WEB5ucSjR1zkWirkhTh-IiuIbs1q2qnNptef_omD5X7ee5G1Oax6ZBrAfjTaVRPb1kf76TQgzVBly7F4KeoZqx026uc0QAL-EHC_8KWJeZsfqf1TOsVWuUATON_eq98w-Lp1Vj_YmWmyZrXl1UuvzsSf-ngI2ft_p9hDUdacEWqTHzmvNW',
  },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (name: string) => {
    setToastMessage(`Added "${name}" to your cart!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleQuickAdd = (item: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image: string;
  }) => {
    const productObj: Product = {
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      stock: 50,
      featured: true,
      category_id: null,
      main_image_url: item.image,
      additional_images: [],
      created_at: new Date().toISOString(),
      description: `Authentic ${item.name} from Tryvoal Anime Store.`,
      brand: 'TRYVOAL',
    };
    addItem(productObj, 1);
    showToast(item.name);
  };

  return (
    <div className="pb-16 bg-white text-gray-900 select-none">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-brand-black text-white px-5 py-3 rounded-full shadow-2xl flex items-center space-x-2.5 border border-neutral-700 text-xs font-semibold backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BEGIN: HeroSection */}
      <section
        className="relative bg-brand-black text-white px-4 pt-8 pb-12 sm:pt-14 sm:pb-16 overflow-hidden border-b border-neutral-800"
        data-purpose="hero-banner"
      >
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#4b5563_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-lg mx-auto">
          <span className="inline-block bg-red-600/90 text-white text-[11px] font-bold tracking-widest uppercase px-3.5 py-1 rounded-full mb-3 shadow-sm border border-red-500/30">
            Premium Japanese Streetwear
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase leading-tight mb-2 font-mono">
            Tryvoal : Anime store
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 font-normal leading-relaxed mb-6 sm:mb-8 max-w-md mx-auto">
            Authentic apparel, cursed accessories, and oversized manga graphics designed for genuine fans.
          </p>

          {/* Hero Showcase Card */}
          <div
            className="relative rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-900 text-left group"
            data-purpose="hero-showcase-banner"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-black">
              <img
                alt="Ryōshin Arcane Mechanical Watch - Limited Edition Anime Poster"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                src="/anime_watch_hero.jpg"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
              <div className="absolute top-3 left-3">
                <span className="inline-block bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded shadow">
                  LIMITED DROP // RYŌSHIN ARCANE
                </span>
              </div>
              <div className="absolute top-3 right-3">
                <span className="inline-block bg-black/80 backdrop-blur-md text-amber-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-neutral-700">
                  Only 250 Pieces
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-neutral-900 border-t border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono uppercase text-neutral-400 font-bold tracking-wider">
                  RYŌSHIN ARCANE TIMEPIECE
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  In Stock & Ready to Ship
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-tight leading-snug mb-1.5 font-mono">
                The Arcane Chronicle: Unleash The Power
              </h2>
              <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
                Ultra-detailed custom mechanical anime timepiece with glowing crimson kanji indices, matte black steel link bracelet, and sapphire crystal dome.
              </p>

              <Link
                to="/shop?search=watch"
                className="w-full bg-white hover:bg-neutral-100 text-black font-extrabold text-xs uppercase tracking-wider py-3 rounded-lg flex items-center justify-center space-x-2 transition-transform active:scale-95 shadow"
              >
                <span>EXPLORE WATCH DROP</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </Link>

              <div className="mt-3.5 pt-3 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400 font-medium">
                <span className="flex items-center space-x-1">
                  <span>⚡</span>
                  <span>Ultra-Detailed Mechanical Cut</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>🔥</span>
                  <span>Exclusive Online Drop</span>
                </span>
              </div>
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
            <span>Free Shipping Worldwide</span>
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

      {/* BEGIN: MostPopularSection */}
      <section className="py-8 px-4 max-w-7xl mx-auto" data-purpose="popular-products">
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Trending Now
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-gray-900 tracking-tight mt-0.5">
              Most Popular
            </h2>
          </div>
          <Link
            to="/shop?featured=true"
            className="text-xs font-bold text-gray-950 hover:text-red-600 uppercase tracking-wide inline-flex items-center gap-1"
          >
            <span>View all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Horizontal Swipeable List on Mobile, Clean Grid on Larger Screens */}
        <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-5 space-x-4 sm:space-x-0 sm:gap-4 overflow-x-auto no-scrollbar pb-3 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
          {POPULAR_ITEMS.map((item) => (
            <article
              key={item.id}
              className="min-w-[155px] w-[155px] sm:w-auto shrink-0 snap-start bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div
                onClick={() => navigate(`/shop?search=${encodeURIComponent(item.name)}`)}
                className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer"
              >
                <img
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  src={item.image}
                  loading="lazy"
                />
                {item.badge && (
                  <span className="absolute top-2 left-2 bg-black/85 text-white text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <h3
                  onClick={() => navigate(`/shop?search=${encodeURIComponent(item.name)}`)}
                  className="text-xs font-bold text-gray-900 line-clamp-1 hover:text-red-600 cursor-pointer"
                >
                  {item.name}
                </h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-extrabold text-gray-950">{item.priceDisplay}</p>
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(item)}
                    className="p-1 bg-neutral-100 hover:bg-brand-black hover:text-white rounded text-[10px] font-bold transition-colors"
                    title="Add to cart"
                  >
                    + Cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {/* END: MostPopularSection */}

      {/* BEGIN: CategoryHoodies */}
      <section className="py-8 px-4 bg-white border-t border-gray-200" data-purpose="hoodies-collection">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">
              Engineered For Warmth & Drape
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-gray-900 tracking-tight">
              Streetwear Hoodies
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Heavyweight 450GSM custom anime silhouettes</p>
          </div>

          {/* 2-Column Mobile, 4-Column Desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {HOODIE_ITEMS.map((hoodie) => (
              <div
                key={hoodie.id}
                className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex flex-col justify-between group hover:border-neutral-300 transition-all shadow-xs"
              >
                <div
                  onClick={() => navigate(`/shop?search=${encodeURIComponent(hoodie.name)}`)}
                  className="aspect-[4/5] bg-gray-200 rounded-lg overflow-hidden mb-2 relative cursor-pointer"
                >
                  <img
                    alt={hoodie.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={hoodie.image}
                    loading="lazy"
                  />
                  <span className="absolute top-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                    450 GSM
                  </span>
                </div>
                <div>
                  <h3
                    onClick={() => navigate(`/shop?search=${encodeURIComponent(hoodie.name)}`)}
                    className="text-xs font-bold text-gray-800 line-clamp-1 cursor-pointer hover:text-red-600"
                  >
                    {hoodie.name}
                  </h3>
                  <p className="text-xs font-black text-gray-950 mt-1">{hoodie.priceDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(hoodie)}
                  className="mt-2.5 w-full py-2 bg-brand-black hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors active:scale-95 shadow-xs"
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center max-w-sm mx-auto">
            <Link
              to="/shop?category=Hoodies"
              className="block w-full py-2.5 border border-brand-black text-brand-black hover:bg-brand-black hover:text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors text-center"
            >
              View All Hoodies (18)
            </Link>
          </div>
        </div>
      </section>
      {/* END: CategoryHoodies */}

      {/* BEGIN: CategoryTShirts */}
      <section className="py-8 px-4 bg-gray-50 border-t border-gray-200" data-purpose="tshirts-collection">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest">
              Daily Aesthetic Fits
            </span>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-gray-900 tracking-tight">
              Graphic T-Shirts
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Oversized vintage wash & distressed prints</p>
          </div>

          {/* 2-Column Mobile, 4-Column Desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {TSHIRT_ITEMS.map((tee) => (
              <div
                key={tee.id}
                className="bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-neutral-300 transition-all"
              >
                <div
                  onClick={() => navigate(`/shop?search=${encodeURIComponent(tee.name)}`)}
                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 cursor-pointer"
                >
                  <img
                    alt={tee.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    src={tee.image}
                    loading="lazy"
                  />
                </div>
                <div>
                  <h3
                    onClick={() => navigate(`/shop?search=${encodeURIComponent(tee.name)}`)}
                    className="text-xs font-bold text-gray-800 line-clamp-1 cursor-pointer hover:text-red-600"
                  >
                    {tee.name}
                  </h3>
                  <p className="text-xs font-black text-gray-950 mt-1">{tee.priceDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(tee)}
                  className="mt-2.5 w-full py-2 bg-brand-black hover:bg-neutral-800 text-white text-[11px] font-bold rounded-lg uppercase tracking-wider transition-colors active:scale-95 shadow-xs"
                >
                  Quick Add
                </button>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center max-w-sm mx-auto">
            <Link
              to="/shop?category=T-Shirts"
              className="block w-full py-2.5 bg-brand-black hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors shadow text-center"
            >
              View All T-Shirts
            </Link>
          </div>
        </div>
      </section>
      {/* END: CategoryTShirts */}

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
            {ANIME_UNIVERSES.map((universe) => (
              <button
                key={universe.name}
                type="button"
                onClick={() => navigate(`/shop?search=${encodeURIComponent(universe.name)}`)}
                className="group relative rounded-xl overflow-hidden border border-gray-200 bg-black aspect-[16/10] shadow-sm text-left focus:outline-none"
              >
                <img
                  alt={universe.name}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-90 transition-all duration-300"
                  src={universe.image}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex items-end p-2.5 sm:p-3">
                  <span className="text-xs sm:text-sm font-black text-white uppercase flex items-center justify-between w-full">
                    <span>{universe.name}</span>
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
