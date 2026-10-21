import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useCatalogStore } from '../store/useCatalogStore';
import { supabase } from '../lib/supabase';
import type { Product, Category, Order, ProductQuestion, Review, NewsletterSubscriber, ReplacementRequest } from '../types/database';
import { sanitizeSlug } from '../lib/persistence';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ShieldCheck, Plus, Edit, Trash2, Check, X, CreditCard, ShoppingBag, List, MessageSquare, Star, Mail, Download, RefreshCcw, Tag, Megaphone, Calendar, Copy, MapPin, Menu, AlertTriangle, Search, Sliders, X as CloseIcon, Truck, Printer, QrCode, Package, Clock, ExternalLink, CheckCircle2, Zap, Pin, Upload, FileText, Sparkles } from 'lucide-react';
import { ProductVariantEditor } from '../components/admin/ProductVariantEditor';
import type { OptionDraft, VariantDraft } from '../components/admin/ProductVariantEditor';
import { ImageUploadZone } from '../components/admin/ImageUploadZone';
import { deleteProductImagesFromStorage } from '../lib/storage';
import { FALLBACK_CATEGORIES, getAllAnimeSeries, fetchAnimeThumbnails, saveAnimeSeriesThumbnail, fetchCustomAnimeSeriesFromDB, saveCustomAnimeSeriesList, syncAllAnimeSubcategoriesToCloud, type AnimeSeriesEntry, getCachedPinnedProductIds, fetchPinnedProductIds, setProductPinStatus, isProductEffectivelyPinned } from '../lib/catalogQueries';
import { fetchReviewsMultiChannel, syncReviewsMultiChannel, updateReviewStatusMultiChannel, deleteReviewMultiChannel } from '../lib/reviewSync';
import { DEFAULT_HERO_CONFIG, getCachedHeroConfig, fetchHeroConfig, saveHeroConfig, type HeroBannerConfig } from '../lib/heroConfig';
import { dispatchOrderToQikink, getQikinkConfig, saveQikinkConfig, testQikinkConnection, checkQikinkOrderStatus } from '../lib/qikink';
import type { QikinkConfig } from '../lib/qikink';

export const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, initialized } = useAuthStore();

  // Tabs
  const [activeTab, setActiveTab] = useState<'verification' | 'products' | 'categories' | 'orders' | 'inventory' | 'questions' | 'reviews' | 'subscribers' | 'replacements' | 'coupons' | 'announcement' | 'hero_banner'>('verification');

  // Hero Banner / Main Ad editor state
  const [heroConfig, setHeroConfig] = useState<HeroBannerConfig>(getCachedHeroConfig);
  const [savingHero, setSavingHero] = useState(false);

  // Sub-categories / Anime Universes state
  const [activeCategoryView, setActiveCategoryView] = useState<'main' | 'subcategories'>('main');
  const [customAnimeList, setCustomAnimeList] = useState<AnimeSeriesEntry[]>(() => {
    try {
      const stored = localStorage.getItem('tryvoal_custom_anime_series');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [animeThumbnails, setAnimeThumbnails] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('tryvoal_anime_thumbnails');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [editingAnimeSeries, setEditingAnimeSeries] = useState<AnimeSeriesEntry | null>(null);
  const [isAnimeModalOpen, setIsAnimeModalOpen] = useState(false);
  const [animeForm, setAnimeForm] = useState({ label: '', id: '', short: '', image_url: '' });
  const [savingAnime, setSavingAnime] = useState(false);
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState('all');
  
  // Mobile drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Database Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequest[]>([]);
  const [dbWarning, setDbWarning] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingCategory, setSubmittingCategory] = useState(false);

  // Forms / Modals States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    stock: 0,
    featured: false,
    category_id: '',
    main_image_url: '',
    additional_images: '',
    sku: '',
    brand: 'TRYVOAL',
    material: '',
    finish: '',
    warranty_info: '',
    is_new_arrival: false,
    is_active: true,
    is_pinned: false,
    shipping_fee: 0,
  });

  // Pinned products state & filter
  const [pinnedProductIds, setPinnedProductIds] = useState<string[]>(() => getCachedPinnedProductIds());
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);

  // Variant States
  const [hasVariants, setHasVariants] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<OptionDraft[]>([]);
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    image_url: '',
    size_enabled: false
  });


  // Tracking Modal States
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingTargetStatus, setTrackingTargetStatus] = useState('');
  const [dispatchingQikinkId, setDispatchingQikinkId] = useState<string | null>(null);
  const [isQikinkSettingsModalOpen, setIsQikinkSettingsModalOpen] = useState(false);
  const [qikinkConfigForm, setQikinkConfigForm] = useState<QikinkConfig>(() => getQikinkConfig());
  const [testingQikink, setTestingQikink] = useState(false);
  const [qikinkTestResult, setQikinkTestResult] = useState<{ success: boolean; is_simulation?: boolean; message: string } | null>(null);
  const [pollingQikinkOrderId, setPollingQikinkOrderId] = useState<string | null>(null);

  // Delivery Date Edit States
  const [editingDeliveryDateOrderId, setEditingDeliveryDateOrderId] = useState<string | null>(null);
  const [editingDeliveryDate, setEditingDeliveryDate] = useState('');

  // Coupon Management States
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [couponForm, setCouponForm] = useState({ code: '', type: 'PERCENT' as 'PERCENT' | 'FIXED', value: 0, minOrder: 0, active: true });

  // Announcement State
  const [announcementText, setAnnouncementText] = useState(() => {
    const stored = localStorage.getItem('tryvoal_announcement') ?? localStorage.getItem('elitebath_announcement');
    return stored !== null ? stored : '✨ Launch Offer: Use code TRYVOAL10 for 10% off! 🚚 FREE Express Shipping across India!';
  });

  // Order Management Filter & Modal States
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('ALL');
  const [selectedPackingSlipOrder, setSelectedPackingSlipOrder] = useState<Order | null>(null);

  // Copy Helpers
  const handleCopyText = (text: string, label: string = 'Text') => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard!`);
    }).catch(() => {
      alert(`Failed to copy ${label.toLowerCase()}`);
    });
  };

  // Copy Address Function
  const handleCopyAddress = (order: Order) => {
    const addr = order.shipping_address;
    const addressText = [
      addr.fullName,
      addr.phone,
      addr.email,
      addr.address,
      addr.landmark,
      addr.city,
      addr.state,
      addr.pincode,
      addr.country
    ].filter(Boolean).join(', ');
    
    handleCopyText(addressText, 'Address');
  };

  // --- Fake Reviews Bulk Import & Filter States ---
  const [isReviewImportModalOpen, setIsReviewImportModalOpen] = useState(false);
  const [jsonReviewList, setJsonReviewList] = useState<Array<{ name: string; message: string; rating: number }>>([]);
  const [jsonReviewFileName, setJsonReviewFileName] = useState('');
  const [jsonReviewError, setJsonReviewError] = useState<string | null>(null);
  const [reviewTargetScope, setReviewTargetScope] = useState<'ALL' | 'CATEGORY' | 'SPECIFIC'>('ALL');
  const [reviewTargetCategoryId, setReviewTargetCategoryId] = useState<string>('all');
  const [reviewTargetProductIds, setReviewTargetProductIds] = useState<string[]>([]);
  const [reviewDateWindow, setReviewDateWindow] = useState<'30' | '7' | '14' | '60' | '0'>('30');
  const [reviewShuffle, setReviewShuffle] = useState(true);
  const [reviewVerifiedBuyer, setReviewVerifiedBuyer] = useState(true);
  const [reviewAutoApprove, setReviewAutoApprove] = useState(true);
  const [importingReviews, setImportingReviews] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Reviews Tab Search & Filter States
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [reviewFilterRating, setReviewFilterRating] = useState<'ALL' | '5' | '4' | '3'>('ALL');
  const [reviewFilterStatus, setReviewFilterStatus] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');
  const [reviewFilterProduct, setReviewFilterProduct] = useState<string>('ALL');

  // Memoized filtered reviews list
  const filteredReviews = useMemo(() => {
    return reviews.filter((rev) => {
      const linkedProduct = products.find((p) => p.id === rev.product_id);
      const searchMatch = !reviewSearchQuery.trim() || 
        rev.user_name.toLowerCase().includes(reviewSearchQuery.toLowerCase()) ||
        rev.review_text.toLowerCase().includes(reviewSearchQuery.toLowerCase()) ||
        (linkedProduct && linkedProduct.name.toLowerCase().includes(reviewSearchQuery.toLowerCase()));

      const ratingMatch = reviewFilterRating === 'ALL' || String(rev.rating) === reviewFilterRating;
      const statusMatch = reviewFilterStatus === 'ALL' || rev.status === reviewFilterStatus;
      const productMatch = reviewFilterProduct === 'ALL' || rev.product_id === reviewFilterProduct;

      return searchMatch && ratingMatch && statusMatch && productMatch;
    });
  }, [reviews, products, reviewSearchQuery, reviewFilterRating, reviewFilterStatus, reviewFilterProduct]);

  // Review statistics summary
  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const count5 = reviews.filter((r) => r.rating === 5).length;
    const count4 = reviews.filter((r) => r.rating === 4).length;
    const count3 = reviews.filter((r) => r.rating === 3).length;
    const approved = reviews.filter((r) => r.status === 'APPROVED').length;
    const pending = reviews.filter((r) => r.status === 'PENDING').length;
    const avg = total > 0 ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / total).toFixed(1) : '5.0';
    return { total, count5, count4, count3, approved, pending, avg };
  }, [reviews]);


  // Verification checks for admin role
  useEffect(() => {
    if (initialized) {
      if (!user) {
        navigate('/auth');
      } else if (profile && profile.role !== 'admin') {
        navigate('/');
      } else {
        loadAdminData();
        loadReplacementsData();
        loadAnnouncement();
      }
    }
  }, [user, profile, initialized, navigate]);

  // --- Coupon Management ---
  const loadCoupons = useCallback(async () => {
    try {
      const { data: dbCoupons, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      if (dbCoupons) {
        const mappedCoupons = dbCoupons.map((c: any) => ({
          id: c.id,
          code: c.code,
          type: (c.discount_type === 'FIXED' || c.type === 'FIXED') ? 'FIXED' : 'PERCENT',
          value: Number(c.discount_value !== undefined ? c.discount_value : c.value),
          minOrder: Number(c.min_order_amount !== undefined ? c.min_order_amount : c.min_order),
          active: c.active !== false,
          created_at: c.created_at
        }));
        setCoupons(mappedCoupons);
        localStorage.setItem('elitebath_coupons', JSON.stringify(mappedCoupons));
        return;
      }
    } catch (err) {
      console.warn('Failed to load coupons from DB, using local cache:', err);
    }
    try {
      const raw = localStorage.getItem('elitebath_coupons');
      if (raw) setCoupons(JSON.parse(raw));
    } catch (_) {}
  }, []);

  const handleCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponForm.code.trim().toUpperCase();
    if (!code) return;
    
    // DB check constraint expects discount_type IN ('PERCENTAGE', 'FIXED')
    const dbDiscountType = couponForm.type === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
    const dbPayload = { 
      code, 
      discount_type: dbDiscountType, 
      discount_value: Number(couponForm.value) || 0, 
      min_order_amount: Number(couponForm.minOrder) || 0, 
      active: Boolean(couponForm.active) 
    };

    try {
      if (editingCoupon) {
        // Update in DB
        const { error } = await supabase
          .from('coupons')
          .update(dbPayload)
          .eq('code', editingCoupon.code);
        if (error) throw error;
      } else {
        // Check duplicate
        if (coupons.some(c => c.code === code)) {
          alert('Coupon code already exists!');
          return;
        }
        // Insert in DB
        const { error } = await supabase
          .from('coupons')
          .insert(dbPayload);
        if (error) throw error;
      }

      // Update local storage backup
      const updatedCoupons = editingCoupon
        ? coupons.map(c => c.code === editingCoupon.code ? { ...c, code, type: couponForm.type, value: couponForm.value, minOrder: couponForm.minOrder, active: couponForm.active } : c)
        : [...coupons, { id: `c-${Date.now()}`, code, type: couponForm.type, value: couponForm.value, minOrder: couponForm.minOrder, active: couponForm.active, created_at: new Date().toISOString() }];
      localStorage.setItem('elitebath_coupons', JSON.stringify(updatedCoupons));
      setCoupons(updatedCoupons);

      alert(editingCoupon ? 'Coupon updated and synced to database!' : 'Coupon created and synced to database!');
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
      void loadCoupons();
    } catch (err: any) {
      console.error('Coupon submit failed in DB:', err);
      // Fallback: save locally
      const updatedCoupons = editingCoupon
        ? coupons.map(c => c.code === editingCoupon.code ? { ...c, code, type: couponForm.type, value: couponForm.value, minOrder: couponForm.minOrder, active: couponForm.active } : c)
        : [...coupons, { id: `c-${Date.now()}`, code, type: couponForm.type, value: couponForm.value, minOrder: couponForm.minOrder, active: couponForm.active, created_at: new Date().toISOString() }];
      localStorage.setItem('elitebath_coupons', JSON.stringify(updatedCoupons));
      setCoupons(updatedCoupons);
      alert('Coupon saved locally! (Database notice: ' + (err.message || err) + ')');
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
    }
  };

  const handleDeleteCoupon = async (code: string) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    const nextCoupons = coupons.filter(c => c.code !== code);
    setCoupons(nextCoupons);
    localStorage.setItem('elitebath_coupons', JSON.stringify(nextCoupons));
    try {
      const { error } = await supabase.from('coupons').delete().eq('code', code);
      if (error) throw error;
      alert('Coupon deleted!');
      void loadCoupons();
    } catch (err: any) {
      console.warn('Coupon delete failed in DB:', err);
    }
  };

  const handleToggleCoupon = async (code: string) => {
    const coupon = coupons.find(c => c.code === code);
    if (!coupon) return;
    const newActive = !coupon.active;
    const nextCoupons = coupons.map(c => c.code === code ? { ...c, active: newActive } : c);
    setCoupons(nextCoupons);
    localStorage.setItem('elitebath_coupons', JSON.stringify(nextCoupons));
    try {
      const { error } = await supabase.from('coupons').update({ active: newActive }).eq('code', code);
      if (error) throw error;
      void loadCoupons();
    } catch (err: any) {
      console.warn('Coupon toggle failed in DB:', err);
    }
  };

  // --- Announcement Management ---
  const loadAnnouncement = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('site_announcements')
        .select('message')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error) {
        if (data && data.length > 0 && data[0].message?.trim()) {
          setAnnouncementText(data[0].message);
          localStorage.setItem('tryvoal_announcement', data[0].message);
          localStorage.setItem('elitebath_announcement', data[0].message);
          return;
        } else {
          // Explicitly empty in DB
          setAnnouncementText('');
          localStorage.setItem('tryvoal_announcement', '');
          localStorage.setItem('elitebath_announcement', '');
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to load announcement from DB:', err);
    }
    // Fallback to localStorage
    const saved = localStorage.getItem('tryvoal_announcement') ?? localStorage.getItem('elitebath_announcement');
    setAnnouncementText(saved ?? '');
  }, []);

  const handleSaveAnnouncement = async () => {
    const text = announcementText.trim();
    localStorage.setItem('tryvoal_announcement', text);
    localStorage.setItem('elitebath_announcement', text);
    localStorage.setItem('animemaze_announcement', text);
    window.dispatchEvent(new Event('announcement_updated'));

    try {
      // Deactivate all previous announcements first to keep a single active one
      await supabase
        .from('site_announcements')
        .update({ active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (text) {
        const { error } = await supabase
          .from('site_announcements')
          .insert({ message: text, active: true });

        if (error) throw error;
      }
      alert(text ? 'Announcement updated and synced to database!' : 'Announcement cleared and synced to database!');
    } catch (err: any) {
      console.warn('Supabase announcement save failed:', err);
      alert('Announcement updated locally! (Database notice: ' + (err?.message || err) + ')');
    }
  };

  const handleClearAnnouncement = async () => {
    setAnnouncementText('');
    localStorage.setItem('tryvoal_announcement', '');
    localStorage.setItem('elitebath_announcement', '');
    localStorage.setItem('animemaze_announcement', '');
    window.dispatchEvent(new Event('announcement_updated'));
    try {
      const { error } = await supabase
        .from('site_announcements')
        .update({ active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      alert('Announcement cleared and synced to database!');
    } catch (err: any) {
      console.warn('Supabase announcement clear failed:', err);
      alert('Announcement cleared locally! (Database notice: ' + (err?.message || err) + ')');
    }
  };

  // Computed all anime series (core series + custom ones created by admin, with custom thumbnails)
  const allAnimeSeries: AnimeSeriesEntry[] = useMemo(() => {
    return getAllAnimeSeries(customAnimeList, animeThumbnails);
  }, [customAnimeList, animeThumbnails]);

  // Load hero config on mount
  useEffect(() => {
    fetchHeroConfig().then(setHeroConfig);
  }, []);

  // Load anime thumbnails on mount and listen to updates
  useEffect(() => {
    fetchAnimeThumbnails().then((data) => {
      if (data && Object.keys(data).length > 0) {
        setAnimeThumbnails((prev) => ({ ...prev, ...data }));
      }
    });

    const handleThumbnailsUpdated = (e: any) => {
      if (e.detail) {
        setAnimeThumbnails(e.detail);
      }
    };
    window.addEventListener('anime_thumbnails_updated', handleThumbnailsUpdated);
    return () => window.removeEventListener('anime_thumbnails_updated', handleThumbnailsUpdated);
  }, []);

  // Load pinned products on mount and listen to updates
  useEffect(() => {
    fetchPinnedProductIds().then(setPinnedProductIds);

    const handlePinnedUpdated = (e: any) => {
      if (Array.isArray(e.detail)) {
        setPinnedProductIds(e.detail);
      } else {
        setPinnedProductIds(getCachedPinnedProductIds());
      }
    };
    window.addEventListener('pinned_products_updated', handlePinnedUpdated);
    return () => window.removeEventListener('pinned_products_updated', handlePinnedUpdated);
  }, []);

  const handleTogglePinProduct = async (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const existingProduct = products.find((p) => p.id === productId);
    const isCurrentlyPinned = isProductEffectivelyPinned(existingProduct, pinnedProductIds);
    const newStatus = !isCurrentlyPinned;

    const updated = newStatus
      ? Array.from(new Set([...pinnedProductIds, productId]))
      : pinnedProductIds.filter((id) => id !== productId);
    setPinnedProductIds(updated);

    if (existingProduct) {
      const updatedProd: Product = {
        ...existingProduct,
        is_pinned: newStatus,
        variant_config: {
          ...(existingProduct.variant_config || { enabledOptions: [], options: [] }),
          is_pinned: newStatus,
        } as any,
      };
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? updatedProd : p))
      );
      useCatalogStore.getState().updateProduct(updatedProd);
    }

    try {
      const res = await setProductPinStatus(productId, newStatus);
      if (res.ids) {
        setPinnedProductIds(res.ids);
      }
    } catch (err: any) {
      console.warn('Error toggling pin status:', err);
    }
  };

  const handleSaveHero = async () => {
    setSavingHero(true);
    try {
      const res = await saveHeroConfig(heroConfig);
      if (res.success) {
        alert('Hero Main Ad updated and synced to database successfully!');
      } else {
        alert('Hero Main Ad saved! (Notice: ' + (res.error || 'Saved to persistent storage') + ')');
      }
    } catch (err: any) {
      alert('Error saving hero config: ' + (err?.message || err));
    } finally {
      setSavingHero(false);
    }
  };

  const handleResetHero = async () => {
    if (!confirm('Are you sure you want to reset the Hero Main Ad to the default Ryōshin watch ad?')) return;
    setHeroConfig(DEFAULT_HERO_CONFIG);
    await saveHeroConfig(DEFAULT_HERO_CONFIG);
    alert('Hero Main Ad reset to default successfully!');
  };

  const handleEditAnimeSeries = (series: AnimeSeriesEntry) => {
    setEditingAnimeSeries(series);
    setAnimeForm({
      label: series.label,
      id: series.id,
      short: series.short,
      image_url: animeThumbnails[series.id] || series.image_url || '',
    });
    setIsAnimeModalOpen(true);
  };

  const [isSyncingSubcategories, setIsSyncingSubcategories] = useState(false);

  const handleSyncSubcategoriesToCloud = async () => {
    setIsSyncingSubcategories(true);
    try {
      const res = await syncAllAnimeSubcategoriesToCloud();
      if (res.dbSynced) {
        alert(`🎉 Sub-Categories Cloud Sync Successful!\n\n• ${res.totalThumbnails} franchise thumbnails pushed to database.\n• ${res.totalCustomSeries} custom anime series synchronized.\n• Status: Active across all devices and visitor sessions.`);
      } else {
        alert(`Sub-categories saved locally.\n\nDatabase notice: ${res.errorNotice || 'Check Supabase connection'}`);
      }
    } catch (err: any) {
      alert(`Sync error: ${err?.message || err}`);
    } finally {
      setIsSyncingSubcategories(false);
    }
  };

  const handleSaveAnimeSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animeForm.label.trim()) return;
    setSavingAnime(true);

    try {
      const slug = editingAnimeSeries
        ? editingAnimeSeries.id
        : animeForm.id.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') ||
          animeForm.label.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

      const shortCode =
        animeForm.short.trim().toUpperCase() ||
        (editingAnimeSeries?.short ?? animeForm.label.trim().slice(0, 3).toUpperCase());

      const imageUrl = animeForm.image_url.trim();
      let syncNotice = '';

      // 1. If editing an existing series
      if (editingAnimeSeries) {
        // Save thumbnail override
        if (imageUrl) {
          const res = await saveAnimeSeriesThumbnail(slug, imageUrl);
          setAnimeThumbnails((prev) => ({ ...prev, [slug]: imageUrl }));
          syncNotice = res.dbSynced
            ? 'Synced directly to database and visible across all devices.'
            : (res.error ? `Saved locally. (Cloud sync notice: ${res.error})` : 'Saved locally & cloud broadcast active.');
        }

        // If it's a custom series, update name/code in custom list
        const isCustom = customAnimeList.some((c) => c.id === slug);
        if (isCustom) {
          const updatedCustom = customAnimeList.map((c) =>
            c.id === slug
              ? {
                  ...c,
                  label: animeForm.label.trim(),
                  short: shortCode,
                  image_url: imageUrl,
                  aliases: Array.from(
                    new Set([
                      ...(c.aliases || []),
                      slug,
                      animeForm.label.trim().toLowerCase(),
                      shortCode.toLowerCase(),
                    ])
                  ),
                }
              : c
          );
          setCustomAnimeList(updatedCustom);
          localStorage.setItem('tryvoal_custom_anime_series', JSON.stringify(updatedCustom));
          const customRes = await saveCustomAnimeSeriesList(updatedCustom);
          if (customRes.dbSynced && !syncNotice) {
            syncNotice = 'Custom universe synced to database across all devices.';
          }
        }

        alert(`🎉 Sub-category "${animeForm.label.trim()}" thumbnail updated!\n\n• ${syncNotice || 'Updated successfully'}`);
      } else {
        // 2. Creating a new custom anime series
        const newEntry: AnimeSeriesEntry = {
          id: slug,
          label: animeForm.label.trim(),
          short: shortCode,
          aliases: [slug, animeForm.label.trim().toLowerCase(), shortCode.toLowerCase()],
          image_url: imageUrl,
        };

        const updated = [...customAnimeList.filter((a) => a.id !== slug), newEntry];
        setCustomAnimeList(updated);
        localStorage.setItem('tryvoal_custom_anime_series', JSON.stringify(updated));
        const customRes = await saveCustomAnimeSeriesList(updated);

        if (imageUrl) {
          const res = await saveAnimeSeriesThumbnail(slug, imageUrl);
          setAnimeThumbnails((prev) => ({ ...prev, [slug]: imageUrl }));
          syncNotice = res.dbSynced || customRes.dbSynced
            ? 'Synced directly to database across all devices.'
            : 'Saved locally & broadcast active.';
        }

        alert(`🎉 Anime sub-category "${newEntry.label}" added!\n\n• ${syncNotice || 'Saved and broadcast to all devices'}`);
      }

      setAnimeForm({ label: '', id: '', short: '', image_url: '' });
      setEditingAnimeSeries(null);
      setIsAnimeModalOpen(false);
    } catch (err: any) {
      alert(`Error saving sub-category: ${err?.message || err}`);
    } finally {
      setSavingAnime(false);
    }
  };

  const handleDeleteAnimeSeries = async (id: string) => {
    if (!confirm('Delete this custom anime sub-category?')) return;
    const updated = customAnimeList.filter(a => a.id !== id);
    setCustomAnimeList(updated);
    localStorage.setItem('tryvoal_custom_anime_series', JSON.stringify(updated));
    await saveCustomAnimeSeriesList(updated);
  };

  // Fetch / sync replacement requests from database
  const loadReplacementsData = useCallback(async () => {
    try {
      const { data: dbReplacements } = await supabase
        .from('replacement_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      setReplacementRequests(dbReplacements || []);
    } catch (err) {
      console.warn('Failed to fetch replacement requests from database:', err);
      setReplacementRequests([]);
    }
  }, []);

  // Dedicated background fetch for orders (100% resilient, zero UI blinking)
  const fetchOrdersList = useCallback(async (): Promise<Order[]> => {
    try {
      const parseShippingJson = (raw: any): Record<string, any> => {
        if (!raw) return {};
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
          } catch {
            return {};
          }
        }
        return typeof raw === 'object' && raw !== null ? raw : {};
      };

      let dbOrdersList: any[] = [];
      try {
        const { data: dbOrders, error: ordersErr } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!ordersErr && dbOrders && dbOrders.length > 0) {
          const orderIds = dbOrders.map((o: any) => o.id);

          const itemsByOrderId: Record<string, any[]> = {};
          try {
            const { data: dbItems, error: itemsErr } = await supabase
              .from('order_items')
              .select('*, product:products(*)')
              .in('order_id', orderIds);

            if (!itemsErr && dbItems) {
              for (const it of dbItems) {
                if (!itemsByOrderId[it.order_id]) itemsByOrderId[it.order_id] = [];
                itemsByOrderId[it.order_id].push(it);
              }
            }
          } catch (_) {}

          const proofsByOrderId: Record<string, any> = {};
          try {
            const { data: dbProofs } = await supabase
              .from('payment_proofs')
              .select('*')
              .in('order_id', orderIds);
            if (dbProofs) {
              for (const p of dbProofs) proofsByOrderId[p.order_id] = p;
            }
          } catch (_) {
            try {
              const { data: dbProofsSingular } = await supabase
                .from('payment_proof')
                .select('*')
                .in('order_id', orderIds);
              if (dbProofsSingular) {
                for (const p of dbProofsSingular) proofsByOrderId[p.order_id] = p;
              }
            } catch (_) {}
          }

          dbOrdersList = dbOrders.map((order: any) => {
            const separateItems = itemsByOrderId[order.id] || [];
            const rawAddr = parseShippingJson(order.shipping_address);
            const embeddedItems = rawAddr.items || rawAddr.cart_items || [];
            const itemVariants = rawAddr.item_variants || [];

            const resolvedItems = separateItems.length > 0
              ? separateItems.map((item: any) => {
                  const matchedVariant = itemVariants.find((iv: any) => iv.product_id === item.product_id);
                  return {
                    ...item,
                    selected_variant: item.selected_variant || matchedVariant?.selected_variant || null,
                    product: item.product || {
                      name: item.product_name || 'Anime Apparel Item',
                      main_image_url: item.image_url || '/placeholder.jpg',
                      price: item.price || 0,
                      sku: item.sku || null,
                    }
                  };
                })
              : embeddedItems.map((emb: any, idx: number) => ({
                  id: emb.id || `emb-${order.id}-${idx}`,
                  order_id: order.id,
                  product_id: emb.product_id || emb.product?.id,
                  product_name: emb.product_name || emb.product?.name || 'Anime Apparel Item',
                  quantity: emb.quantity || 1,
                  price: emb.price || emb.variantPrice || emb.product?.price || 0,
                  selected_variant: emb.selected_variant || emb.selectedVariant || null,
                  selected_variant_id: emb.selected_variant_id || emb.selectedVariantId || null,
                  selected_attributes: emb.selected_attributes || emb.selectedAttributes || {},
                  image_url: emb.image_url || emb.product?.main_image_url || '/placeholder.jpg',
                  product: emb.product || {
                    id: emb.product_id,
                    name: emb.product_name || emb.product?.name || 'Anime Apparel Item',
                    main_image_url: emb.image_url || emb.product?.main_image_url || '/placeholder.jpg',
                    price: emb.price || 0,
                    sku: emb.sku || null,
                  }
                }));

            const proof = proofsByOrderId[order.id] || (Array.isArray(order.payment_proof) ? order.payment_proof[0] : order.payment_proof) || null;

            return {
              ...order,
              shipping_address: rawAddr,
              payment_proof: proof,
              items: resolvedItems
            };
          });
        }
      } catch (dbErr) {
        console.warn('Could not fetch DB orders:', dbErr);
      }

      // Read local offline/resilience orders across all known storage keys
      const localOrderKeys = ['tryvoal_local_orders', 'animemaze_local_orders', 'elitebath_local_orders'];
      const rawLocalOrders: any[] = [];
      for (const k of localOrderKeys) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const lo of parsed) {
                if (lo && (lo.id || lo.order_ref)) {
                  rawLocalOrders.push(lo);
                }
              }
            }
          }
        } catch (_) {}
      }

      // Combine both sources and deduplicate with an advanced multi-factor key
      const combinedPool = [...dbOrdersList, ...rawLocalOrders];
      const mergedOrdersMap = new Map<string, any>();

      for (const rawOrder of combinedPool) {
        if (!rawOrder) continue;
        const shipping = parseShippingJson(rawOrder.shipping_address);
        const orderRef = rawOrder.order_ref || shipping.order_ref || '';
        const paymentRef = rawOrder.payment_id || shipping.paymentId || shipping.transactionId || '';
        const orderId = String(rawOrder.id || '');

        // Determine unique deduplication key: order_ref > paymentRef > orderId
        const dedupeKey = orderRef
          ? `ref:${orderRef}`
          : paymentRef
          ? `pay:${paymentRef}`
          : `id:${orderId}`;

        const existing = mergedOrdersMap.get(dedupeKey);

        const currentItems = (rawOrder.items && rawOrder.items.length > 0)
          ? rawOrder.items
          : (shipping.items && shipping.items.length > 0)
          ? shipping.items
          : [];

        const normalizedItems = currentItems.map((it: any) => ({
          ...it,
          product: it.product || {
            name: it.product_name || 'Anime Apparel Item',
            main_image_url: it.image_url || '/placeholder.jpg',
            sku: it.sku || (it.selected_variant_id ? `TYV-${it.selected_variant_id.slice(0, 8).toUpperCase()}` : null),
            price: it.price || 0
          }
        }));

        const normalizedOrder = {
          ...rawOrder,
          shipping_address: shipping,
          items: normalizedItems,
          order_ref: orderRef || existing?.order_ref || orderId,
        };

        if (!existing) {
          mergedOrdersMap.set(dedupeKey, normalizedOrder);
        } else {
          // Merge: Prefer PAID over PENDING_PAYMENT, prefer Supabase UUID over local temporary ID, prefer non-empty items
          const isPaid = normalizedOrder.status === 'PAID' || normalizedOrder.payment_status === 'PAID';
          const existingIsPaid = existing.status === 'PAID' || existing.payment_status === 'PAID';
          const hasUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);

          const merged = {
            ...existing,
            ...(isPaid || !existingIsPaid ? normalizedOrder : {}),
            id: hasUuid ? orderId : existing.id,
            status: isPaid ? 'PAID' : (existing.status || normalizedOrder.status),
            payment_status: isPaid ? 'PAID' : (existing.payment_status || normalizedOrder.payment_status),
            items: normalizedItems.length > 0 ? normalizedItems : existing.items,
            shipping_address: Object.keys(shipping).length > 2 ? shipping : existing.shipping_address,
            created_at: existing.created_at || normalizedOrder.created_at,
          };
          mergedOrdersMap.set(dedupeKey, merged);
        }
      }

      // Secondary deduplication pass: catch any duplicate rows sharing same phone, amount, and ~5-min window
      const finalUniqueOrders: any[] = [];
      const seenSignatures = new Set<string>();

      for (const ord of mergedOrdersMap.values()) {
        const addr = ord.shipping_address || {};
        const phone = (addr.phone || '').trim().replace(/[^0-9]/g, '');
        const amount = Math.round(Number(ord.total_amount) || 0);
        const timeBucket = ord.created_at ? Math.floor(new Date(ord.created_at).getTime() / (1000 * 60 * 5)) : 0;

        const fuzzySignature = phone && amount > 0 && timeBucket > 0
          ? `${phone}-${amount}-${timeBucket}`
          : null;

        if (fuzzySignature && seenSignatures.has(fuzzySignature)) {
          continue;
        }

        if (fuzzySignature) {
          seenSignatures.add(fuzzySignature);
        }

        finalUniqueOrders.push(ord);
      }

      return finalUniqueOrders.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeB - timeA;
      }) as Order[];
    } catch {
      return [];
    }
  }, []);

  // Load Data
  const loadAdminData = async (silentParam?: boolean | unknown) => {
    const isSilent = silentParam === true;
    if (!isSilent) setLoadingData(true);

    try {
      // 1. Fetch categories
      try {
        const { data: dbCats } = await supabase.from('categories').select('*').order('name');
        const deletedCatIds: string[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_deleted_category_ids') || '[]')
          : [];
        const customCats: Category[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_custom_categories') || '[]')
          : [];
        const mergedCats: Category[] = [];
        if (dbCats && dbCats.length > 0) {
          for (const rawCat of dbCats) {
            if (deletedCatIds.includes(rawCat.id)) continue;
            const customOverride = customCats.find(
              (lc) => lc.id === rawCat.id || lc.name.toLowerCase() === rawCat.name.toLowerCase()
            );
            const fb = FALLBACK_CATEGORIES.find(f => f.id === rawCat.id || f.name.toLowerCase() === rawCat.name.toLowerCase());
            const c: Category = {
              ...rawCat,
              ...(customOverride || {}),
              image_url: customOverride?.image_url || rawCat.image_url || fb?.image_url || '',
            };
            if (!mergedCats.some((m) => m.id === c.id || m.name.toLowerCase() === c.name.toLowerCase())) {
              mergedCats.push(c);
            }
          }
        }
        for (const c of customCats) {
          if (deletedCatIds.includes(c.id)) continue;
          const existingIdx = mergedCats.findIndex((m) => m.id === c.id || m.name.toLowerCase() === c.name.toLowerCase());
          if (existingIdx >= 0) {
            mergedCats[existingIdx] = { ...mergedCats[existingIdx], ...c };
          } else {
            mergedCats.push(c);
          }
        }
        for (const fb of FALLBACK_CATEGORIES) {
          if (deletedCatIds.includes(fb.id)) continue;
          const customOverride = customCats.find(
            (lc) => lc.id === fb.id || lc.name.toLowerCase() === fb.name.toLowerCase()
          );
          if (!mergedCats.some((m) => m.id === fb.id || m.name.toLowerCase() === fb.name.toLowerCase())) {
            mergedCats.push(customOverride ? { ...fb, ...customOverride } : fb);
          }
        }
        setCategories(mergedCats);
      } catch (err) {
        console.error('Error loading categories:', err);
        const deletedCatIds: string[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_deleted_category_ids') || '[]')
          : [];
        const customCats: Category[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_custom_categories') || '[]')
          : [];
        const mergedCats = [...customCats.filter((c) => !deletedCatIds.includes(c.id))];
        for (const fb of FALLBACK_CATEGORIES) {
          if (deletedCatIds.includes(fb.id)) continue;
          const customOverride = customCats.find(
            (lc) => lc.id === fb.id || lc.name.toLowerCase() === fb.name.toLowerCase()
          );
          if (!mergedCats.some((m) => m.id === fb.id || m.name.toLowerCase() === fb.name.toLowerCase())) {
            mergedCats.push(customOverride ? { ...fb, ...customOverride } : fb);
          }
        }
        setCategories(mergedCats);
      }

      // 2. Fetch products with variants
      try {
        const { data: dbProds, error: prodErr } = await supabase
          .from('products')
          .select('*, category:categories(*), variants:product_variants(*)')
          .order('created_at', { ascending: false });

        if (prodErr) throw prodErr;
        setDbWarning(null);

        const deletedProdIds: string[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_deleted_product_ids') || '[]')
          : [];

        const customProds: Product[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_custom_products') || '[]')
          : [];
        const mergedProds: Product[] = customProds.filter((p) => !deletedProdIds.includes(p.id));

        if (dbProds && dbProds.length > 0) {
          const parsedProds = dbProds.map((p: any) => ({
            ...p,
            price: Number(p.price),
            slug: sanitizeSlug(p.slug, p.name)
          }));
          for (const p of parsedProds) {
            if (!deletedProdIds.includes(p.id) && !mergedProds.some((m) => m.id === p.id || m.slug === p.slug)) {
              mergedProds.push(p);
            }
          }
        }
        setProducts(mergedProds);
      } catch (err: any) {
        console.error('Error loading products from Supabase:', err);
        setDbWarning(err?.message || 'Failed to reach Supabase database. Working in local storage mode.');
        const deletedProdIds: string[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_deleted_product_ids') || '[]')
          : [];
        const customProds: Product[] = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('elitebath_custom_products') || '[]')
          : [];
        const mergedProds: Product[] = customProds.filter((p) => !deletedProdIds.includes(p.id));
        setProducts(mergedProds);
      }

      // 3. Fetch orders (merge Supabase DB orders with local resilience orders)
      try {
        const freshOrders = await fetchOrdersList();
        setOrders(freshOrders);
      } catch (err) {
        console.error('Error loading orders:', err);
      }

      // 4. Fetch questions (DB + local resilient store)
      try {
        let allQuestions: ProductQuestion[] = [];
        try {
          const { data: dbQuestions, error: qnaError } = await supabase
            .from('product_questions')
            .select('*')
            .order('created_at', { ascending: false });
          if (!qnaError && dbQuestions) {
            allQuestions = dbQuestions as ProductQuestion[];
          }
        } catch (dbQErr) {
          console.warn('Error loading questions from DB:', dbQErr);
        }

        try {
          const rawLocalQ = localStorage.getItem('elitebath_product_questions');
          if (rawLocalQ) {
            const parsedLocal: ProductQuestion[] = JSON.parse(rawLocalQ);
            const dbIds = new Set(allQuestions.map((q) => q.id));
            for (const lq of parsedLocal) {
              if (!dbIds.has(lq.id)) {
                allQuestions.push(lq);
              } else {
                // If local has answer that DB doesn't have yet, sync it
                const match = allQuestions.find((q) => q.id === lq.id);
                if (match && !match.answer && lq.answer) {
                  match.answer = lq.answer;
                }
              }
            }
          }
        } catch (_) {}

        setQuestions(allQuestions);
      } catch (err) {
        console.error('Error loading questions:', err);
        setQuestions([]);
      }

      // 5. Fetch reviews with multi-channel cross-device sync
      try {
        const allReviews = await fetchReviewsMultiChannel();
        setReviews(allReviews);
      } catch (err) {
        console.error('Error loading reviews:', err);
        setReviews([]);
      }

      // 5b. Sync anime subcategories & thumbnails from database for cross-device consistency
      try {
        const syncedThumbs = await fetchAnimeThumbnails();
        if (syncedThumbs && Object.keys(syncedThumbs).length > 0) {
          setAnimeThumbnails(syncedThumbs);
        }
        const syncedCustom = await fetchCustomAnimeSeriesFromDB();
        if (syncedCustom && syncedCustom.length > 0) {
          setCustomAnimeList(syncedCustom);
        }
      } catch (e) {
        console.warn('Anime series & thumbnails sync warning:', e);
      }

      // 6. Fetch subscribers
      try {
        const { data: dbSubs } = await supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
        if (dbSubs) setSubscribers(dbSubs as NewsletterSubscriber[]);
      } catch (err) {
        console.error('Error loading subscribers:', err);
      }

      // 7. Fetch replacement requests
      await loadReplacementsData();

      // Load coupons
      loadCoupons();

      // Load announcement
      loadAnnouncement();

    } catch (err) {
      console.error('Error loading admin dashboard details:', err);
    } finally {
      if (silentParam !== true) setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      loadAdminData();
    }
  }, [user, profile]);

  // Auto-refresh replacement requests when on the replacements tab
  useEffect(() => {
    if (activeTab !== 'replacements') return;
    loadReplacementsData(); // immediate refresh on tab switch
    const interval = setInterval(loadReplacementsData, 3000);
    return () => clearInterval(interval);
  }, [activeTab, loadReplacementsData]);

  // Non-intrusive auto-refresh for orders: completely silent without blinking or full-page spinners
  useEffect(() => {
    const handleStorageChange = () => {
      fetchOrdersList().then((fresh) => {
        if (fresh && fresh.length > 0) {
          setOrders((prev) => {
            const prevIds = prev.map((o) => o.id + (o.status || '')).join(',');
            const freshIds = fresh.map((o) => o.id + (o.status || '')).join(',');
            return prevIds !== freshIds ? fresh : prev;
          });
        }
      });
    };
    window.addEventListener('storage', handleStorageChange);

    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeTab === 'orders' || activeTab === 'verification') {
      interval = setInterval(() => {
        fetchOrdersList().then((fresh) => {
          if (fresh && fresh.length > 0) {
            setOrders((prev) => {
              const prevIds = prev.map((o) => o.id + (o.status || '')).join(',');
              const freshIds = fresh.map((o) => o.id + (o.status || '')).join(',');
              // Skip update if identical to eliminate re-renders completely
              return prevIds !== freshIds ? fresh : prev;
            });
          }
        });
      }, 10000);
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (interval) clearInterval(interval);
    };
  }, [activeTab, fetchOrdersList]);


  // --- CRUD: Products ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    if (submittingProduct) return;
    e.preventDefault();
    setSubmittingProduct(true);
    try {
      const addImgs = productForm.additional_images
        ? productForm.additional_images.split(',').map(img => img.trim()).filter(Boolean)
        : [];

      // Always sanitize slug: strip URLs and special chars
      const rawSlug = productForm.slug.trim();
      const isValidSlug = rawSlug && !rawSlug.includes('://') && !rawSlug.includes('.com') && /^[a-z0-9-]+$/.test(rawSlug.toLowerCase());
      const finalSlug = isValidSlug
        ? rawSlug.toLowerCase()
        : productForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const activeVariants = variantDrafts.filter(v => Object.keys(v.attributes).length > 0);
      const shouldHaveVariants = hasVariants && activeVariants.length > 0;

      const variantConfigData: any = shouldHaveVariants ? {
        enabledOptions: optionDrafts.filter(o => o.values.length > 0).map(o => o.id),
        options: optionDrafts.filter(o => o.values.length > 0).map(o => ({
          id: o.id,
          name: o.name,
          type: o.type,
          required: o.required,
          values: o.type === 'color' ? o.values : o.values.map(v => v.label)
        })),
        is_pinned: Boolean(productForm.is_pinned),
      } : { enabledOptions: [], options: [], is_pinned: Boolean(productForm.is_pinned) };

      // Calculate total stock and display price from variants if has variants
      let finalPrice = Number(productForm.price);
      let finalStock = Number(productForm.stock);
      if (shouldHaveVariants) {
        const activeOnly = activeVariants.filter(v => v.active);
        // If admin changed base price in the form, sync variants that matched the old price
        if (editingProduct && Number(productForm.price) !== editingProduct.price && Number(productForm.price) > 0) {
          const newPrice = Number(productForm.price);
          const allWereOldPrice = activeOnly.every(v => v.price === editingProduct.price || v.price === 0);
          if (allWereOldPrice) {
            activeVariants.forEach(v => { v.price = newPrice; });
          }
        }
        if (activeOnly.length > 0) {
          finalPrice = Math.min(...activeOnly.map(v => v.price));
          finalStock = activeOnly.reduce((sum, v) => sum + v.stock, 0);
        }
      }

      // Ensure category_id is a valid UUID that actually exists in Supabase categories table
      let validCategoryId: string | null = null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (productForm.category_id) {
        // 1. If it's a UUID, check if it actually exists in Supabase
        if (uuidRegex.test(productForm.category_id)) {
          try {
            const { data: catById } = await supabase
              .from('categories')
              .select('id')
              .eq('id', productForm.category_id)
              .maybeSingle();
            if (catById?.id) {
              validCategoryId = catById.id;
            }
          } catch {
            validCategoryId = null;
          }
        }

        // 2. If not found by ID, try finding or creating by category name
        if (!validCategoryId) {
          const matched = categories.find((c) => c.id === productForm.category_id);
          const nameToFind = matched?.name || productForm.category_id;
          try {
            const { data: dbCat } = await supabase
              .from('categories')
              .select('id')
              .ilike('name', nameToFind)
              .maybeSingle();
            if (dbCat?.id) {
              validCategoryId = dbCat.id;
            } else if (matched?.name) {
              // Auto-create category in Supabase so FK constraint passes
              const { data: newCat } = await supabase
                .from('categories')
                .insert([{
                  name: matched.name,
                  image_url: matched.image_url || '',
                  size_enabled: Boolean(matched.size_enabled)
                }])
                .select('id')
                .maybeSingle();
              if (newCat?.id) {
                validCategoryId = newCat.id;
              }
            }
          } catch {
            validCategoryId = null;
          }
        }
      }

      const payload: any = {
        name: productForm.name.trim(),
        slug: finalSlug,
        description: productForm.description.trim(),
        price: finalPrice,
        stock: finalStock,
        featured: Boolean(productForm.featured),
        category_id: validCategoryId,
        main_image_url: productForm.main_image_url.trim(),
        additional_images: addImgs,
        sku: productForm.sku.trim() || null,
        brand: productForm.brand.trim() || 'TRYVOAL',
        material: productForm.material.trim() || null,
        finish: productForm.finish.trim() || null,
        warranty_info: productForm.warranty_info.trim() || null,
        has_variants: shouldHaveVariants,
        variant_config: variantConfigData,
        is_new_arrival: Boolean(productForm.is_new_arrival),
        is_active: Boolean(productForm.is_active),
        shipping_fee: Number(productForm.shipping_fee) || 0,
      };

      let targetId = editingProduct ? editingProduct.id : '';
      let dbSaveError: string | null = null;

      try {
        if (editingProduct) {
          let { error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', editingProduct.id);
          
          // If FK constraint fails on category_id, auto-retry with null category_id to ensure price and core product data always save!
          if (error && (error.message?.includes('products_category_id_fkey') || (error as any).code === '23503')) {
            console.warn('Retrying product update with category_id = null due to FK constraint:', error.message);
            payload.category_id = null;
            const retryRes = await supabase
              .from('products')
              .update(payload)
              .eq('id', editingProduct.id);
            error = retryRes.error;
          }

          if (error) throw error;
        } else {
          let { data: newProd, error } = await supabase
            .from('products')
            .insert(payload)
            .select('id')
            .single();
          
          // If FK constraint fails on category_id, auto-retry with null category_id
          if (error && (error.message?.includes('products_category_id_fkey') || (error as any).code === '23503')) {
            console.warn('Retrying product insert with category_id = null due to FK constraint:', error.message);
            payload.category_id = null;
            const retryRes = await supabase
              .from('products')
              .insert(payload)
              .select('id')
              .single();
            newProd = retryRes.data;
            error = retryRes.error;
          }

          if (error) throw error;
          targetId = newProd?.id || '';
        }

        // Sync variants in public.product_variants
        if (targetId) {
          await supabase.from('product_variants').delete().eq('product_id', targetId);
          if (shouldHaveVariants) {
            const rows = activeVariants.map((v) => ({
              product_id: targetId,
              sku: v.sku.trim() || null,
              price: Number(v.price),
              stock: Number(v.stock),
              image_url: v.image_url?.trim() || null,
              attributes: v.attributes,
              active: v.active !== false,
            }));
            const { error: varErr } = await supabase.from('product_variants').insert(rows);
            if (varErr) throw varErr;
          }
        }
      } catch (dbErr: any) {
        dbSaveError = dbErr?.message || String(dbErr);
        console.warn('Supabase DB save error, applying local state update:', dbErr);
      }

      // Update local state in Admin
      const updatedProductObj: Product = {
        id: targetId || (editingProduct ? editingProduct.id : `prod-local-${Date.now()}`),
        ...payload,
        is_pinned: Boolean(productForm.is_pinned),
        category: categories.find(c => c.id === payload.category_id),
        variants: shouldHaveVariants ? activeVariants.map((v, i) => ({
          id: v.id || `var-${Date.now()}-${i}`,
          product_id: targetId || 'local',
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          image_url: v.image_url || null,
          attributes: v.attributes,
          active: v.active,
        })) : undefined,
        created_at: editingProduct ? editingProduct.created_at : new Date().toISOString()
      };

      if (productForm.is_pinned !== undefined) {
        await setProductPinStatus(updatedProductObj.id, Boolean(productForm.is_pinned));
      }

      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProductObj : p));
        useCatalogStore.getState().updateProduct(updatedProductObj);
      } else {
        setProducts(prev => [updatedProductObj, ...prev]);
        useCatalogStore.getState().addProduct(updatedProductObj);
      }

      void useCatalogStore.getState().fetchProducts(true);
      void loadAdminData();

      if (dbSaveError) {
        alert(
          `⚠️ Product saved LOCALLY on this browser only!\n\nDatabase sync failed: ${dbSaveError}\n\nNote: Because the database connection or table write failed, this product is stored in your laptop's local cache and will NOT appear on mobile or other devices until your Supabase project is active and connected.`
        );
      } else {
        alert(editingProduct ? 'Product updated successfully in cloud database!' : 'Product created and synced to cloud database successfully!');
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Product action failed.');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      slug: prod.slug,
      description: prod.description || '',
      price: prod.price,
      stock: prod.stock,
      featured: prod.featured,
      category_id: prod.category_id || '',
      main_image_url: prod.main_image_url,
      additional_images: Array.isArray(prod.additional_images) ? prod.additional_images.join(', ') : '',
      sku: prod.sku || '',
      brand: prod.brand || 'TRYVOAL',
      material: prod.material || '',
      finish: prod.finish || '',
      warranty_info: prod.warranty_info || '',
      is_new_arrival: Boolean(prod.is_new_arrival),
      is_active: prod.is_active !== false,
      is_pinned: Boolean(prod.is_pinned || (prod.variant_config as any)?.is_pinned || pinnedProductIds.includes(prod.id)),
      shipping_fee: prod.shipping_fee ?? 0,
    });

    setHasVariants(Boolean(prod.has_variants));

    if (prod.variant_config?.options && prod.variant_config.options.length > 0) {
      setOptionDrafts(prod.variant_config.options.map((opt) => ({
        id: opt.id,
        name: opt.name,
        type: opt.type || (opt.id === 'color' ? 'color' : 'button'),
        required: opt.required !== false,
        values: opt.values.map((v) => {
          if (typeof v === 'string') {
            return { id: v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), label: v };
          }
          return { id: v.id, label: v.label, colorHex: v.colorHex };
        })
      })));
    } else {
      setOptionDrafts([]);
    }

    if (prod.variants && prod.variants.length > 0) {
      setVariantDrafts(prod.variants.map((v) => ({
        id: v.id,
        sku: v.sku || '',
        price: v.price,
        stock: v.stock,
        image_url: v.image_url || '',
        attributes: v.attributes || {},
        active: v.active !== false
      })));
    } else {
      setVariantDrafts([]);
    }

    setIsProductModalOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    const prodToDelete = products.find(p => p.id === id);
    const prodName = prodToDelete?.name || 'this product';
    if (!window.confirm(`Are you sure you want to delete "${prodName}"?\n\nThis will permanently delete the product and its uploaded images.`)) return;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      // 1. Delete associated product images from Supabase Storage
      if (prodToDelete) {
        try {
          await deleteProductImagesFromStorage(prodToDelete);
        } catch (imgErr) {
          console.warn('Storage image cleanup warning:', imgErr);
        }
      }

      // 2. Delete variants & product from Supabase DB ONLY if id is a valid UUID
      let dbDeleteWarning: string | null = null;
      if (isUuid) {
        try {
          await supabase.from('product_variants').delete().eq('product_id', id);
        } catch (varErr) {
          console.warn('Variants delete warning:', varErr);
        }

        try {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) throw error;
        } catch (dbErr: any) {
          dbDeleteWarning = dbErr?.message || String(dbErr);
          console.warn('Supabase product delete warning:', dbErr);
        }
      }

      // 3. Remove from catalog store and local state & persist to deleted products registry
      useCatalogStore.getState().deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      void useCatalogStore.getState().fetchProducts(true);

      if (dbDeleteWarning) {
        alert(`⚠️ Product removed from view, but database returned: ${dbDeleteWarning}.\nPlease verify the delete policy in Supabase SQL Editor.`);
      } else {
        alert('Product deleted successfully!');
      }
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product: ' + (err.message || err));
    }
  };

  // --- CRUD: Categories ---
  // --- CRUD: Categories ---
  const handleCategorySubmit = async (e: React.FormEvent) => {
    if (submittingCategory) return;
    e.preventDefault();
    setSubmittingCategory(true);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        image_url: categoryForm.image_url.trim(),
        size_enabled: categoryForm.size_enabled,
      };

      let targetCatId = editingCategory ? editingCategory.id : '';
      let dbCatError: string | null = null;
      let dbSynced = false;

      try {
        if (editingCategory) {
          // 1. Try update by id first (if valid UUID)
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingCategory.id);
          let updated = false;

          if (isUuid) {
            const { data: idUpdate, error: idErr } = await supabase
              .from('categories')
              .update(payload)
              .eq('id', editingCategory.id)
              .select('id');
            if (!idErr && idUpdate && idUpdate.length > 0) {
              targetCatId = idUpdate[0].id;
              dbSynced = true;
              updated = true;
            }
          }

          // 2. If not updated by id, try update by name
          if (!updated) {
            const { data: nameUpdate, error: nameErr } = await supabase
              .from('categories')
              .update(payload)
              .ilike('name', categoryForm.name.trim())
              .select('id');
            if (!nameErr && nameUpdate && nameUpdate.length > 0) {
              targetCatId = nameUpdate[0].id;
              dbSynced = true;
              updated = true;
            }
          }

          // 3. If still not in DB, insert it
          if (!updated) {
            const insertRecord: any = {
              name: categoryForm.name.trim(),
              image_url: categoryForm.image_url.trim(),
              size_enabled: categoryForm.size_enabled,
            };
            if (isUuid) {
              insertRecord.id = editingCategory.id;
            }
            const { data: insData, error: insErr } = await supabase
              .from('categories')
              .insert([insertRecord])
              .select('id');
            
            if (!insErr && insData && insData.length > 0) {
              targetCatId = insData[0].id;
              dbSynced = true;
            } else if (insErr) {
              // Try without id if id was rejected
              const { data: retryData, error: retryErr } = await supabase
                .from('categories')
                .insert([{
                  name: categoryForm.name.trim(),
                  image_url: categoryForm.image_url.trim(),
                  size_enabled: categoryForm.size_enabled,
                }])
                .select('id');
              if (!retryErr && retryData && retryData.length > 0) {
                targetCatId = retryData[0].id;
                dbSynced = true;
              } else if (retryErr) {
                throw retryErr;
              }
            }
          }
        } else {
          // Creating new category: check if one already exists by name first
          const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', categoryForm.name.trim())
            .maybeSingle();

          if (existing?.id) {
            const { error: updErr } = await supabase
              .from('categories')
              .update(payload)
              .eq('id', existing.id);
            if (updErr) throw updErr;
            targetCatId = existing.id;
            dbSynced = true;
          } else {
            const { data: newCat, error: insErr } = await supabase
              .from('categories')
              .insert([payload])
              .select('id')
              .single();
            if (insErr) throw insErr;
            if (newCat?.id) {
              targetCatId = newCat.id;
              dbSynced = true;
            }
          }
        }
      } catch (dbErr: any) {
        dbCatError = dbErr?.message || String(dbErr);
        console.warn('Supabase category save error, saving to local persistent store:', dbErr);
      }

      const newCategoryObj: Category = {
        id: targetCatId || (editingCategory ? editingCategory.id : `cat-local-${Date.now()}`),
        name: categoryForm.name.trim(),
        image_url: categoryForm.image_url.trim(),
        size_enabled: categoryForm.size_enabled,
        created_at: editingCategory ? editingCategory.created_at : new Date().toISOString()
      };

      // 1. Immediately update localStorage
      if (typeof window !== 'undefined') {
        const deletedCatIds: string[] = JSON.parse(localStorage.getItem('elitebath_deleted_category_ids') || '[]');
        if (deletedCatIds.includes(newCategoryObj.id)) {
          localStorage.setItem(
            'elitebath_deleted_category_ids',
            JSON.stringify(deletedCatIds.filter((id) => id !== newCategoryObj.id))
          );
        }

        const custom: Category[] = JSON.parse(localStorage.getItem('elitebath_custom_categories') || '[]');
        const idx = custom.findIndex(
          (c: any) => c.id === newCategoryObj.id || c.name.toLowerCase() === newCategoryObj.name.toLowerCase()
        );
        if (idx >= 0) {
          custom[idx] = { ...custom[idx], ...newCategoryObj };
        } else {
          custom.push(newCategoryObj);
        }
        localStorage.setItem('elitebath_custom_categories', JSON.stringify(custom));
        localStorage.setItem('tryvoal_custom_categories', JSON.stringify(custom));
        window.dispatchEvent(new Event('category_updated'));
      }

      // 2. Immediately update Admin component state
      setCategories((prev) => {
        const idx = prev.findIndex(
          (c) => c.id === newCategoryObj.id || c.name.toLowerCase() === newCategoryObj.name.toLowerCase()
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...newCategoryObj };
          return copy;
        }
        return [newCategoryObj, ...prev];
      });

      // 3. Immediately update Zustand catalog store
      if (editingCategory) {
        useCatalogStore.getState().updateCategory(newCategoryObj);
      } else {
        useCatalogStore.getState().addCategory(newCategoryObj);
      }

      if (dbSynced) {
        alert(editingCategory ? 'Category updated and synced to database successfully!' : 'Category created and synced to database successfully!');
      } else if (dbCatError) {
        alert(
          `⚠️ Category saved LOCALLY on this browser!\n\nNotice: ${dbCatError}\n\nNote: Changes render immediately on this device.`
        );
      } else {
        alert('Category updated and saved successfully!');
      }

      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      void loadAdminData();
      void useCatalogStore.getState().fetchCategories(true);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Category action failed.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      image_url: cat.image_url,
      size_enabled: cat.size_enabled || false
    });
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this category? (Products inside will set category to null)')) return;
    try {
      try {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
      } catch (dbErr) {
        console.warn('Supabase category delete warning:', dbErr);
      }
      useCatalogStore.getState().deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      alert('Category deleted successfully!');
      void loadAdminData();
      void useCatalogStore.getState().fetchCategories(true);
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category: ' + (err.message || err));
    }
  };

  // --- Actions: Update Order Status ---
  const performOrderStatusUpdate = async (
    orderId: string,
    status: string,
    trackingInfo?: { carrier: string; tracking_number: string; shipped_at: string }
  ) => {
    // 1. Immediately update React state for instant UI responsiveness
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const currentShipping = (o.shipping_address as any) || {};
        const updatedShipping = {
          ...currentShipping,
          ...(trackingInfo ? { tracking_info: trackingInfo } : {}),
        };
        return {
          ...o,
          status: status as any,
          shipping_address: updatedShipping,
        };
      })
    );

    // 2. Persist to localStorage for reliable offline / local orders
    try {
      const raw =
        localStorage.getItem('elitebath_local_orders') ||
        localStorage.getItem('animemaze_local_orders') ||
        '[]';
      const localList = JSON.parse(raw);
      let found = false;
      const updatedLocal = localList.map((lo: any) => {
        if (lo.id === orderId) {
          found = true;
          return {
            ...lo,
            status,
            shipping_address: {
              ...(lo.shipping_address || {}),
              ...(trackingInfo ? { tracking_info: trackingInfo } : {}),
            },
          };
        }
        return lo;
      });
      if (found) {
        localStorage.setItem('elitebath_local_orders', JSON.stringify(updatedLocal));
        localStorage.setItem('animemaze_local_orders', JSON.stringify(updatedLocal));
      }
    } catch (e) {
      console.warn('Could not update local storage order:', e);
    }

    // 3. Sync to Supabase database
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('shipping_address')
        .eq('id', orderId)
        .maybeSingle();

      if (orderData) {
        const currentShipping = orderData?.shipping_address || {};
        const updatedShipping = {
          ...currentShipping,
          ...(trackingInfo ? { tracking_info: trackingInfo } : {}),
        };

        const { error } = await supabase
          .from('orders')
          .update({
            status,
            shipping_address: updatedShipping,
          })
          .eq('id', orderId);

        if (error) console.warn('Supabase order status sync warning:', error);
      }
      alert(`Order status updated to ${status}!`);
    } catch (err: any) {
      console.warn('Order status sync warning (offline):', err);
      alert(`Order status updated to ${status}!`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    if (status === 'SHIPPED' || status === 'OUT_FOR_DELIVERY') {
      const order = orders.find((o) => o.id === orderId);
      const tracking = (order?.shipping_address as any)?.tracking_info || {};
      setTrackingOrderId(orderId);
      setTrackingCarrier(tracking.carrier || 'Delhivery Express');
      setTrackingNumber(tracking.tracking_number || '');
      setTrackingTargetStatus(status);
      setIsTrackingModalOpen(true);
      return;
    }
    await performOrderStatusUpdate(orderId, status);
  };

  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingCarrier.trim() || !trackingNumber.trim()) {
      alert('Please fill in both carrier and tracking number.');
      return;
    }
    const trackingInfo = {
      carrier: trackingCarrier.trim(),
      tracking_number: trackingNumber.trim(),
      shipped_at: new Date().toISOString(),
    };
    setIsTrackingModalOpen(false);
    await performOrderStatusUpdate(
      trackingOrderId,
      trackingTargetStatus || 'SHIPPED',
      trackingInfo
    );
  };

  // --- Qikink POD Open API Dispatch ---
  const handleDispatchQikink = async (order: Order) => {
    setDispatchingQikinkId(order.id);
    try {
      const res = await dispatchOrderToQikink(order);
      if (res.success) {
        alert(
          `✅ Dispatched to Qikink (${getQikinkConfig().environment.toUpperCase()})!\n\n` +
          `Qikink Order ID: ${res.qikink_order_id}\n` +
          `AWB / Tracking: ${res.awb_number || 'Generated'}\n` +
          `Courier: ${res.courier_name || 'Standard Courier'}\n\n` +
          `${res.message || ''}`
        );

        const currentShipping = (order.shipping_address as any) || {};
        const qikinkInfo = {
          order_id: res.qikink_order_id || `QK-${Date.now()}`,
          status: res.status || 'QUEUED_SANDBOX',
          awb_number: res.awb_number,
          courier_name: res.courier_name,
          tracking_url: res.tracking_url,
          dispatched_at: new Date().toISOString(),
          environment: getQikinkConfig().environment
        };
        const trackingInfo = res.awb_number ? {
          carrier: res.courier_name || 'Qikink Logistics',
          tracking_number: res.awb_number,
          shipped_at: new Date().toISOString()
        } : currentShipping.tracking_info;

        // Update local React state
        setOrders((prev) => prev.map((o) => {
          if (o.id !== order.id) return o;
          return {
            ...o,
            status: 'PROCESSING' as any,
            shipping_address: {
              ...currentShipping,
              qikink_info: qikinkInfo,
              ...(trackingInfo ? { tracking_info: trackingInfo } : {})
            }
          };
        }));

        // Persist to local resilient storage
        try {
          const raw = localStorage.getItem('elitebath_local_orders') || localStorage.getItem('animemaze_local_orders') || '[]';
          const localList = JSON.parse(raw);
          const updated = localList.map((lo: any) => {
            if (lo.id === order.id) {
              return {
                ...lo,
                status: 'PROCESSING',
                shipping_address: {
                  ...(lo.shipping_address || {}),
                  qikink_info: qikinkInfo,
                  ...(trackingInfo ? { tracking_info: trackingInfo } : {})
                }
              };
            }
            return lo;
          });
          localStorage.setItem('elitebath_local_orders', JSON.stringify(updated));
          localStorage.setItem('animemaze_local_orders', JSON.stringify(updated));
        } catch (_) {}

        // Persist to Supabase
        try {
          await supabase.from('orders').update({
            status: 'PROCESSING',
            shipping_address: {
              ...currentShipping,
              qikink_info: qikinkInfo,
              ...(trackingInfo ? { tracking_info: trackingInfo } : {})
            }
          }).eq('id', order.id);
        } catch (dbErr) {
          console.warn('DB update for Qikink order dispatch:', dbErr);
        }
      } else {
        alert(`❌ Qikink Dispatch Failed: ${res.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Qikink Error: ${err.message || err}`);
    } finally {
      setDispatchingQikinkId(null);
    }
  };

  const handlePollQikinkStatus = async (order: Order) => {
    const qikinkId = (order.shipping_address as any)?.qikink_info?.order_id;
    if (!qikinkId) return;
    setPollingQikinkOrderId(order.id);
    try {
      const res = await checkQikinkOrderStatus(order.id, qikinkId);
      if (res.success) {
        alert(`📦 Qikink Status Update:\nStatus: ${res.status}\nCourier: ${res.courier || 'N/A'}\nAWB: ${res.awb || 'N/A'}\n${res.message || ''}`);
        
        const currentShipping = (order.shipping_address as any) || {};
        const updatedQikink = {
          ...(currentShipping.qikink_info || {}),
          status: res.status,
          awb_number: res.awb || currentShipping.qikink_info?.awb_number,
          courier_name: res.courier || currentShipping.qikink_info?.courier_name,
        };
        const nextStatus = (res.status === 'SHIPPED' || res.status === 'OUT_FOR_DELIVERY') ? res.status : order.status;

        setOrders((prev) => prev.map((o) => {
          if (o.id !== order.id) return o;
          return {
            ...o,
            status: nextStatus as any,
            shipping_address: {
              ...currentShipping,
              qikink_info: updatedQikink
            }
          };
        }));

        try {
          await supabase.from('orders').update({
            status: nextStatus,
            shipping_address: {
              ...currentShipping,
              qikink_info: updatedQikink
            }
          }).eq('id', order.id);
        } catch (_) {}
      } else {
        alert(`⚠️ Could not refresh Qikink status: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Qikink error: ${err.message || err}`);
    } finally {
      setPollingQikinkOrderId(null);
    }
  };

  // --- Actions: Edit Estimated Delivery Date ---
  const handleEditDeliveryDate = (orderId: string, currentDate: string | null) => {
    setEditingDeliveryDateOrderId(orderId);
    setEditingDeliveryDate(currentDate ? new Date(currentDate).toISOString().split('T')[0] : '');
  };

  const handleSaveDeliveryDate = async () => {
    if (!editingDeliveryDateOrderId || !editingDeliveryDate) return;
    const isoDate = new Date(editingDeliveryDate).toISOString();

    // 1. Update React state immediately
    setOrders((prev) =>
      prev.map((o) =>
        o.id === editingDeliveryDateOrderId ? { ...o, estimated_delivery_date: isoDate } : o
      )
    );

    // 2. Update localStorage
    try {
      const raw =
        localStorage.getItem('elitebath_local_orders') ||
        localStorage.getItem('animemaze_local_orders') ||
        '[]';
      const localList = JSON.parse(raw);
      const updatedLocal = localList.map((lo: any) =>
        lo.id === editingDeliveryDateOrderId ? { ...lo, estimated_delivery_date: isoDate } : lo
      );
      localStorage.setItem('elitebath_local_orders', JSON.stringify(updatedLocal));
      localStorage.setItem('animemaze_local_orders', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn('Error updating local storage delivery date:', e);
    }

    // 3. Update Supabase
    try {
      const { error } = await supabase
        .from('orders')
        .update({ estimated_delivery_date: isoDate })
        .eq('id', editingDeliveryDateOrderId);

      if (error) console.warn('Supabase delivery date update error:', error);
      alert('Estimated delivery date updated successfully!');
    } catch (err: any) {
      console.warn('Failed to update remote delivery date:', err);
      alert('Estimated delivery date updated!');
    } finally {
      setEditingDeliveryDateOrderId(null);
      setEditingDeliveryDate('');
    }
  };

  // --- Actions: Q&A --- always try DB first & sync resiliently
  const handleAnswerQuestion = async (questionId: string, answer: string) => {
    if (!answer.trim()) return;
    const cleanAnswer = answer.trim();

    try {
      // 1. Attempt Supabase DB update
      try {
        const { error } = await supabase
          .from('product_questions')
          .update({ answer: cleanAnswer })
          .eq('id', questionId);

        if (error) {
          console.warn('Supabase answer question warning:', error);
        }
      } catch (dbErr) {
        console.warn('Supabase answer question exception:', dbErr);
      }

      // 2. Sync to local questions storage
      try {
        const rawLocalQ = localStorage.getItem('elitebath_product_questions');
        if (rawLocalQ) {
          const parsedLocal: ProductQuestion[] = JSON.parse(rawLocalQ);
          const updated = parsedLocal.map((q) => (q.id === questionId ? { ...q, answer: cleanAnswer } : q));
          localStorage.setItem('elitebath_product_questions', JSON.stringify(updated));
        }
      } catch (_) {}

      // 3. Immediately update UI state
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, answer: cleanAnswer } : q))
      );

      alert('Answer submitted successfully!');
    } catch (err: any) {
      console.error('Answer submit failed:', err);
      alert('Failed to submit answer: ' + (err.message || err));
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Delete this question?')) return;

    try {
      try {
        const { error } = await supabase.from('product_questions').delete().eq('id', id);
        if (error) console.warn('Delete question DB warning:', error);
      } catch (dbErr) {
        console.warn('Delete question DB exception:', dbErr);
      }

      try {
        const rawLocalQ = localStorage.getItem('elitebath_product_questions');
        if (rawLocalQ) {
          const parsedLocal: ProductQuestion[] = JSON.parse(rawLocalQ);
          const updated = parsedLocal.filter((q) => q.id !== id);
          localStorage.setItem('elitebath_product_questions', JSON.stringify(updated));
        }
      } catch (_) {}

      setQuestions((prev) => prev.filter((q) => q.id !== id));
      alert('Question deleted successfully!');
    } catch (err: any) {
      console.error('Delete question failed:', err);
      alert('Failed to delete question: ' + (err.message || err));
    }
  };

  // --- Download Sample Reviews JSON Template ---
  const downloadSampleReviewsJson = () => {
    const sampleReviews = [
      {
        NAME: "Aarav Sharma",
        MESSAGE: "The print quality is extraordinary! Fabric feels premium, heavyweight cotton and fit is perfectly oversized.",
        RATING: 5
      },
      {
        NAME: "Rohan V.",
        MESSAGE: "Super fast delivery. The graphic doesn't crack or peel even after machine washing. Worth every rupee!",
        RATING: 5
      },
      {
        NAME: "Priya Nair",
        MESSAGE: "Loved the aesthetic packaging and free stickers! Soft fabric, highly recommend for any anime fan.",
        RATING: 4
      },
      {
        NAME: "Kabir Malhotra",
        MESSAGE: "Clean stitching and drop-shoulder fit is on point. Got tons of compliments on campus.",
        RATING: 5
      },
      {
        NAME: "Ananya Iyer",
        MESSAGE: "Colors are very vibrant and true to the photos. Sizing runs slightly oversized which is great.",
        RATING: 4
      },
      {
        NAME: "Devansh Mehta",
        MESSAGE: "One of the best anime merch purchases I've made in India. Premium look and feel.",
        RATING: 5
      },
      {
        NAME: "Tanvi Kulkarni",
        MESSAGE: "Great quality overall. Delivery was super prompt and customer service answered my sizing queries quickly.",
        RATING: 4
      },
      {
        NAME: "Siddharth Rao",
        MESSAGE: "Top notch print and thick 240+ GSM fabric. Looks even better in person than on screen.",
        RATING: 5
      },
      {
        NAME: "Meera Sen",
        MESSAGE: "Bought it as a birthday gift for my brother and he was thrilled! Excellent print and cloth.",
        RATING: 5
      },
      {
        NAME: "Aditya Verma",
        MESSAGE: "Decent quality for the price. Fabric is breathable and comfortable for daily wear.",
        RATING: 3
      }
    ];

    const blob = new Blob([JSON.stringify(sampleReviews, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tryvoal_sample_reviews.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Handle Review JSON File Upload & Parsing ---
  const handleReviewJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJsonReviewFileName(file.name);
    setJsonReviewError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.reviews)
          ? parsed.reviews
          : Array.isArray(parsed?.data)
          ? parsed.data
          : null;

        if (!list) {
          setJsonReviewError('Invalid JSON structure: Root element must be an array of objects [ { "NAME": "...", "MESSAGE": "...", "RATING": 5 } ].');
          setJsonReviewList([]);
          return;
        }

        if (list.length === 0) {
          setJsonReviewError('The JSON array is empty. Please provide at least one review entry.');
          setJsonReviewList([]);
          return;
        }

        const validEntries: Array<{ name: string; message: string; rating: number }> = [];

        list.forEach((item: any, idx: number) => {
          if (!item || typeof item !== 'object') return;

          // Case-insensitive key mapping
          const rawName = item.NAME ?? item.name ?? item.userName ?? item.user_name ?? item.author ?? `Anime Fan ${idx + 1}`;
          const rawMsg = item.MESSAGE ?? item.message ?? item.review ?? item.review_text ?? item.comment ?? '';
          const rawRating = item.RATING ?? item.rating ?? item.stars ?? item.score ?? 5;

          const trimmedMsg = String(rawMsg).trim();
          if (!trimmedMsg) return; // Skip empty comments

          // Clamped strictly between 3 and 5 as required
          let parsedRating = Math.round(Number(rawRating));
          if (isNaN(parsedRating) || parsedRating < 3) {
            parsedRating = 3;
          } else if (parsedRating > 5) {
            parsedRating = 5;
          }

          validEntries.push({
            name: String(rawName).trim() || `Anime Fan ${idx + 1}`,
            message: trimmedMsg,
            rating: parsedRating
          });
        });

        if (validEntries.length === 0) {
          setJsonReviewError('No valid review entries found. Ensure each object has NAME, MESSAGE, and RATING (3-5).');
          setJsonReviewList([]);
          return;
        }

        setJsonReviewList(validEntries);
      } catch (err: any) {
        console.error('JSON parsing error:', err);
        setJsonReviewError('JSON Parsing Error: ' + (err.message || 'Invalid JSON syntax.'));
        setJsonReviewList([]);
      }
    };

    reader.readAsText(file);
  };

  // --- Execute Bulk Review Import with Equal Division & Zero Repetition ---
  const handleExecuteReviewImport = async () => {
    if (jsonReviewList.length === 0) {
      alert('Please upload a valid JSON file first.');
      return;
    }

    // 1. Determine target products
    let targetProducts: Product[] = [];
    if (reviewTargetScope === 'ALL') {
      targetProducts = products.filter(p => p.is_active !== false);
      if (targetProducts.length === 0) targetProducts = products;
    } else if (reviewTargetScope === 'CATEGORY') {
      targetProducts = products.filter(p => p.category_id === reviewTargetCategoryId);
    } else if (reviewTargetScope === 'SPECIFIC') {
      targetProducts = products.filter(p => reviewTargetProductIds.includes(p.id));
    }

    if (targetProducts.length === 0) {
      alert('No target products found matching your selection. Please adjust your target scope.');
      return;
    }

    setImportingReviews(true);
    setImportProgress({ current: 0, total: jsonReviewList.length });

    try {
      // 2. Optional Shuffle to organically distribute names & sentiments
      let entriesToAssign = [...jsonReviewList];
      if (reviewShuffle) {
        for (let i = entriesToAssign.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [entriesToAssign[i], entriesToAssign[j]] = [entriesToAssign[j], entriesToAssign[i]];
        }
      }

      // 3. Round-Robin Equal Division:
      // Review at index i is assigned to targetProducts[i % targetProducts.length].
      // Every single review from the JSON is assigned uniquely once. No repetition across products!
      const totalReviews = entriesToAssign.length;
      const numProducts = targetProducts.length;
      const reviewsPerProductFloor = Math.floor(totalReviews / numProducts);

      const generatedReviews: Review[] = entriesToAssign.map((entry, idx) => {
        const assignedProduct = targetProducts[idx % numProducts];
        
        // Stagger timestamps naturally over the selected time window
        const windowDays = Number(reviewDateWindow);
        const daysAgo = windowDays > 0 
          ? (idx / totalReviews) * windowDays + (Math.random() * 0.4)
          : 0;
        const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

        const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        return {
          id: uniqueId,
          product_id: assignedProduct.id,
          user_id: user?.id || '00000000-0000-0000-0000-000000000000',
          user_name: entry.name,
          rating: Math.min(5, Math.max(3, entry.rating)), // Guarantee 3 to 5
          review_text: entry.message,
          review_images: [],
          verified_purchase: reviewVerifiedBuyer,
          status: reviewAutoApprove ? 'APPROVED' : 'PENDING',
          likes_count: Math.floor(Math.random() * 5) + 1,
          created_at: createdAt
        };
      });

      // 4. Multi-Channel Database Sync (reviews table + universal site_announcements backup broadcast + settings)
      setImportProgress({ current: Math.floor(totalReviews / 2), total: totalReviews });
      const syncResult = await syncReviewsMultiChannel(generatedReviews);
      setImportProgress({ current: totalReviews, total: totalReviews });

      // 5. Update Admin State
      await loadAdminData();

      const syncStatusText = syncResult.directDbSuccess 
        ? '✓ Synced to Supabase database.' 
        : syncResult.backupSynced 
        ? '✓ Synced to Supabase cloud channel (visible on all devices).' 
        : '✓ Saved locally.';

      alert(`🎉 Successfully imported ${totalReviews} reviews!\n\n• Target Products: ${numProducts}\n• Distribution: ~${reviewsPerProductFloor} unique reviews per product\n• Zero Repetition: Every review is uniquely assigned.\n• Cloud Sync: ${syncStatusText}`);
      
      // Reset Modal
      setIsReviewImportModalOpen(false);
      setJsonReviewList([]);
      setJsonReviewFileName('');
      setJsonReviewError(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      alert('Error during import: ' + (err.message || err));
    } finally {
      setImportingReviews(false);
      setImportProgress(null);
    }
  };

  // --- Actions: Review Moderation with Cross-Device Sync ---
  const handleModerateReview = async (reviewId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await updateReviewStatusMultiChannel(reviewId, status);
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status } : r));
      alert(`Review status updated to ${status} and synced across all devices.`);
    } catch (err: any) {
      console.error('Review moderation failed:', err);
      alert('Failed to update review status: ' + (err.message || err));
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await deleteReviewMultiChannel(id);
      setReviews(prev => prev.filter(r => r.id !== id));
      alert('Review deleted permanently across all devices!');
    } catch (err: any) {
      console.error('Failed to delete review:', err);
      alert('Failed to delete review: ' + (err.message || err));
    }
  };

  // Option to bulk clear imported reviews
  const handleBulkClearReviews = async () => {
    if (!window.confirm('Are you sure you want to delete all imported/cached reviews? This action cannot be undone.')) return;
    try {
      localStorage.removeItem('tryvoal_custom_reviews');
      localStorage.removeItem('elitebath_custom_reviews');
      await loadAdminData();
      alert('Local custom reviews cleared.');
    } catch (err: any) {
      alert('Failed to clear: ' + err.message);
    }
  };

  // --- Export Subscribers CSV ---
  const exportSubscribersCSV = () => {
    if (subscribers.length === 0) return;
    const csvRows = [
      ['ID', 'Email', 'Subscribed At'],
      ...subscribers.map(sub => [sub.id, sub.email, new Date(sub.created_at).toLocaleString()])
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `newsletter_subscribers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Orders Calculation & Metrics
  const filteredOrders = orders.filter((order) => {
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase().trim();
      const addr = order.shipping_address || {};
      const matchesId = (order.id || '').toLowerCase().includes(q);
      const matchesName = (addr.fullName || '').toLowerCase().includes(q);
      const matchesPhone = (addr.phone || '').toLowerCase().includes(q);
      const matchesEmail = (addr.email || '').toLowerCase().includes(q);
      const matchesCity = (addr.city || '').toLowerCase().includes(q);
      const matchesPincode = (addr.pincode || '').toLowerCase().includes(q);
      const matchesTxid = (addr.transactionId || addr.paymentId || '').toLowerCase().includes(q);
      const matchesItem = (order.items || []).some(
        (it: any) =>
          (it.product?.name || it.product_name || '').toLowerCase().includes(q) ||
          (it.selected_variant || '').toLowerCase().includes(q) ||
          (it.sku || it.product?.sku || '').toLowerCase().includes(q)
      );

      if (!matchesId && !matchesName && !matchesPhone && !matchesEmail && !matchesCity && !matchesPincode && !matchesTxid && !matchesItem) {
        return false;
      }
    }

    if (orderStatusFilter !== 'ALL') {
      if (order.status !== orderStatusFilter) return false;
    }

    if (orderPaymentFilter !== 'ALL') {
      if (orderPaymentFilter === 'PAID') {
        if (order.payment_status !== 'PAID' && order.payment_status !== 'COMPLETED' && order.status !== 'PAID') return false;
      } else if (order.payment_status !== orderPaymentFilter) {
        return false;
      }
    }

    return true;
  });

  const totalRevenue = orders
    .filter((o) => o.payment_status === 'PAID' || o.payment_status === 'COMPLETED' || o.status === 'PAID' || o.status === 'DELIVERED')
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const activeFulfillmentCount = orders.filter((o) =>
    ['PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status)
  ).length;

  const deliveredCount = orders.filter((o) => o.status === 'DELIVERED').length;

  if (!user || profile?.role !== 'admin') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      
      {/* Mobile Sticky Top Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm w-full">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary flex-shrink-0" />
              <div>
                <h1 className="text-sm font-extrabold text-gray-900 leading-none">Admin Panel</h1>
                <p className="text-[10px] text-gray-500 font-medium capitalize mt-0.5">{activeTab.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadAdminData()}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Horizontal Pill Tabs */}
        <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar scroll-smooth">
          {([
            { id: 'verification', label: 'Status' },
            { id: 'products', label: 'Products' },
            { id: 'categories', label: 'Categories & Subcategories' },
            { id: 'hero_banner', label: 'Hero Main Ad' },
            { id: 'orders', label: 'Orders' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'questions', label: 'Q&A' },
            { id: 'reviews', label: 'Reviews' },
            { id: 'replacements', label: 'Returns' },
            { id: 'coupons', label: 'Coupons' },
            { id: 'announcement', label: 'Notice' },
            { id: 'subscribers', label: 'Subscribers' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <h1 className="text-xl font-extrabold text-gray-900">Admin Panel</h1>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-1 hover:bg-gray-100 rounded"
              >
                <CloseIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">Manage your store</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {(['verification', 'products', 'categories', 'hero_banner', 'orders', 'inventory', 'questions', 'reviews', 'subscribers', 'replacements', 'coupons', 'announcement'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all flex items-center gap-3 ${
                  activeTab === tab
                    ? 'bg-primary/10 text-primary border border-primary/20 font-bold'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                }`}
              >
                <span className="flex-1">
                  {tab === 'hero_banner' ? 'Hero Main Ad' : tab === 'categories' ? 'Categories & Anime' : tab.replace('_', ' ')}
                </span>
                {activeTab === tab && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200">
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadAdminData()}
              className="w-full"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 lg:ml-0 min-w-0">
        <div className="max-w-7xl mx-auto">
          {/* Desktop Header */}
          <div className="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <span>Admin Control Panel</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">Manage payments, inventory, catalogs, Q&A, and reviews</p>
            </div>
          </div>

          {dbWarning && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-900 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold">Database Connection Warning (Multi-Device Sync Inactive)</p>
                <p className="mt-1 text-xs text-amber-800">
                  Supabase could not be reached: <span className="font-mono bg-amber-100 px-1 py-0.5 rounded">{dbWarning}</span>
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Products and categories created or edited will only be saved in <strong>this laptop's browser memory (localStorage)</strong>. They will <strong>NOT</strong> appear on mobile or other devices until the Supabase project is active and connected in <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env</code> and Vercel Environment Variables.
                </p>
              </div>
            </div>
          )}

          {loadingData ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-8">
          
          {/* TAB 1: Payment Verification Panel */}
          {activeTab === 'verification' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <CreditCard className="h-5.5 w-5.5 text-secondary" />
                <span>Order Status Management</span>
              </h2>

              <div className="p-3.5 sm:p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs sm:text-sm text-gray-700">
                  <strong className="text-primary">Note:</strong> Payments are processed securely via Trust Gateway UPI and Direct UPI QR. All orders across all channels appear here in real-time.
                </p>
              </div>

              {/* Mobile Verification Cards */}
              <div className="sm:hidden space-y-3">
                {orders.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 italic bg-gray-50 rounded-xl border border-gray-200 text-xs">
                    No recent orders found.
                  </div>
                ) : (
                  orders
                    .slice(0, 30)
                    .map((order) => (
                      <div key={order.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded">
                            #{order.id.slice(0, 10)}
                          </span>
                          <span className="font-extrabold text-sm text-gray-900">
                            ₹{order.total_amount}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p className="font-bold text-gray-900">{order.shipping_address?.fullName || 'Guest Customer'}</p>
                          {order.shipping_address?.phone && (
                            <a href={`tel:${order.shipping_address.phone}`} className="text-primary hover:underline">
                              {order.shipping_address.phone}
                            </a>
                          )}
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {order.shipping_address?.city}, {order.shipping_address?.state}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                          {(order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_VERIFICATION') && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-warning/10 border border-warning/20 text-warning rounded-lg text-[11px] font-semibold">
                              <span>⏳ Pending Payment</span>
                            </span>
                          )}
                          {order.status === 'PAID' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-success/10 border border-success/20 text-success rounded-lg text-[11px] font-semibold">
                              <Check className="h-3 w-3" />
                              <span>Paid</span>
                            </span>
                          )}
                          {order.status === 'PROCESSING' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-[11px] font-semibold">
                              <span>⚙️ Processing</span>
                            </span>
                          )}
                          {(order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-[11px] font-semibold">
                              <span>🚚 Shipped</span>
                            </span>
                          )}
                          {order.status === 'DELIVERED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-semibold">
                              <Check className="h-3 w-3" />
                              <span>Delivered</span>
                            </span>
                          )}
                          {order.status === 'CANCELLED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-danger/10 border border-danger/20 text-danger rounded-lg text-[11px] font-semibold">
                              <X className="h-3 w-3" />
                              <span>Cancelled</span>
                            </span>
                          )}
                          <span className="text-[11px] text-gray-500 ml-auto font-medium">
                            Payment: <strong className="text-gray-800">{order.payment_status}</strong>
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Customer Details</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-center">Order Status</th>
                      <th className="px-6 py-4 text-center">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                          No recent orders found.
                        </td>
                      </tr>
                    ) : (
                      orders
                        .slice(0, 30)
                        .map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold text-xs truncate max-w-[120px]">{order.id}</td>
                            <td className="px-6 py-4 max-w-[200px]">
                              <div className="space-y-0.5">
                                <p className="font-bold text-gray-900">{order.shipping_address?.fullName}</p>
                                <p className="text-xs text-gray-500">{order.shipping_address?.phone}</p>
                                <p className="text-xs text-gray-600 truncate">{order.shipping_address?.address}</p>
                                <p className="text-xs text-gray-500">{order.shipping_address?.city}, {order.shipping_address?.state}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-extrabold text-gray-900">₹{order.total_amount}</td>
                            <td className="px-6 py-4 text-center">
                              {(order.status === 'PENDING_PAYMENT' || order.status === 'PENDING_VERIFICATION') && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-warning/10 border border-warning/20 text-warning rounded-lg text-xs font-semibold">
                                  <span>⏳ Pending Payment</span>
                                </span>
                              )}
                              {order.status === 'PAID' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-success/10 border border-success/20 text-success rounded-lg text-xs font-semibold">
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Paid</span>
                                </span>
                              )}
                              {order.status === 'PROCESSING' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold">
                                  <span>⚙️ Processing</span>
                                </span>
                              )}
                              {(order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold">
                                  <span>🚚 Shipped</span>
                                </span>
                              )}
                              {order.status === 'DELIVERED' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold">
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Delivered</span>
                                </span>
                              )}
                              {order.status === 'CANCELLED' && (
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-danger/10 border border-danger/20 text-danger rounded-lg text-xs font-semibold">
                                  <X className="h-3.5 w-3.5" />
                                  <span>Cancelled</span>
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {(order.payment_status === 'PENDING_PAYMENT' || order.payment_status === 'PENDING_VERIFICATION' || !order.payment_status) && (
                                <span className="text-xs text-warning font-medium">Awaiting Payment</span>
                              )}
                              {order.payment_status === 'PAID' && (
                                <span className="text-xs text-success font-medium">Paid</span>
                              )}
                              {order.payment_status === 'FAILED' && (
                                <span className="text-xs text-danger font-medium">Failed</span>
                              )}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Products Manager */}
          {activeTab === 'products' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3.5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                    <ShoppingBag className="h-5.5 w-5.5 text-secondary" />
                    <span>Products Library</span>
                  </h2>
                  <p className="text-xs text-gray-500">
                    Manage apparel collections, base specifications, and multi-attribute product variants.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                  <div className="relative flex-grow sm:w-60">
                    <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by name, SKU..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 sm:py-1.5 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Anime Universe / Sub-Category Filter */}
                  <select
                    value={selectedAnimeFilter}
                    onChange={(e) => setSelectedAnimeFilter(e.target.value)}
                    className="py-2 sm:py-1.5 px-3 rounded-xl text-xs bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:border-primary font-medium"
                  >
                    <option value="all">All Anime Universes</option>
                    {allAnimeSeries.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.short ? `${s.short} - ` : ''}{s.label}
                      </option>
                    ))}
                  </select>

                  {/* Pinned Products Filter Toggle */}
                  <button
                    type="button"
                    onClick={() => setFilterPinnedOnly(!filterPinnedOnly)}
                    className={`py-2 sm:py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      filterPinnedOnly
                        ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                    title={filterPinnedOnly ? 'Showing pinned products only (click to show all)' : 'Filter by pinned products'}
                  >
                    <Pin className={`h-3.5 w-3.5 ${filterPinnedOnly ? 'fill-current' : ''}`} />
                    <span>Pinned ({products.filter(p => isProductEffectivelyPinned(p, pinnedProductIds)).length})</span>
                  </button>

                  <Button size="sm" className="w-full sm:w-auto justify-center" onClick={() => {
                    setEditingProduct(null);
                    setProductForm({
                      name: '',
                      slug: '',
                      description: '',
                      price: 0,
                      stock: 0,
                      featured: false,
                      category_id: '',
                      main_image_url: '',
                      additional_images: '',
                      sku: '',
                      brand: 'TRYVOAL',
                      material: '',
                      finish: '',
                      warranty_info: '',
                      is_new_arrival: false,
                      is_active: true,
                      is_pinned: false,
                      shipping_fee: 0,
                    });
                    setHasVariants(false);
                    setOptionDrafts([]);
                    setVariantDrafts([]);
                    setIsProductModalOpen(true);
                  }}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add Product
                  </Button>
                </div>
              </div>

              {/* Mobile Products List */}
              <div className="md:hidden space-y-3">
                {products
                  .filter((prod) => {
                    if (filterPinnedOnly && !isProductEffectivelyPinned(prod, pinnedProductIds)) return false;
                    if (selectedAnimeFilter !== 'all') {
                      const series = allAnimeSeries.find(s => s.id === selectedAnimeFilter);
                      const aliases = series?.aliases || [selectedAnimeFilter, series?.label.toLowerCase() || ''];
                      const brand = prod.brand?.toLowerCase() || '';
                      const name = prod.name.toLowerCase();
                      const desc = prod.description?.toLowerCase() || '';
                      if (!aliases.some(a => brand.includes(a) || name.includes(a) || desc.includes(a))) {
                        return false;
                      }
                    }
                    if (!productSearchQuery.trim()) return true;
                    const q = productSearchQuery.toLowerCase();
                    return (
                      prod.name.toLowerCase().includes(q) ||
                      prod.slug.toLowerCase().includes(q) ||
                      (prod.sku && prod.sku.toLowerCase().includes(q)) ||
                      (prod.brand && prod.brand.toLowerCase().includes(q)) ||
                      (prod.category?.name && prod.category.name.toLowerCase().includes(q))
                    );
                  })
                  .map((prod) => {
                    const isPinned = isProductEffectivelyPinned(prod, pinnedProductIds);
                    return (
                    <div key={prod.id} className={`p-3.5 rounded-2xl border space-y-3 transition-colors ${
                      isPinned ? 'bg-amber-50/40 border-amber-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        <img
                          src={prod.main_image_url}
                          alt=""
                          className="w-16 h-18 object-cover rounded-xl bg-white border border-gray-200 shadow-sm flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{prod.name}</h3>
                            <span className="font-black text-sm text-gray-900 flex-shrink-0">
                              ₹{prod.price.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {isPinned && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs">
                                <Pin className="h-2.5 w-2.5 fill-amber-500 text-amber-700" />
                                PINNED
                              </span>
                            )}
                            {prod.sku && (
                              <span className="text-[10px] text-gray-600 font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                {prod.sku}
                              </span>
                            )}
                            <span className="text-[10px] text-primary font-semibold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                              {prod.category?.name || 'Unassigned'}
                            </span>
                            {prod.brand && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                {prod.brand}
                              </span>
                            )}
                            {prod.has_variants && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded">
                                <Sliders className="h-2.5 w-2.5" />
                                {prod.variants?.length ? `${prod.variants.length} Variants` : 'Variants'}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-gray-500 line-clamp-1">
                            {prod.material && <span className="font-medium text-gray-700">{prod.material}</span>}
                            {prod.material && prod.finish && <span> • </span>}
                            {prod.finish && <span>{prod.finish}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div>
                          {prod.stock <= 0 ? (
                            <span className="text-[10px] font-bold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded uppercase">
                              Out of Stock
                            </span>
                          ) : prod.stock <= 5 ? (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                              {prod.stock} left
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              {prod.stock} in stock
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleTogglePinProduct(prod.id, e)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 border text-xs font-bold rounded-lg transition-colors shadow-sm ${
                              isPinned
                                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                : 'bg-white border-gray-300 hover:border-amber-500 text-gray-700 hover:text-amber-600'
                            }`}
                            title={isPinned ? 'Unpin from Top of Shop' : 'Pin to Top of Shop'}
                          >
                            <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-white' : ''}`} />
                            {isPinned ? 'Pinned' : 'Pin'}
                          </button>
                          <button
                            onClick={() => handleEditProduct(prod)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 hover:border-primary text-primary text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 hover:border-danger/40 text-danger text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Products Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Image</th>
                      <th className="px-6 py-4">Product Name & SKU</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Specs & Finishes</th>
                      <th className="px-6 py-4">Price & Variants</th>
                      <th className="px-6 py-4">Stock</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products
                      .filter((prod) => {
                        if (filterPinnedOnly && !isProductEffectivelyPinned(prod, pinnedProductIds)) return false;
                        if (selectedAnimeFilter !== 'all') {
                          const series = allAnimeSeries.find(s => s.id === selectedAnimeFilter);
                          const aliases = series?.aliases || [selectedAnimeFilter, series?.label.toLowerCase() || ''];
                          const brand = prod.brand?.toLowerCase() || '';
                          const name = prod.name.toLowerCase();
                          const desc = prod.description?.toLowerCase() || '';
                          if (!aliases.some(a => brand.includes(a) || name.includes(a) || desc.includes(a))) {
                            return false;
                          }
                        }
                        if (!productSearchQuery.trim()) return true;
                        const q = productSearchQuery.toLowerCase();
                        return (
                          prod.name.toLowerCase().includes(q) ||
                          prod.slug.toLowerCase().includes(q) ||
                          (prod.sku && prod.sku.toLowerCase().includes(q)) ||
                          (prod.brand && prod.brand.toLowerCase().includes(q)) ||
                          (prod.category?.name && prod.category.name.toLowerCase().includes(q))
                        );
                      })
                      .map((prod) => {
                        const isPinned = isProductEffectivelyPinned(prod, pinnedProductIds);
                        return (
                        <tr key={prod.id} className={`transition-colors ${
                          isPinned ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-gray-50'
                        }`}>
                          <td className="px-6 py-3">
                            <img src={prod.main_image_url} alt="" className="w-12 h-14 object-cover rounded-xl bg-gray-100 border border-gray-200 shadow-sm" />
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900 text-sm hover:text-primary">{prod.name}</p>
                              {isPinned && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs flex-shrink-0">
                                  <Pin className="h-2.5 w-2.5 fill-amber-500 text-amber-700" />
                                  Pinned
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {prod.sku && (
                                <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                                  {prod.sku}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                                {prod.brand || 'Anime'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-700 font-medium">
                            {prod.category?.name || 'Unassigned'}
                          </td>
                          <td className="px-6 py-3 text-xs text-gray-500">
                            <p className="text-gray-800 font-medium truncate max-w-[140px]">{prod.material || 'Standard'}</p>
                            <p className="text-[10px] text-gray-500 truncate max-w-[140px]">{prod.finish || 'Standard Finish'}</p>
                          </td>
                          <td className="px-6 py-3">
                            <span className="font-extrabold text-gray-900 block">
                              ₹{prod.price.toLocaleString('en-IN')}
                            </span>
                            {prod.has_variants && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded mt-0.5">
                                <Sliders className="h-2.5 w-2.5" />
                                {prod.variants?.length ? `${prod.variants.length} Variants` : 'Multi-Option'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {prod.stock <= 0 ? (
                              <span className="text-[10px] font-bold text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded uppercase">
                                Out of Stock
                              </span>
                            ) : prod.stock <= 5 ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                                {prod.stock} left
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                {prod.stock} in stock
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={(e) => handleTogglePinProduct(prod.id, e)}
                              className={`p-1.5 border rounded-lg transition-all ${
                                isPinned
                                  ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-sm'
                                  : 'bg-gray-100 border-gray-300 hover:border-amber-500 text-gray-600 hover:text-amber-600'
                              }`}
                              title={isPinned ? 'Unpin from Top of Shop' : 'Pin to Top of Shop'}
                            >
                              <Pin className={`h-4 w-4 ${isPinned ? 'fill-white' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleEditProduct(prod)}
                              className="p-1.5 bg-gray-100 border border-gray-300 hover:border-primary text-primary rounded-lg transition-colors"
                              title="Edit Product & Variants"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 bg-gray-100 border border-gray-200 hover:border-danger/40 text-danger rounded-lg transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Categories & Anime Sub-Categories Manager */}
          {activeTab === 'categories' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              {/* Category Sub-Navigation View Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryView('main')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                      activeCategoryView === 'main'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    <span>Main Categories ({categories.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCategoryView('subcategories')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
                      activeCategoryView === 'subcategories'
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Tag className="h-4 w-4" />
                    <span>Anime Sub-Categories & Universes ({allAnimeSeries.length})</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/20 text-white font-mono">
                      JJK, Bleach...
                    </span>
                  </button>
                </div>

                <div>
                  {activeCategoryView === 'main' ? (
                    <Button size="sm" onClick={() => {
                      setEditingCategory(null);
                      setCategoryForm({ name: '', image_url: '', size_enabled: false });
                      setIsCategoryModalOpen(true);
                    }}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add Category
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => {
                      setEditingAnimeSeries(null);
                      setAnimeForm({ label: '', id: '', short: '', image_url: '' });
                      setIsAnimeModalOpen(true);
                    }}>
                      <Plus className="mr-1.5 h-4 w-4" /> Add Anime Universe
                    </Button>
                  )}
                </div>
              </div>

              {/* VIEW 1: Main Categories (Collections) */}
              {activeCategoryView === 'main' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Store Collections & Categories</h3>
                      <p className="text-xs text-gray-500">
                        Products are assigned to these apparel & merchandise categories. Image updates sync directly to database.
                      </p>
                    </div>
                  </div>

                  {/* Mobile Categories List */}
                  <div className="sm:hidden space-y-3">
                    {categories.map((cat) => (
                      <div key={cat.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={cat.image_url}
                            alt=""
                            className="w-12 h-12 object-cover rounded-xl bg-white border border-gray-200 flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{cat.name}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                              cat.size_enabled ? 'bg-success/10 border border-success/20 text-success' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {cat.size_enabled ? 'Sizes Enabled' : 'Sizes Disabled'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleEditCategory(cat)}
                            className="p-2 bg-white border border-gray-300 text-primary rounded-lg shadow-sm"
                            title="Edit Category"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-2 bg-white border border-gray-300 text-danger rounded-lg shadow-sm"
                            title="Delete Category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Categories Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4">Image</th>
                          <th className="px-6 py-4">Category Name</th>
                          <th className="px-6 py-4">Sizes</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {categories.map((cat) => (
                          <tr key={cat.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3">
                              <img
                                src={cat.image_url || '/placeholder.jpg'}
                                alt=""
                                className="w-12 h-12 object-cover rounded-xl bg-gray-100 border border-gray-200"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                              />
                            </td>
                            <td className="px-6 py-3 font-bold text-gray-900">{cat.name}</td>
                            <td className="px-6 py-3">
                              {cat.size_enabled ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-bold">
                                  Enabled
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 border border-gray-300 text-gray-500 text-xs font-bold">
                                  Disabled
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right space-x-2">
                              <button
                                onClick={() => handleEditCategory(cat)}
                                className="p-1.5 bg-gray-100 border border-gray-300 text-primary rounded-lg"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-1.5 bg-gray-100 border border-gray-300 text-danger rounded-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW 2: Anime Sub-Categories / Universes (JJK, Bleach, Naruto, etc.) */}
              {activeCategoryView === 'subcategories' && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Tag className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-gray-900 mb-1">
                          Anime Franchises & Universes (Sub-Categories)
                        </p>
                        <p className="text-gray-600 leading-relaxed max-w-2xl">
                          These are the anime franchises (e.g. <strong>Jujutsu Kaisen (JJK)</strong>, <strong>Bleach</strong>, <strong>Naruto</strong>, <strong>One Piece</strong>) used across Tryvoal for storefront filtering, product tagging, and home screen cards. Changing thumbnails updates across all devices and visitor sessions.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={handleSyncSubcategoriesToCloud}
                        disabled={isSyncingSubcategories}
                        className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-sm transition"
                        title="Broadcast all anime franchise thumbnails to database across all devices"
                      >
                        <RefreshCcw className={`h-4 w-4 ${isSyncingSubcategories ? 'animate-spin' : ''}`} />
                        <span>{isSyncingSubcategories ? 'Syncing...' : 'Sync Sub-Categories to Cloud DB'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mobile Anime Sub-categories Cards */}
                  <div className="sm:hidden space-y-3">
                    {allAnimeSeries.filter(s => s.id !== 'all').map((series) => {
                      const count = products.filter((p) => {
                        const b = (p.brand || '').toLowerCase().trim();
                        const n = (p.name || '').toLowerCase();
                        return (
                          b === series.id.toLowerCase() ||
                          b === series.short.toLowerCase() ||
                          b === series.label.toLowerCase() ||
                          series.aliases?.some((a) => b.includes(a.toLowerCase()) || n.includes(a.toLowerCase()))
                        );
                      }).length;
                      const isCustom = customAnimeList.some((c) => c.id === series.id);
                      const hasCustomThumb = Boolean(animeThumbnails[series.id]);
                      const thumbUrl = animeThumbnails[series.id] || series.image_url || '/placeholder.jpg';

                      return (
                        <div key={series.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-12 h-12 flex-shrink-0">
                              <img
                                src={thumbUrl}
                                alt={series.label}
                                className="w-12 h-12 object-cover rounded-xl bg-white border border-gray-200 shadow-xs"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                              />
                              <span className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded-md bg-red-600 text-white font-mono text-[9px] font-black tracking-wider shadow-xs leading-none">
                                {series.short}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{series.label}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[11px] text-gray-500 font-mono">
                                  Slug: {series.id}
                                </span>
                                <span className="text-[11px] font-bold text-primary">
                                  • {count} Product{count === 1 ? '' : 's'}
                                </span>
                                {hasCustomThumb && (
                                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Custom Thumbnail
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditAnimeSeries(series)}
                              className="p-2 bg-white border border-gray-300 hover:border-primary text-primary rounded-lg shadow-sm"
                              title="Change Thumbnail / Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAnimeFilter(series.id);
                                setActiveTab('products');
                              }}
                              className="px-2.5 py-1.5 bg-white border border-gray-300 hover:border-gray-500 text-gray-700 rounded-lg text-xs font-bold shadow-sm"
                            >
                              Filter
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAnimeSeries(series.id)}
                                className="p-1.5 bg-white border border-gray-300 hover:border-danger text-danger rounded-lg shadow-sm"
                                title="Delete Custom Universe"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Anime Sub-categories Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4">Thumbnail</th>
                          <th className="px-6 py-4">Anime Universe</th>
                          <th className="px-6 py-4">Acronym / Code</th>
                          <th className="px-6 py-4">Slug / Filter ID</th>
                          <th className="px-6 py-4">Tagged Products</th>
                          <th className="px-6 py-4">Origin</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {allAnimeSeries.filter(s => s.id !== 'all').map((series) => {
                          const count = products.filter((p) => {
                            const b = (p.brand || '').toLowerCase().trim();
                            const n = (p.name || '').toLowerCase();
                            return (
                              b === series.id.toLowerCase() ||
                              b === series.short.toLowerCase() ||
                              b === series.label.toLowerCase() ||
                              series.aliases?.some((a) => b.includes(a.toLowerCase()) || n.includes(a.toLowerCase()))
                            );
                          }).length;
                          const isCustom = customAnimeList.some((c) => c.id === series.id);
                          const hasCustomThumb = Boolean(animeThumbnails[series.id]);
                          const thumbUrl = animeThumbnails[series.id] || series.image_url || '/placeholder.jpg';

                          return (
                            <tr key={series.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3">
                                <div className="relative w-12 h-12">
                                  <img
                                    src={thumbUrl}
                                    alt={series.label}
                                    className="w-12 h-12 object-cover rounded-xl bg-gray-100 border border-gray-200 shadow-xs"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                                  />
                                </div>
                                {hasCustomThumb && (
                                  <span className="inline-block mt-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    Custom DB
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 font-bold text-gray-900">
                                <div className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                                  <span>{series.label}</span>
                                </div>
                              </td>
                              <td className="px-6 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-600 text-white font-mono text-xs font-black tracking-wider">
                                  {series.short}
                                </span>
                              </td>
                              <td className="px-6 py-3 font-mono text-xs text-gray-500">
                                {series.id}
                              </td>
                              <td className="px-6 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                  {count} item{count === 1 ? '' : 's'}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                {isCustom ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                    Custom Franchise
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                                    Core Series
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditAnimeSeries(series)}
                                  className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 hover:border-primary text-primary hover:bg-red-50 rounded-lg text-xs font-bold shadow-xs transition-colors"
                                  title="Change Thumbnail & Edit Details"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1" />
                                  Change Thumbnail
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAnimeFilter(series.id);
                                    setActiveTab('products');
                                  }}
                                  className="px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-500 text-gray-700 rounded-lg text-xs font-bold shadow-xs"
                                >
                                  View Products
                                </button>
                                {isCustom && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnimeSeries(series.id)}
                                    className="p-1.5 bg-white border border-gray-300 hover:border-danger text-danger rounded-lg shadow-sm"
                                    title="Delete Custom Universe"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Orders Management */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Top Summary Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Total Orders</p>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-primary/10 text-primary">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2">{orders.length}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">All customer orders</p>
                </div>

                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Total Revenue</p>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2">₹{totalRevenue.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold mt-0.5">Paid transactions</p>
                </div>

                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">In Fulfillment</p>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 text-indigo-700">
                      <Package className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2">{activeFulfillmentCount}</p>
                  <p className="text-[10px] sm:text-[11px] text-indigo-700 font-semibold mt-0.5">Processing & dispatched</p>
                </div>

                <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Delivered</p>
                    <div className="p-1.5 sm:p-2 rounded-xl bg-teal-50 text-teal-700">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 mt-2">{deliveredCount}</p>
                  <p className="text-[10px] sm:text-[11px] text-teal-700 font-semibold mt-0.5">Delivered to clients</p>
                </div>
              </div>

              {/* Orders Table Container */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                      <ShoppingBag className="h-5.5 w-5.5 text-primary" />
                      <span>Customer Orders & Luxury Fulfillment</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Track consignments, manage order statuses, review apparel variants, and generate dispatch slips
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setQikinkConfigForm(getQikinkConfig());
                        setQikinkTestResult(null);
                        setIsQikinkSettingsModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs transition-all cursor-pointer"
                      title="Open Qikink Open API & Fulfillment Credentials settings"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>Qikink API ({getQikinkConfig().environment.toUpperCase()})</span>
                    </button>
                    <span className="text-xs font-semibold px-3 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                      Showing {filteredOrders.length} of {orders.length} orders
                    </span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      placeholder="Search Order ID, Name, Phone, Email, City, SKU, Variant..."
                      className="w-full pl-10 pr-10 py-2 text-xs rounded-xl bg-gray-50 border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    {orderSearchQuery && (
                      <button
                        onClick={() => setOrderSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <select
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                      className="text-xs bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary flex-1 sm:flex-none"
                    >
                      <option value="ALL">All Fulfillment Statuses</option>
                      <option value="PENDING_PAYMENT">Pending Payment</option>
                      <option value="PAID">Paid</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="PACKED">Packed & Crated</option>
                      <option value="SHIPPED">Dispatched / Shipped</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    <select
                      value={orderPaymentFilter}
                      onChange={(e) => setOrderPaymentFilter(e.target.value)}
                      className="text-xs bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary flex-1 sm:flex-none"
                    >
                      <option value="ALL">All Payment Statuses</option>
                      <option value="PAID">Paid / Completed</option>
                      <option value="PENDING_PAYMENT">Awaiting Payment</option>
                      <option value="FAILED">Failed</option>
                    </select>

                    {(orderSearchQuery || orderStatusFilter !== 'ALL' || orderPaymentFilter !== 'ALL') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOrderSearchQuery('');
                          setOrderStatusFilter('ALL');
                          setOrderPaymentFilter('ALL');
                        }}
                        className="text-xs py-2"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mobile Orders List */}
                <div className="lg:hidden space-y-4">
                  {filteredOrders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-200">
                      <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="font-semibold text-gray-700">No orders match filter</p>
                      <p className="text-xs text-gray-400 mt-1">Try changing or resetting filters</p>
                    </div>
                  ) : (
                    filteredOrders.map((order) => (
                      <div key={order.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3.5 shadow-sm">
                        {/* Card Header: ID, Date, Total */}
                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-200">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-extrabold text-xs text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">
                                #{order.id.slice(0, 10)}
                              </span>
                              <button
                                onClick={() => handleCopyText(order.id, 'Order ID')}
                                className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
                                title="Copy full Order ID"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : 'Recent'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-base text-gray-900 block">
                              ₹{(Number(order.total_amount) || 0).toLocaleString('en-IN')}
                            </span>
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] font-extrabold uppercase mt-0.5 ${
                              order.payment_status === 'PAID' || order.payment_status === 'COMPLETED'
                                ? 'text-emerald-700 bg-emerald-100 border border-emerald-300'
                                : order.payment_status === 'FAILED'
                                ? 'text-danger bg-danger/10 border border-danger/20'
                                : 'text-amber-700 bg-amber-100 border border-amber-300'
                            }`}>
                              {order.payment_status || 'PENDING'}
                            </span>
                          </div>
                        </div>

                        {/* Customer Info */}
                        <div className="space-y-1 bg-white p-3 rounded-xl border border-gray-200 text-xs">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-900">{order.shipping_address?.fullName || 'Guest Customer'}</p>
                            <button
                              onClick={() => handleCopyAddress(order)}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover font-bold"
                            >
                              <Copy className="h-3 w-3" /> Copy
                            </button>
                          </div>
                          {order.shipping_address?.phone && (
                            <a
                              href={`tel:${order.shipping_address.phone}`}
                              className="text-primary hover:underline font-semibold block text-[11px]"
                            >
                              📞 {order.shipping_address.phone}
                            </a>
                          )}
                          <p className="text-gray-600 text-[11px] leading-snug">
                            {order.shipping_address?.address}, {order.shipping_address?.city}, {order.shipping_address?.state} - {order.shipping_address?.pincode}
                          </p>
                        </div>

                        {/* Ordered Items Summary */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Items ({order.items?.length || 0}):</p>
                          <div className="space-y-1.5">
                            {order.items?.map((item, idx) => {
                              const itemName = item.product?.name || (item as any).product_name || 'Apparel Item';
                              const itemImg = item.product?.main_image_url || (item as any).image_url || '/placeholder.jpg';
                              return (
                                <div key={item.id || idx} className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-gray-200">
                                  <img
                                    src={itemImg}
                                    alt=""
                                    className="w-10 h-10 object-cover rounded-lg bg-gray-50 border border-gray-200 flex-shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 text-xs truncate">{itemName}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                      {item.selected_variant && (
                                        <span className="text-emerald-800 bg-emerald-50 px-1 rounded font-medium">
                                          {item.selected_variant}
                                        </span>
                                      )}
                                      <span>{item.quantity} × ₹{(item.price || 0).toLocaleString('en-IN')}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Fulfillment Status Selector */}
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block">
                            Fulfillment Status
                          </label>
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className="w-full bg-white border border-gray-300 text-xs font-bold text-gray-900 rounded-xl p-2.5 focus:outline-none focus:border-primary shadow-sm"
                          >
                            <option value="PENDING_PAYMENT">⏳ Pending Payment</option>
                            <option value="PAID">💳 Order Paid</option>
                            <option value="PROCESSING">⚙️ Processing & QC</option>
                            <option value="PACKED">📦 Packed & Crated</option>
                            <option value="SHIPPED">🚚 Dispatched / Shipped</option>
                            <option value="OUT_FOR_DELIVERY">🛵 Out for Delivery</option>
                            <option value="DELIVERED">✅ Delivered</option>
                            <option value="CANCELLED">❌ Cancelled</option>
                            <option value="PENDING_VERIFICATION">⏳ Pending Verification</option>
                          </select>
                        </div>

                        {/* Courier Tracking or Add Tracking */}
                        {(order.shipping_address as any)?.tracking_info ? (
                          <div className="bg-white p-2.5 rounded-xl border border-gray-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-800 flex items-center gap-1">
                                <Truck className="h-3.5 w-3.5 text-primary" />
                                {(order.shipping_address as any).tracking_info.carrier}
                              </span>
                              <button
                                onClick={() => {
                                  const tracking = (order.shipping_address as any).tracking_info;
                                  setTrackingOrderId(order.id);
                                  setTrackingCarrier(tracking.carrier || '');
                                  setTrackingNumber(tracking.tracking_number || '');
                                  setTrackingTargetStatus(order.status);
                                  setIsTrackingModalOpen(true);
                                }}
                                className="text-primary hover:underline font-bold text-xs flex items-center gap-0.5"
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </button>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px] text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                              <span className="truncate">{(order.shipping_address as any).tracking_info.tracking_number}</span>
                              <button
                                onClick={() => handleCopyText((order.shipping_address as any).tracking_info.tracking_number, 'Tracking Number')}
                                className="text-gray-400 hover:text-primary ml-1"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          order.status !== 'CANCELLED' && order.status !== 'PENDING_PAYMENT' && (
                            <button
                              onClick={() => {
                                setTrackingOrderId(order.id);
                                setTrackingCarrier('Delhivery Express');
                                setTrackingNumber('');
                                setTrackingTargetStatus(order.status);
                                setIsTrackingModalOpen(true);
                              }}
                              className="w-full py-2 bg-white border border-primary/30 hover:border-primary text-primary text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                            >
                              <Truck className="h-3.5 w-3.5" /> Add Courier Tracking
                            </button>
                          )
                        )}

                        {/* Qikink POD Dispatch / Status Box */}
                        {(order.shipping_address as any)?.qikink_info ? (
                          <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-2.5 text-xs space-y-1.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-amber-900 flex items-center gap-1 text-[11px]">
                                <Zap className="h-3.5 w-3.5 text-amber-600" />
                                Qikink POD ({(order.shipping_address as any).qikink_info.environment?.toUpperCase() || 'SANDBOX'})
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                                {(order.shipping_address as any).qikink_info.status}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[10px] text-gray-700 bg-white p-1.5 rounded border border-gray-200">
                              <span className="truncate">ID: {(order.shipping_address as any).qikink_info.order_id}</span>
                              <button
                                onClick={() => handleCopyText((order.shipping_address as any).qikink_info.order_id, 'Qikink Order ID')}
                                className="text-gray-400 hover:text-primary ml-1"
                                title="Copy Qikink Order ID"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={pollingQikinkOrderId === order.id}
                              onClick={() => handlePollQikinkStatus(order)}
                              className="w-full py-1 text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100/50 border border-amber-200 rounded-lg flex items-center justify-center gap-1 transition-colors"
                            >
                              <RefreshCcw className={`h-3 w-3 ${pollingQikinkOrderId === order.id ? 'animate-spin' : ''}`} />
                              <span>{pollingQikinkOrderId === order.id ? 'Polling Status...' : 'Check Status with Qikink'}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={dispatchingQikinkId === order.id}
                            onClick={() => handleDispatchQikink(order)}
                            className="w-full py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 hover:border-amber-400 text-amber-900 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                            title="Fulfill order via Qikink Open API"
                          >
                            <Package className="h-3.5 w-3.5 text-amber-600" />
                            {dispatchingQikinkId === order.id ? 'Dispatching...' : 'Dispatch to Qikink (POD)'}
                          </button>
                        )}

                        {/* Estimated Delivery & Packing Slip */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 gap-2">
                          <div className="text-xs">
                            <span className="text-gray-400 text-[10px] block font-bold uppercase">Delivery:</span>
                            <span className="font-semibold text-gray-800 text-xs">
                              {order.estimated_delivery_date
                                ? new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                : 'Not scheduled'}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPackingSlipOrder(order)}
                            className="text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Slip</span>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Orders Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-400 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3.5">Order ID & Date</th>
                        <th className="px-4 py-3.5">Customer & Shipping</th>
                        <th className="px-4 py-3.5">Ordered Items & Variants</th>
                        <th className="px-4 py-3.5">Grand Total</th>
                        <th className="px-4 py-3.5">Est. Delivery</th>
                        <th className="px-4 py-3.5">Fulfillment & Tracking</th>
                        <th className="px-4 py-3.5">Payment</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                            <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="font-semibold text-gray-700">No orders match your search or filter</p>
                            <p className="text-xs text-gray-400 mt-1">Try resetting the filter criteria</p>
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                            {/* Order ID & Date */}
                            <td className="px-4 py-4 align-top text-xs">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                                    #{order.id.slice(0, 10)}
                                  </span>
                                  <button
                                    onClick={() => handleCopyText(order.id, 'Order ID')}
                                    className="p-1 text-gray-400 hover:text-primary rounded transition-colors"
                                    title="Copy full Order ID"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                                <p className="text-[11px] text-gray-500">
                                  {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : 'Recent'}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : ''}
                                </p>
                              </div>
                            </td>

                            {/* Customer & Shipping Details */}
                            <td className="px-4 py-4 align-top text-xs max-w-[260px]">
                              <div className="space-y-1">
                                <div className="flex items-start gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                                  <div className="space-y-0.5 min-w-0">
                                    <p className="font-bold text-gray-900 truncate">{order.shipping_address?.fullName || 'Guest Customer'}</p>
                                    <a
                                      href={`tel:${order.shipping_address?.phone}`}
                                      className="text-gray-600 hover:text-primary text-[11px] block truncate"
                                    >
                                      {order.shipping_address?.phone}
                                    </a>
                                    <p className="text-gray-500 text-[10px] truncate">{order.shipping_address?.email}</p>
                                    <p className="text-gray-600 text-[11px] leading-snug line-clamp-2 mt-1">
                                      {order.shipping_address?.address}
                                    </p>
                                    {order.shipping_address?.landmark && (
                                      <p className="text-gray-500 text-[10px] italic">Landmark: {order.shipping_address.landmark}</p>
                                    )}
                                    <p className="text-gray-700 font-medium text-[11px]">
                                      {order.shipping_address?.city}, {order.shipping_address?.state} - {order.shipping_address?.pincode}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleCopyAddress(order)}
                                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover font-semibold mt-1"
                                >
                                  <Copy className="h-3 w-3" />
                                  Copy Address
                                </button>
                              </div>
                            </td>

                            {/* Ordered Items & Apparel Variants */}
                            <td className="px-4 py-4 align-top text-xs max-w-[280px]">
                              <div className="space-y-2.5">
                                {order.items?.map((item, idx) => {
                                  const itemSku = item.variant?.sku || item.product?.sku || (item.selected_variant_id ? `EBC-${item.selected_variant_id.slice(0, 8).toUpperCase()}` : 'EBC-SAN');
                                  const itemName = item.product?.name || (item as any).product_name || 'Apparel Item';
                                  const itemImg = item.product?.main_image_url || (item as any).image_url || '/placeholder.jpg';
                                  return (
                                    <div key={item.id || `${order.id}-item-${idx}`} className="flex items-start space-x-2.5 bg-gray-50/60 p-1.5 rounded-lg border border-gray-100">
                                      <div className="w-9 h-11 bg-white rounded overflow-hidden flex-shrink-0 border border-gray-200">
                                        <img
                                          src={itemImg}
                                          alt=""
                                          className="w-full h-full object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <p className="font-semibold text-gray-900 truncate leading-tight">{itemName}</p>
                                        
                                        {/* Variant Badge */}
                                        {item.selected_variant && (
                                          <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9px] font-bold">
                                            <Tag className="h-2.5 w-2.5" />
                                            <span>Option: {item.selected_variant}</span>
                                          </div>
                                        )}

                                        {/* Variant Attributes Chips */}
                                        {item.selected_attributes && Object.keys(item.selected_attributes).length > 0 && !item.selected_variant && (
                                          <div className="flex flex-wrap gap-1">
                                            {Object.entries(item.selected_attributes).map(([k, v]) => (
                                              <span key={k} className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 text-[9px]">
                                                {k}: {v}
                                              </span>
                                            ))}
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                                          <span className="font-mono text-gray-400">{itemSku}</span>
                                          <span className="font-bold text-gray-700">
                                            {item.quantity} × ₹{(item.price || 0).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Grand Total */}
                            <td className="px-4 py-4 align-top font-extrabold text-sm text-gray-900 whitespace-nowrap">
                              ₹{(Number(order.total_amount) || 0).toLocaleString('en-IN')}
                            </td>

                            {/* Est. Delivery */}
                            <td className="px-4 py-4 align-top text-xs whitespace-nowrap">
                              {editingDeliveryDateOrderId === order.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={editingDeliveryDate}
                                    onChange={(e) => setEditingDeliveryDate(e.target.value)}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs"
                                  />
                                  <button
                                    onClick={handleSaveDeliveryDate}
                                    className="p-1 bg-success/20 text-success rounded hover:bg-success/30"
                                    title="Save Date"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingDeliveryDateOrderId(null);
                                      setEditingDeliveryDate('');
                                    }}
                                    className="p-1 bg-danger/20 text-danger rounded hover:bg-danger/30"
                                    title="Cancel"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-gray-800">
                                    {order.estimated_delivery_date
                                      ? new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                      : 'Not scheduled'}
                                  </span>
                                  <button
                                    onClick={() => handleEditDeliveryDate(order.id, order.estimated_delivery_date)}
                                    className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                    title="Edit delivery date"
                                  >
                                    <Calendar className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Fulfillment Status & Courier Tracking */}
                            <td className="px-4 py-4 align-top text-xs min-w-[190px]">
                              <div className="space-y-2">
                                <select
                                  value={order.status}
                                  onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                  className="w-full bg-white border border-gray-300 text-xs font-semibold text-gray-900 rounded-lg p-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                >
                                  <option value="PENDING_PAYMENT">⏳ Pending Payment</option>
                                  <option value="PAID">💳 Order Paid</option>
                                  <option value="PROCESSING">⚙️ Processing & QC</option>
                                  <option value="PACKED">📦 Packed & Crated</option>
                                  <option value="SHIPPED">🚚 Dispatched / Shipped</option>
                                  <option value="OUT_FOR_DELIVERY">🛵 Out for Delivery</option>
                                  <option value="DELIVERED">✅ Delivered</option>
                                  <option value="CANCELLED">❌ Cancelled</option>
                                  <option value="PENDING_VERIFICATION">⏳ Pending Verification</option>
                                </select>

                                {/* Carrier Tracking Card if available */}
                                {(order.shipping_address as any)?.tracking_info ? (
                                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 text-[10px] space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-gray-800 flex items-center gap-1">
                                        <Truck className="h-3 w-3 text-primary" />
                                        {(order.shipping_address as any).tracking_info.carrier}
                                      </span>
                                      <button
                                        onClick={() => {
                                          const tracking = (order.shipping_address as any).tracking_info;
                                          setTrackingOrderId(order.id);
                                          setTrackingCarrier(tracking.carrier || '');
                                          setTrackingNumber(tracking.tracking_number || '');
                                          setTrackingTargetStatus(order.status);
                                          setIsTrackingModalOpen(true);
                                        }}
                                        className="text-primary hover:underline font-bold flex items-center gap-0.5"
                                      >
                                        <Edit className="h-2.5 w-2.5" /> Edit
                                      </button>
                                    </div>
                                    <div className="flex items-center justify-between font-mono text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                                      <span className="truncate">{(order.shipping_address as any).tracking_info.tracking_number}</span>
                                      <button
                                        onClick={() => handleCopyText((order.shipping_address as any).tracking_info.tracking_number, 'Tracking Number')}
                                        className="text-gray-400 hover:text-primary ml-1"
                                        title="Copy tracking number"
                                      >
                                        <Copy className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  order.status !== 'CANCELLED' && order.status !== 'PENDING_PAYMENT' && (
                                    <button
                                      onClick={() => {
                                        setTrackingOrderId(order.id);
                                        setTrackingCarrier('Delhivery Express');
                                        setTrackingNumber('');
                                        setTrackingTargetStatus(order.status);
                                        setIsTrackingModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover font-semibold"
                                    >
                                      <Truck className="h-3 w-3" /> Add Tracking
                                    </button>
                                  )
                                )}

                                {/* Qikink POD Dispatch or Status Card */}
                                {(order.shipping_address as any)?.qikink_info ? (
                                  <div className="mt-1.5 bg-amber-50/70 border border-amber-200/80 rounded-lg p-1.5 text-[10px] space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-amber-900 flex items-center gap-0.5">
                                        <Zap className="h-3 w-3 text-amber-600" />
                                        Qikink ({(order.shipping_address as any).qikink_info.environment?.toUpperCase() || 'SANDBOX'})
                                      </span>
                                      <span className="font-mono text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">
                                        {(order.shipping_address as any).qikink_info.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between font-mono text-[9px] text-gray-600 bg-white px-1 py-0.5 rounded border border-gray-200">
                                      <span className="truncate max-w-[100px]">{(order.shipping_address as any).qikink_info.order_id}</span>
                                      <button
                                        onClick={() => handleCopyText((order.shipping_address as any).qikink_info.order_id, 'Qikink Order ID')}
                                        className="text-gray-400 hover:text-primary ml-0.5"
                                        title="Copy Qikink Order ID"
                                      >
                                        <Copy className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={pollingQikinkOrderId === order.id}
                                      onClick={() => handlePollQikinkStatus(order)}
                                      className="w-full py-0.5 px-1 bg-white hover:bg-amber-100/50 border border-amber-200 text-amber-900 rounded font-semibold flex items-center justify-center gap-1 transition-colors"
                                      title="Poll status from Qikink API"
                                    >
                                      <RefreshCcw className={`h-2.5 w-2.5 ${pollingQikinkOrderId === order.id ? 'animate-spin' : ''}`} />
                                      <span>{pollingQikinkOrderId === order.id ? 'Polling...' : 'Sync Status'}</span>
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={dispatchingQikinkId === order.id}
                                    onClick={() => handleDispatchQikink(order)}
                                    className="w-full mt-1.5 py-1 px-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 hover:border-amber-400 text-amber-900 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors"
                                    title="Dispatch order to Qikink POD fulfillment"
                                  >
                                    <Package className="h-3 w-3 text-amber-600" />
                                    {dispatchingQikinkId === order.id ? 'Dispatching...' : 'Dispatch to Qikink'}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Payment Method & Verification */}
                            <td className="px-4 py-4 align-top text-xs whitespace-nowrap">
                              <div className="space-y-1.5">
                                {/* Payment Method Badge */}
                                {order.shipping_address?.paymentMethod === 'Razorpay' || (order.shipping_address as any)?.paymentId ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                      <CreditCard className="h-2.5 w-2.5" /> Razorpay
                                    </span>
                                    {order.shipping_address?.paymentId && (
                                      <button
                                        onClick={() => handleCopyText(order.shipping_address.paymentId!, 'Payment ID')}
                                        className="block text-[9px] font-mono text-blue-700 hover:underline truncate max-w-[130px]"
                                        title="Click to copy Razorpay Payment ID"
                                      >
                                        ID: {order.shipping_address.paymentId}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      <QrCode className="h-2.5 w-2.5" /> Direct UPI QR
                                    </span>
                                    {order.shipping_address?.transactionId && (
                                      <button
                                        onClick={() => handleCopyText(order.shipping_address.transactionId!, 'Transaction ID')}
                                        className="block text-[9px] font-mono text-amber-700 hover:underline truncate max-w-[130px]"
                                        title="Click to copy Transaction ID"
                                      >
                                        TXID: {order.shipping_address.transactionId}
                                      </button>
                                    )}
                                    {order.payment_proof?.screenshot_url && (
                                      <a
                                        href={order.payment_proof.screenshot_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline font-bold"
                                      >
                                        <ExternalLink className="h-2.5 w-2.5" /> View Proof
                                      </a>
                                    )}
                                  </div>
                                )}

                                {/* Payment Status Badge */}
                                <div>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded uppercase text-[10px] font-extrabold ${
                                    order.payment_status === 'PAID' || order.payment_status === 'COMPLETED'
                                      ? 'text-success bg-success/10 border-success/20'
                                      : order.payment_status === 'FAILED'
                                      ? 'text-danger bg-danger/10 border-danger/20'
                                      : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                                  }`}>
                                    {order.payment_status === 'PAID' || order.payment_status === 'COMPLETED' ? (
                                      <Check className="h-2.5 w-2.5" />
                                    ) : order.payment_status === 'FAILED' ? (
                                      <X className="h-2.5 w-2.5" />
                                    ) : (
                                      <Clock className="h-2.5 w-2.5" />
                                    )}
                                    <span>{order.payment_status || 'PENDING'}</span>
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Actions: Print Packing Slip */}
                            <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedPackingSlipOrder(order)}
                                className="text-xs px-2.5 py-1.5 flex items-center gap-1 ml-auto"
                                title="Print Packing Slip & Invoice"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Slip</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Inventory Low stock Warning */}
          {activeTab === 'inventory' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <AlertTriangle className="h-5.5 w-5.5 text-danger animate-bounce" />
                <span>Inventory & Low Stock Warnings</span>
              </h2>

              {/* Mobile Inventory List */}
              <div className="sm:hidden space-y-3">
                {products.map((prod) => (
                  <div key={prod.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-tight">{prod.name}</p>
                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{prod.slug}</p>
                      </div>
                      <span className="font-extrabold text-sm text-gray-900 flex-shrink-0">
                        ₹{prod.price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      <span className="text-xs text-gray-600 font-medium">
                        Stock: <strong className="text-gray-900 font-bold">{prod.stock}</strong> units
                      </span>
                      <div>
                        {prod.stock === 0 ? (
                          <span className="text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">OUT OF STOCK</span>
                        ) : prod.stock <= 5 ? (
                          <span className="text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">LOW STOCK</span>
                        ) : (
                          <span className="text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">HEALTHY</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Inventory Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4">Pricing</th>
                      <th className="px-6 py-4">Available Stock</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-900">{prod.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{prod.slug}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">₹{prod.price}</td>
                        <td className="px-6 py-4 font-bold">{prod.stock}</td>
                        <td className="px-6 py-4 text-xs font-bold">
                          {prod.stock === 0 ? (
                            <span className="text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded uppercase">OUT OF STOCK</span>
                          ) : prod.stock <= 5 ? (
                            <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">LOW STOCK</span>
                          ) : (
                            <span className="text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded uppercase">HEALTHY</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: Questions Panel */}
          {activeTab === 'questions' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <MessageSquare className="h-5.5 w-5.5 text-secondary" />
                <span>Customer Questions</span>
              </h2>

              <div className="space-y-4">
                {questions.length === 0 ? (
                  <p className="text-gray-500 italic text-sm">No questions asked by customers yet.</p>
                ) : (
                  questions.map((q) => (
                    <div key={q.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider text-secondary">Question Details:</p>
                          <p className="text-sm font-semibold text-gray-900">"{q.question}"</p>
                          <p className="text-[10px] text-gray-500">Asked on: {new Date(q.created_at).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-gray-500 hover:text-danger p-1"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      <div className="space-y-2 border-t border-gray-200 pt-3">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider text-primary">Answer Details:</p>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = (e.currentTarget.elements.namedItem('answerInput') as HTMLInputElement).value;
                            handleAnswerQuestion(q.id, val);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            name="answerInput"
                            defaultValue={q.answer || ''}
                            placeholder="Type response answer..."
                            className="flex-grow px-3 py-1.5 rounded-lg text-xs bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-dark"
                          >
                            Answer
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 7: Reviews Moderation & Management */}
          {activeTab === 'reviews' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              {/* Header & Main Actions */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center space-x-2">
                    <Star className="h-6 w-6 text-yellow-500 fill-current" />
                    <span>Reviews & Social Proof Hub</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage customer reviews, moderate ratings, or upload verified bulk reviews via JSON equally distributed across products.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5">
                  {reviews.length > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await syncReviewsMultiChannel(reviews);
                          alert(`🎉 Cloud Sync Successful!\n\n• ${reviews.length} reviews broadcast to the database.\n• Status: ${res.directDbSuccess ? 'Direct DB & Cloud Sync Active' : 'Cloud Broadcast Active (Visible on all devices)'}`);
                        } catch (err: any) {
                          alert(`Sync notice: ${err?.message || err}`);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition border border-emerald-300 shadow-sm"
                      title="Broadcast all reviews to cloud DB so all devices see them immediately"
                    >
                      <RefreshCcw className="h-4 w-4 text-emerald-600" />
                      <span>Sync {reviews.length} Reviews to Cloud Now</span>
                    </button>
                  )}

                  <button
                    onClick={downloadSampleReviewsJson}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition border border-gray-300 shadow-sm"
                    title="Download ready-to-use sample JSON template"
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                    <span>Sample JSON Template</span>
                  </button>

                  <button
                    onClick={() => {
                      setJsonReviewError(null);
                      setIsReviewImportModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs font-black rounded-xl shadow-md transition transform hover:-translate-y-0.5"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Import Fake Reviews (JSON)</span>
                  </button>
                </div>
              </div>

              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-xl border border-gray-200">
                  <p className="text-[10px] font-bold uppercase text-gray-500">Total Reviews</p>
                  <p className="text-xl font-black text-gray-900 mt-0.5">{reviewStats.total}</p>
                </div>
                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
                  <p className="text-[10px] font-bold uppercase text-amber-700">Average Rating</p>
                  <p className="text-xl font-black text-amber-900 mt-0.5 flex items-center gap-1">
                    {reviewStats.avg} <Star className="h-4 w-4 fill-amber-500 text-amber-500 inline" />
                  </p>
                </div>
                <div className="bg-yellow-50/60 p-3 rounded-xl border border-yellow-200/60">
                  <p className="text-[10px] font-bold uppercase text-yellow-700">5-Star Reviews</p>
                  <p className="text-xl font-black text-yellow-900 mt-0.5">{reviewStats.count5}</p>
                </div>
                <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200/60">
                  <p className="text-[10px] font-bold uppercase text-blue-700">4-Star Reviews</p>
                  <p className="text-xl font-black text-blue-900 mt-0.5">{reviewStats.count4}</p>
                </div>
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/60">
                  <p className="text-[10px] font-bold uppercase text-emerald-700">3-Star Reviews</p>
                  <p className="text-xl font-black text-emerald-900 mt-0.5">{reviewStats.count3}</p>
                </div>
                <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200/60 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-purple-700">Approved / Live</p>
                    <p className="text-xl font-black text-purple-900 mt-0.5">{reviewStats.approved}</p>
                  </div>
                  {reviewStats.pending > 0 && (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded mt-1 inline-block w-fit">
                      {reviewStats.pending} Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={reviewSearchQuery}
                    onChange={(e) => setReviewSearchQuery(e.target.value)}
                    placeholder="Search customer, comment or product..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-red-500"
                  />
                  {reviewSearchQuery && (
                    <button
                      onClick={() => setReviewSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={reviewFilterRating}
                    onChange={(e) => setReviewFilterRating(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-red-500"
                  >
                    <option value="ALL">All Ratings (3 - 5 Stars)</option>
                    <option value="5">5 Stars Only</option>
                    <option value="4">4 Stars Only</option>
                    <option value="3">3 Stars Only</option>
                  </select>
                </div>

                <div>
                  <select
                    value={reviewFilterStatus}
                    onChange={(e) => setReviewFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-red-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="APPROVED">Approved Only</option>
                    <option value="PENDING">Pending Only</option>
                    <option value="REJECTED">Rejected Only</option>
                  </select>
                </div>

                <div>
                  <select
                    value={reviewFilterProduct}
                    onChange={(e) => setReviewFilterProduct(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-red-500 truncate"
                  >
                    <option value="ALL">All Products ({products.length})</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name.length > 35 ? p.name.substring(0, 35) + '...' : p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Review Count Info & Bulk Clear Option */}
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>
                  Showing <strong className="text-gray-900">{filteredReviews.length}</strong> of{' '}
                  <strong className="text-gray-900">{reviews.length}</strong> reviews
                </span>
                {reviews.length > 0 && (
                  <button
                    onClick={handleBulkClearReviews}
                    className="text-[11px] text-red-600 hover:text-red-700 hover:underline font-semibold"
                  >
                    Clear Cached Reviews
                  </button>
                )}
              </div>

              {/* Mobile Reviews Cards List */}
              <div className="sm:hidden space-y-3">
                {filteredReviews.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-500 italic">
                    No reviews found matching current filter.
                  </div>
                ) : (
                  filteredReviews.map((rev) => {
                    const linkedProduct = products.find((p) => p.id === rev.product_id);
                    return (
                      <div key={rev.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3 shadow-xs">
                        {/* Linked Product Info */}
                        {linkedProduct ? (
                          <div className="flex items-center gap-2.5 pb-2 border-b border-gray-200">
                            {linkedProduct.main_image_url ? (
                              <img
                                src={linkedProduct.main_image_url}
                                alt={linkedProduct.name}
                                className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                <ShoppingBag className="h-4 w-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-gray-900 truncate">{linkedProduct.name}</p>
                              <a
                                href={`/product/${linkedProduct.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                              >
                                View Live Product <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic">Product ID: {rev.product_id}</p>
                        )}

                        {/* Customer & Rating */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900 text-xs">{rev.user_name}</p>
                            {rev.verified_purchase && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Verified Buyer
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 font-bold text-yellow-500 text-xs">
                            {Array.from({ length: rev.rating || 5 }).map((_, idx) => (
                              <Star key={idx} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            ))}
                            <span className="ml-1 text-gray-600 text-[11px]">({rev.rating})</span>
                          </div>
                        </div>

                        {/* Review Content */}
                        <p className="text-xs text-gray-700 bg-white p-3 rounded-xl border border-gray-200 italic leading-relaxed">
                          "{rev.review_text}"
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <span
                            className={`px-2 py-0.5 border rounded uppercase text-[10px] font-bold ${
                              rev.status === 'APPROVED'
                                ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                                : rev.status === 'REJECTED'
                                ? 'text-red-700 border-red-300 bg-red-50'
                                : 'text-amber-700 border-amber-300 bg-amber-50'
                            }`}
                          >
                            {rev.status}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleModerateReview(rev.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-300 text-xs font-bold flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleModerateReview(rev.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-300 text-xs font-bold flex items-center gap-1"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                            <button
                              onClick={() => handleDeleteReview(rev.id)}
                              className="p-1.5 bg-gray-200 text-gray-600 hover:text-red-600 rounded-lg"
                              title="Delete permanently"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Reviews Table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3.5">Target Product</th>
                      <th className="px-5 py-3.5">Customer</th>
                      <th className="px-5 py-3.5">Rating</th>
                      <th className="px-5 py-3.5">Review Message</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredReviews.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-xs text-gray-500 italic bg-white">
                          No reviews found matching the selected filter or search term.
                        </td>
                      </tr>
                    ) : (
                      filteredReviews.map((rev) => {
                        const linkedProduct = products.find((p) => p.id === rev.product_id);
                        return (
                          <tr key={rev.id} className="hover:bg-gray-50/80 transition-colors">
                            {/* Product Info */}
                            <td className="px-5 py-3.5 text-xs max-w-xs">
                              {linkedProduct ? (
                                <div className="flex items-center gap-2.5">
                                  {linkedProduct.main_image_url ? (
                                    <img
                                      src={linkedProduct.main_image_url}
                                      alt={linkedProduct.name}
                                      className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                      <ShoppingBag className="h-4 w-4 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-gray-900 truncate max-w-[180px]">{linkedProduct.name}</p>
                                    <a
                                      href={`/product/${linkedProduct.slug}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-red-600 hover:underline flex items-center gap-1"
                                    >
                                      View Product <ExternalLink className="h-2.5 w-2.5" />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-400 font-mono">ID: {rev.product_id.substring(0, 8)}...</span>
                              )}
                            </td>

                            {/* Customer */}
                            <td className="px-5 py-3.5 text-xs">
                              <p className="font-bold text-gray-900">{rev.user_name}</p>
                              {rev.verified_purchase && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  Verified Buyer
                                </span>
                              )}
                            </td>

                            {/* Rating */}
                            <td className="px-5 py-3.5 text-xs">
                              <div className="flex items-center gap-1 font-bold text-yellow-500">
                                {Array.from({ length: rev.rating || 5 }).map((_, idx) => (
                                  <Star key={idx} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                ))}
                                <span className="ml-1 text-gray-700 text-xs font-bold">({rev.rating})</span>
                              </div>
                            </td>

                            {/* Comment */}
                            <td className="px-5 py-3.5 text-xs max-w-sm">
                              <p className="text-gray-800 line-clamp-2 italic" title={rev.review_text}>
                                "{rev.review_text}"
                              </p>
                            </td>

                            {/* Date */}
                            <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                              {rev.created_at ? new Date(rev.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              }) : 'Recent'}
                            </td>

                            {/* Status */}
                            <td className="px-5 py-3.5 text-xs font-bold whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 border rounded uppercase text-[10px] ${
                                  rev.status === 'APPROVED'
                                    ? 'text-emerald-700 border-emerald-300 bg-emerald-50'
                                    : rev.status === 'REJECTED'
                                    ? 'text-red-700 border-red-300 bg-red-50'
                                    : 'text-amber-700 border-amber-300 bg-amber-50'
                                }`}
                              >
                                {rev.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-3.5 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => handleModerateReview(rev.id, 'APPROVED')}
                                className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition"
                                title="Approve Review"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleModerateReview(rev.id, 'REJECTED')}
                                className="p-1.5 bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition"
                                title="Reject Review"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteReview(rev.id)}
                                className="p-1.5 bg-gray-100 text-gray-500 hover:text-red-600 rounded-lg border border-gray-200 hover:bg-gray-200 transition"
                                title="Delete Permanently"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


          {/* TAB 8: Subscribers List */}
          {activeTab === 'subscribers' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Mail className="h-5.5 w-5.5 text-secondary-light" />
                  <span>Newsletter Drops List ({subscribers.length})</span>
                </h2>
                <Button size="sm" variant="outline" onClick={exportSubscribersCSV}>
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Subscriber Email</th>
                      <th className="px-6 py-4">Subscribed Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold text-gray-900 text-sm">{sub.email}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(sub.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: Replacement Requests */}
          {activeTab === 'replacements' && (() => {
            const handleUpdateReplacement = async (id: string, status: string, adminNotes?: string) => {
              // Try DB first
              try {
                const { error } = await supabase.from('replacement_requests').update({ status, admin_notes: adminNotes || null }).eq('id', id);
                if (error) throw error;
              } catch (_) {}
              // Always update localStorage
              const stored = JSON.parse(localStorage.getItem('animemaze_replacement_requests') || '[]');
              const updated = stored.map((r: any) => r.id === id ? { ...r, status, admin_notes: adminNotes || null } : r);
              localStorage.setItem('animemaze_replacement_requests', JSON.stringify(updated));
              setReplacementRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any, admin_notes: adminNotes || null } : r));
            };

            const statusColor = (s: string) => {
              switch (s) {
                case 'PENDING': return 'text-amber-400 bg-amber-400/10 border-amber-400/25';
                case 'APPROVED': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25';
                case 'PROCESSING': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/25';
                case 'REJECTED': return 'text-red-400 bg-red-400/10 border-red-400/25';
                case 'RESOLVED': return 'text-green-400 bg-green-400/10 border-green-400/25';
                default: return 'text-gray-400 bg-gray-400/10 border-gray-400/25';
              }
            };

            return (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                    <RefreshCcw className="h-5 w-5 text-amber-400" />
                    <span>Replacement Requests</span>
                    {replacementRequests.filter(r => r.status === 'PENDING').length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-extrabold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {replacementRequests.filter(r => r.status === 'PENDING').length} New
                      </span>
                    )}
                  </h2>
                </div>

                {replacementRequests.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 italic text-sm">
                    No replacement requests yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replacementRequests.map((req) => (
                      <div key={req.id} className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-gray-500">Request ID: <span className="font-bold text-gray-300">{req.id}</span></p>
                            <p className="text-xs text-gray-500">Order ID: <span className="font-bold text-gray-300">{req.order_id}</span></p>
                            <p className="text-xs text-gray-400">{new Date(req.created_at).toLocaleString()}</p>
                          </div>
                          <span className={`self-start text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border ${statusColor(req.status)}`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Reason</p>
                            <p className="text-gray-900 font-medium">{req.reason}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-gray-300 text-xs leading-relaxed">{req.description}</p>
                          </div>
                        </div>

                        {req.photo_url && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Attached Photo</p>
                            <a href={req.photo_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <img src={req.photo_url} alt="Replacement proof" className="w-24 h-24 object-cover rounded-xl border border-gray-200 hover:border-primary/50 transition-all" />
                            </a>
                          </div>
                        )}

                        {req.admin_notes && (
                          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Admin Notes</p>
                            <p className="text-sm text-gray-600">{req.admin_notes}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-200">
                          <select
                            value={req.status}
                            onChange={(e) => handleUpdateReplacement(req.id, e.target.value)}
                            className="bg-white border border-gray-300 text-xs text-gray-900 rounded-lg py-2 px-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            {['PENDING', 'APPROVED', 'PROCESSING', 'RESOLVED', 'REJECTED'].map(s => (
                              <option key={s} value={s} className="bg-surface">{s}</option>
                            ))}
                          </select>

                          <button
                            onClick={() => {
                              const notes = window.prompt('Add admin note (optional):', req.admin_notes || '');
                              if (notes !== null) handleUpdateReplacement(req.id, req.status, notes);
                            }}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-xs text-gray-700 hover:text-gray-900 rounded-lg transition-all"
                          >
                            Add Note
                          </button>

                          <button
                            onClick={() => handleUpdateReplacement(req.id, 'APPROVED')}
                            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-400 rounded-lg transition-all"
                          >
                            ✓ Approve
                          </button>

                          <button
                            onClick={() => handleUpdateReplacement(req.id, 'REJECTED')}
                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs text-red-400 rounded-lg transition-all"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB: Coupon Management */}
          {activeTab === 'coupons' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                  <Tag className="h-5 w-5 text-emerald-400" />
                  <span>Promo Coupons</span>
                  <span className="ml-2 text-xs text-gray-400 font-normal">({coupons.filter(c => c.active).length} active)</span>
                </h2>
                <Button size="sm" onClick={() => {
                  setEditingCoupon(null);
                  setCouponForm({ code: '', type: 'PERCENT', value: 0, minOrder: 0, active: true });
                  setIsCouponModalOpen(true);
                }}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Coupon
                </Button>
              </div>

              {/* Mobile Coupons List */}
              <div className="sm:hidden space-y-3">
                {coupons.map((coupon) => (
                  <div key={coupon.code} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-gray-900 bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-xs font-mono tracking-wider shadow-sm">
                        {coupon.code}
                      </span>
                      <button
                        onClick={() => handleToggleCoupon(coupon.code)}
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border transition-all ${
                          coupon.active !== false
                            ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                            : 'text-red-500 bg-red-50 border-red-200'
                        }`}
                      >
                        {coupon.active !== false ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-700">
                      <span>Discount: <strong className="font-bold text-gray-900">{coupon.type === 'PERCENT' ? `${coupon.value}%` : `₹${coupon.value}`}</strong></span>
                      <span className="text-gray-500 text-[11px]">{coupon.minOrder > 0 ? `Min ₹${coupon.minOrder}` : 'No min'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setEditingCoupon(coupon);
                          setCouponForm({
                            code: coupon.code,
                            type: coupon.type,
                            value: coupon.value,
                            minOrder: coupon.minOrder || 0,
                            active: coupon.active !== false
                          });
                          setIsCouponModalOpen(true);
                        }}
                        className="px-3 py-1 bg-white border border-gray-300 text-primary text-xs font-bold rounded-lg shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon.code)}
                        className="p-1 bg-white border border-gray-300 text-danger rounded-lg shadow-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Coupons Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-400 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Value</th>
                      <th className="px-6 py-4">Min Order</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {coupons.map((coupon) => (
                      <tr key={coupon.code} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg text-xs tracking-wider">{coupon.code}</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <span className={`px-2 py-0.5 rounded border font-bold uppercase ${
                            coupon.type === 'PERCENT' ? 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                          }`}>
                            {coupon.type === 'PERCENT' ? 'Percentage' : 'Fixed Amount'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">
                          {coupon.type === 'PERCENT' ? `${coupon.value}%` : `₹${coupon.value}`}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {coupon.minOrder > 0 ? `₹${coupon.minOrder}` : 'None'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleCoupon(coupon.code)}
                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase border cursor-pointer transition-all ${
                              coupon.active !== false
                                ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25 hover:bg-emerald-400/20'
                                : 'text-red-400 bg-red-400/10 border-red-400/25 hover:bg-red-400/20'
                            }`}
                          >
                            {coupon.active !== false ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingCoupon(coupon);
                              setCouponForm({
                                code: coupon.code,
                                type: coupon.type,
                                value: coupon.value,
                                minOrder: coupon.minOrder || 0,
                                active: coupon.active !== false
                              });
                              setIsCouponModalOpen(true);
                            }}
                            className="p-1.5 bg-gray-100 border border-gray-300 hover:border-primary text-primary rounded-lg"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.code)}
                            className="p-1.5 bg-gray-100 border border-gray-200 hover:border-danger/40 text-danger rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-400 space-y-1">
                <p className="font-bold text-gray-300">How Coupons Work:</p>
                <p>• <strong>Percentage</strong> coupons apply a % discount on the cart subtotal (before shipping).</p>
                <p>• <strong>Fixed Amount</strong> coupons subtract a flat ₹ amount from the subtotal.</p>
                <p>• Coupons are separate from the Free Shipping logic (orders ≥₹999 ship free automatically).</p>
                <p>• Disable a coupon to stop it from being used without deleting it.</p>
              </div>
            </div>
          )}

          {/* TAB: Announcement Bar */}
          {activeTab === 'announcement' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                <Megaphone className="h-5 w-5 text-amber-400" />
                <span>Announcement Bar</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Announcement Message
                  </label>
                  <textarea
                    rows={3}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Enter the announcement text that appears at the top of the site..."
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Use emojis like 🎉 🚚 🔥 to make it eye-catching. Leave empty to hide the bar.
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Live Preview
                  </label>
                  {announcementText ? (
                    <div className="bg-primary text-white text-center py-2.5 px-4 text-xs font-bold tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm">
                      <div className="animate-pulse w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></div>
                      <span>{announcementText}</span>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 italic text-sm border border-dashed border-gray-200 rounded-xl">
                      Announcement bar is hidden (empty message)
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSaveAnnouncement}>
                    Save & Publish
                  </Button>
                  <Button variant="outline" onClick={handleClearAnnouncement}>
                    Clear Announcement
                  </Button>
                </div>

                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-400 space-y-1">
                  <p className="font-bold text-gray-300">Tips:</p>
                  <p>• Keep announcements short and impactful (1-2 sentences max).</p>
                  <p>• Mention active coupon codes so customers see them immediately.</p>
                  <p>• The bar appears at the very top of every page, above the navigation.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Hero Main Ad & Banner Editor */}
          {activeTab === 'hero_banner' && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                    <Zap className="h-5.5 w-5.5 text-primary" />
                    <span>Hero Section & Main Ad Editor</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Manage the main homepage showcase ad (Ryōshin watch / grail item card), banner copy, features, image, and call-to-action button.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Button variant="outline" size="sm" onClick={handleResetHero} disabled={savingHero}>
                    <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Reset to Default Ad
                  </Button>
                  <Button size="sm" onClick={handleSaveHero} disabled={savingHero}>
                    {savingHero ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Saving...
                      </span>
                    ) : (
                      'Save & Publish Hero Ad'
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Editor (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Hero Header Text */}
                  <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>1. Hero Section Headline & Header</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <Input
                        label="Top Tag / Pill"
                        type="text"
                        placeholder="e.g. Premium Japanese Streetwear"
                        value={heroConfig.hero_top_badge}
                        onChange={(e) => setHeroConfig({ ...heroConfig, hero_top_badge: e.target.value })}
                      />
                      <Input
                        label="Main Title / Brand Name"
                        type="text"
                        placeholder="e.g. Tryvoal : Anime store"
                        value={heroConfig.hero_main_title}
                        onChange={(e) => setHeroConfig({ ...heroConfig, hero_main_title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Hero Subtitle / Description
                      </label>
                      <textarea
                        rows={2}
                        value={heroConfig.hero_sub_title}
                        onChange={(e) => setHeroConfig({ ...heroConfig, hero_sub_title: e.target.value })}
                        placeholder="Authentic apparel, cursed accessories, and oversized manga graphics..."
                        className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary resize-none"
                      />
                    </div>
                  </div>

                  {/* Main Ad Image & Media */}
                  <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>2. Main Ad Image / Graphic</span>
                    </h3>
                    <ImageUploadZone
                      mode="single"
                      label="Hero Main Ad Image (Upload)"
                      required
                      description="Upload hero ad image directly into Supabase Storage. (Aspect ratio ~16:9 recommended)."
                      value={heroConfig.image_url}
                      onChange={(url) => setHeroConfig({ ...heroConfig, image_url: url })}
                      bucket="product-images"
                      folder="hero"
                    />
                    <Input
                      label="Or Direct Image URL"
                      type="text"
                      placeholder="e.g. /anime_watch_hero.jpg or https://..."
                      value={heroConfig.image_url}
                      onChange={(e) => setHeroConfig({ ...heroConfig, image_url: e.target.value })}
                    />
                  </div>

                  {/* Showcase Card Details */}
                  <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>3. Showcase Card Text & Product Specs</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <Input
                        label="Card Top Badge"
                        type="text"
                        placeholder="e.g. LIMITED DROP // RYŌSHIN ARCANE"
                        value={heroConfig.badge}
                        onChange={(e) => setHeroConfig({ ...heroConfig, badge: e.target.value })}
                      />
                      <Input
                        label="Tagline / Piece Count"
                        type="text"
                        placeholder="e.g. Only 250 Pieces"
                        value={heroConfig.tagline}
                        onChange={(e) => setHeroConfig({ ...heroConfig, tagline: e.target.value })}
                      />
                      <Input
                        label="Item Sub-Label"
                        type="text"
                        placeholder="e.g. RYŌSHIN ARCANE TIMEPIECE"
                        value={heroConfig.item_label}
                        onChange={(e) => setHeroConfig({ ...heroConfig, item_label: e.target.value })}
                      />
                      <Input
                        label="Availability / Status Text"
                        type="text"
                        placeholder="e.g. In Stock & Ready to Ship"
                        value={heroConfig.status_text}
                        onChange={(e) => setHeroConfig({ ...heroConfig, status_text: e.target.value })}
                      />
                    </div>

                    <Input
                      label="Showcase Headline / Card Title"
                      type="text"
                      placeholder="e.g. The Arcane Chronicle: Unleash The Power"
                      value={heroConfig.title}
                      onChange={(e) => setHeroConfig({ ...heroConfig, title: e.target.value })}
                    />

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                        Card Detailed Description
                      </label>
                      <textarea
                        rows={3}
                        value={heroConfig.description}
                        onChange={(e) => setHeroConfig({ ...heroConfig, description: e.target.value })}
                        placeholder="Ultra-detailed custom mechanical anime timepiece..."
                        className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <Input
                        label="Highlight Feature 1"
                        type="text"
                        placeholder="e.g. ⚡ Ultra-Detailed Mechanical Cut"
                        value={heroConfig.feature_1}
                        onChange={(e) => setHeroConfig({ ...heroConfig, feature_1: e.target.value })}
                      />
                      <Input
                        label="Highlight Feature 2"
                        type="text"
                        placeholder="e.g. 🔥 Exclusive Online Drop"
                        value={heroConfig.feature_2}
                        onChange={(e) => setHeroConfig({ ...heroConfig, feature_2: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Call to Action Button */}
                  <div className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>4. Call-to-Action (CTA) Button</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <Input
                        label="Button Label"
                        type="text"
                        placeholder="e.g. EXPLORE STORE DROPS"
                        value={heroConfig.button_text}
                        onChange={(e) => setHeroConfig({ ...heroConfig, button_text: e.target.value })}
                      />
                      <Input
                        label="Target Link URL"
                        type="text"
                        placeholder="e.g. /shop or /products/..."
                        value={heroConfig.button_link}
                        onChange={(e) => setHeroConfig({ ...heroConfig, button_link: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleSaveHero} disabled={savingHero} className="flex-1">
                      {savingHero ? 'Saving Hero Ad...' : 'Save & Publish Hero Ad'}
                    </Button>
                    <Button variant="outline" onClick={handleResetHero} disabled={savingHero}>
                      Reset to Default
                    </Button>
                  </div>
                </div>

                {/* Live Preview (5 cols) */}
                <div className="lg:col-span-5">
                  <div className="sticky top-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Homepage Live Preview</span>
                      </label>
                      <span className="text-[11px] text-gray-400 font-mono">Dark Theme Display</span>
                    </div>

                    <div className="bg-brand-black text-white p-5 rounded-2xl border border-neutral-800 shadow-2xl space-y-4">
                      {/* Top Badge */}
                      <div className="text-center">
                        {heroConfig.hero_top_badge && (
                          <span className="inline-block bg-red-600/90 text-white text-[10px] font-bold tracking-widest uppercase px-3 py-0.5 rounded-full mb-2 shadow-sm border border-red-500/30">
                            {heroConfig.hero_top_badge}
                          </span>
                        )}
                        <h4 className="text-xl font-black uppercase tracking-tight font-mono">
                          {heroConfig.hero_main_title || 'Tryvoal : Anime store'}
                        </h4>
                        {heroConfig.hero_sub_title && (
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                            {heroConfig.hero_sub_title}
                          </p>
                        )}
                      </div>

                      {/* Showcase Card Preview */}
                      <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-xl text-left">
                        <div className="relative aspect-[16/9] overflow-hidden bg-black">
                          <img
                            src={heroConfig.image_url || '/anime_watch_hero.jpg'}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/anime_watch_hero.jpg';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
                          {heroConfig.badge && (
                            <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black tracking-widest px-2 py-0.5 rounded uppercase">
                              {heroConfig.badge}
                            </span>
                          )}
                          {heroConfig.tagline && (
                            <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold text-neutral-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs">
                              {heroConfig.tagline}
                            </span>
                          )}
                        </div>

                        <div className="p-3.5 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-neutral-400">
                            <span className="font-mono text-red-500 font-bold uppercase">{heroConfig.item_label}</span>
                            <span className="text-emerald-400 font-semibold">{heroConfig.status_text}</span>
                          </div>

                          <h5 className="text-sm font-black text-white uppercase tracking-tight">
                            {heroConfig.title}
                          </h5>

                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                            {heroConfig.description}
                          </p>

                          {(heroConfig.feature_1 || heroConfig.feature_2) && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {heroConfig.feature_1 && (
                                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">
                                  {heroConfig.feature_1}
                                </span>
                              )}
                              {heroConfig.feature_2 && (
                                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700">
                                  {heroConfig.feature_2}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="pt-2">
                            <div className="w-full bg-red-600 text-white text-center py-2 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5">
                              <span>{heroConfig.button_text || 'EXPLORE STORE DROPS'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-950">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Instant Auto-Sync</span>
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-800">
                        Saving publishes updates immediately to Supabase database and local storage. Any customer viewing the storefront sees the new hero image, text, and link instantly!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* PRODUCT MODAL (Add/Edit) */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-white border border-gray-200 rounded-2xl p-4 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900">
                  {editingProduct ? 'Edit Anime Merchandise' : 'Add New Anime Merchandise'}
                </h3>
                <p className="text-xs text-gray-500">
                  Configure anime universe, apparel/collectible category, material specifications, inventory, and variants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-6">
              {/* SECTION: Core Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  1. General Information & Identity
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      label="Product Name"
                      type="text"
                      required
                      placeholder="e.g. Jujutsu Kaisen Gojo Satoru Domain Expansion Oversized Hoodie"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Input
                      label="Base SKU"
                      type="text"
                      placeholder="e.g. TRV-JJK-HOOD-01"
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      Merchandise Category
                    </label>
                    <select
                      value={productForm.category_id}
                      onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} className="bg-white text-gray-900">
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      Anime Series (Sub-Category)
                    </label>
                    <select
                      value={
                        allAnimeSeries.some((s) => s.label.toLowerCase() === productForm.brand?.toLowerCase() || s.id === productForm.brand?.toLowerCase())
                          ? allAnimeSeries.find((s) => s.label.toLowerCase() === productForm.brand?.toLowerCase() || s.id === productForm.brand?.toLowerCase())?.label || ''
                          : (productForm.brand === 'TRYVOAL' || !productForm.brand ? '' : 'CUSTOM')
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM') {
                          // Keep existing custom brand text
                        } else if (val) {
                          setProductForm({ ...productForm, brand: val });
                        } else {
                          setProductForm({ ...productForm, brand: 'TRYVOAL' });
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary"
                    >
                      <option value="">Select Anime Series</option>
                      {allAnimeSeries.filter(s => s.id !== 'all').map((series) => (
                        <option key={series.id} value={series.label}>
                          {series.label} ({series.short})
                        </option>
                      ))}
                      <option value="CUSTOM">Custom / Other Anime</option>
                    </select>
                  </div>

                  <div>
                    <Input
                      label="Franchise / Universe Text"
                      type="text"
                      placeholder="e.g. Jujutsu Kaisen (JJK)"
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    />
                  </div>

                  <div>
                    <Input
                      label="Custom Slug (Optional)"
                      type="text"
                      placeholder="Auto-generated if empty"
                      value={productForm.slug}
                      onChange={(e) => setProductForm({ ...productForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Specifications & Pricing */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  2. Pricing, Stock & Specifications
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Base Price (INR ₹)"
                    type="number"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  />

                  <Input
                    label="Base Stock Quantity"
                    type="number"
                    required
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Material Composition"
                    type="text"
                    placeholder="e.g. 450GSM Heavyweight Fleece / 100% Cotton / High-Grade PVC"
                    value={productForm.material}
                    onChange={(e) => setProductForm({ ...productForm, material: e.target.value })}
                  />

                  <Input
                    label="Base Finish / Print Type"
                    type="text"
                    placeholder="e.g. Acid Wash Black / High-Density Puff Print"
                    value={productForm.finish}
                    onChange={(e) => setProductForm({ ...productForm, finish: e.target.value })}
                  />

                  <Input
                    label="Quality / Guarantee Info"
                    type="text"
                    placeholder="e.g. 100% Replacement Guarantee on Defective Print/Fabric"
                    value={productForm.warranty_info}
                    onChange={(e) => setProductForm({ ...productForm, warranty_info: e.target.value })}
                  />

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      Shipping Fee (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0 = FREE shipping"
                        value={productForm.shipping_fee || ''}
                        onChange={(e) => setProductForm({ ...productForm, shipping_fee: Number(e.target.value) || 0 })}
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Set 0 for free shipping. This overrides the global shipping rule for this product.</p>
                  </div>
                </div>

                {/* Badges and visibility */}
                <div className="flex flex-wrap items-center gap-6 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-50/80 border border-amber-300 px-3 py-1.5 rounded-lg shadow-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(productForm.is_pinned)}
                      onChange={(e) => setProductForm({ ...productForm, is_pinned: e.target.checked })}
                      className="h-4 w-4 rounded border-amber-400 accent-amber-500"
                    />
                    <span className="flex items-center gap-1.5">
                      <Pin className="h-3.5 w-3.5 fill-amber-500 text-amber-600" />
                      Pin to Top of Shop
                    </span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.featured}
                      onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    <span>Featured Product</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.is_new_arrival}
                      onChange={(e) => setProductForm({ ...productForm, is_new_arrival: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    <span>New Arrival Badge</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-700">
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    <span>Active (Publish in Store)</span>
                  </label>
                </div>
              </div>

              {/* SECTION: Media & Description */}
              <div className="space-y-5 pt-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  3. Imagery & Catalog Content (Supabase Storage Bucket)
                </h4>

                <ImageUploadZone
                  mode="single"
                  label="Main Product Image"
                  required
                  description="Upload primary high-resolution product photography to 'product-images/products/main'."
                  value={productForm.main_image_url}
                  onChange={(url) => setProductForm({ ...productForm, main_image_url: url })}
                  bucket="product-images"
                  folder="products/main"
                />

                <ImageUploadZone
                  mode="multiple"
                  label="Additional Product Gallery Images"
                  description="Upload multiple dimensional angles, close-ups, and installation shots."
                  values={
                    productForm.additional_images
                      ? productForm.additional_images.split(',').map((s) => s.trim()).filter(Boolean)
                      : []
                  }
                  onChange={(urls) => setProductForm({ ...productForm, additional_images: urls.join(', ') })}
                  bucket="product-images"
                  folder="products/gallery"
                />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Detailed Product Description
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write detailed specifications, engineering features, dimensions, water pressure requirements, and installation advice..."
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl text-sm bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              {/* SECTION: Multi-Attribute Variant Architecture */}
              <ProductVariantEditor
                hasVariants={hasVariants}
                onHasVariantsChange={setHasVariants}
                options={optionDrafts}
                onOptionsChange={setOptionDrafts}
                variants={variantDrafts}
                onVariantsChange={setVariantDrafts}
                basePrice={Number(productForm.price) || 0}
                baseStock={Number(productForm.stock) || 0}
                baseSku={productForm.sku || ''}
                baseImageUrl={productForm.main_image_url || ''}
              />

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end pt-6 border-t border-gray-200">
                <Button variant="outline" type="button" onClick={() => setIsProductModalOpen(false)} disabled={submittingProduct} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingProduct} className="w-full sm:w-auto">
                  {submittingProduct ? 'Saving...' : (editingProduct ? 'Update Product' : 'Create Product')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MODAL (Add/Edit) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="space-y-5">
              <Input
                label="Category Name"
                type="text"
                required
                placeholder="e.g. Heavyweight Tees"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              />

              <ImageUploadZone
                mode="single"
                label="Category Image"
                required
                description="Upload category display image to 'product-images/categories'."
                value={categoryForm.image_url}
                onChange={(url) => setCategoryForm({ ...categoryForm, image_url: url })}
                bucket="product-images"
                folder="categories"
              />

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <label className="text-sm font-semibold text-gray-900 block">Enable Size Selection</label>
                  <p className="text-xs text-gray-500 mt-1">Products in this category will require size selection</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCategoryForm({ ...categoryForm, size_enabled: !categoryForm.size_enabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    categoryForm.size_enabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      categoryForm.size_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end pt-4">
                <Button variant="outline" type="button" onClick={() => setIsCategoryModalOpen(false)} disabled={submittingCategory} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={submittingCategory} className="w-full sm:w-auto">
                  {submittingCategory ? 'Saving...' : 'Submit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* COURIER TRACKING DETAILS MODAL */}
      {isTrackingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <button
              onClick={() => setIsTrackingModalOpen(false)}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full border border-gray-300 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Enter Courier Tracking Details
            </h3>

            <form onSubmit={handleSaveTracking} className="space-y-5">
              <Input
                label="Courier Carrier"
                type="text"
                required
                placeholder="e.g. Delhivery, Blue Dart, DTDC, India Post"
                value={trackingCarrier}
                onChange={(e) => setTrackingCarrier(e.target.value)}
              />

              <Input
                label="Tracking Number / Waybill ID"
                type="text"
                required
                placeholder="e.g. 1234567890"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end pt-4">
                <Button variant="outline" type="button" onClick={() => setIsTrackingModalOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  Save & Update Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COUPON MODAL (Add/Edit) */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <button
              onClick={() => {
                setIsCouponModalOpen(false);
                setEditingCoupon(null);
              }}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full border border-gray-300 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
            
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              {editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}
            </h3>

            <form onSubmit={handleCouponSubmit} className="space-y-5">
              <Input
                label="Coupon Code"
                type="text"
                required
                disabled={!!editingCoupon}
                placeholder="e.g. DISCOUNT20"
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Coupon Type
                </label>
                <select
                  value={couponForm.type}
                  onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as 'PERCENT' | 'FIXED' })}
                  className="w-full px-4 py-2.5 rounded-lg text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="PERCENT">Percentage (%)</option>
                  <option value="FIXED">Fixed Amount (₹)</option>
                </select>
              </div>

              <Input
                label={couponForm.type === 'PERCENT' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
                type="number"
                required
                min={1}
                max={couponForm.type === 'PERCENT' ? 100 : undefined}
                value={couponForm.value}
                onChange={(e) => setCouponForm({ ...couponForm, value: Number(e.target.value) })}
              />

              <Input
                label="Minimum Order Subtotal (₹)"
                type="number"
                min={0}
                value={couponForm.minOrder}
                onChange={(e) => setCouponForm({ ...couponForm, minOrder: Number(e.target.value) })}
              />

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="couponActiveCheckbox"
                  checked={couponForm.active}
                  onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
                  className="h-4.5 w-4.5 rounded border-gray-200 accent-primary"
                />
                <label htmlFor="couponActiveCheckbox" className="text-xs font-semibold uppercase tracking-wider text-gray-400 cursor-pointer">
                  Coupon Active
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end pt-4">
                <Button variant="outline" type="button" onClick={() => {
                  setIsCouponModalOpen(false);
                  setEditingCoupon(null);
                }} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto">
                  {editingCoupon ? 'Save Changes' : 'Create Coupon'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PACKING SLIP & DISPATCH INVOICE MODAL */}
      {selectedPackingSlipOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white border border-gray-200 rounded-2xl shadow-2xl my-4 sm:my-8 overflow-hidden">
            {/* Modal Controls (Hidden in Print) */}
            <div className="no-print flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                <h3 className="text-sm sm:text-base font-bold text-gray-900">Packing Slip & Invoice</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 text-xs">
                  <Printer className="h-4 w-4" /> Print
                </Button>
                <button
                  onClick={() => setSelectedPackingSlipOrder(null)}
                  className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div id="printable-packing-slip" className="p-4 sm:p-8 space-y-5 sm:space-y-6 text-gray-900 bg-white">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-6 gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="TRYVOAL" className="h-10 w-auto object-contain" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">TRYVOAL</h1>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mt-1">Modern Luxury Streetwear & Premium Apparel</p>
                  <p className="text-xs text-gray-500 mt-1">[Store Address Placeholder], City, State - PIN • support@example.com • +91 00000 00000</p>
                </div>
                <div className="text-right sm:text-right">
                  <span className="inline-block px-3 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-extrabold uppercase tracking-wider mb-2">
                    Packing Slip & Tax Invoice
                  </span>
                  <p className="text-xs text-gray-500 font-mono">Order ID: #{selectedPackingSlipOrder.id}</p>
                  <p className="text-xs text-gray-500">Date: {new Date(selectedPackingSlipOrder.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Two Column Address & Logistics Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-gray-400 mb-2 text-[11px]">Deliver To:</h4>
                  <p className="font-extrabold text-sm text-gray-900">{selectedPackingSlipOrder.shipping_address?.fullName}</p>
                  <p className="text-gray-700 mt-0.5">{selectedPackingSlipOrder.shipping_address?.phone} • {selectedPackingSlipOrder.shipping_address?.email}</p>
                  <p className="text-gray-700 mt-1">{selectedPackingSlipOrder.shipping_address?.address}</p>
                  {selectedPackingSlipOrder.shipping_address?.landmark && (
                    <p className="text-gray-500 italic text-[11px]">Landmark: {selectedPackingSlipOrder.shipping_address.landmark}</p>
                  )}
                  <p className="text-gray-900 font-bold mt-1">
                    {selectedPackingSlipOrder.shipping_address?.city}, {selectedPackingSlipOrder.shipping_address?.state} - {selectedPackingSlipOrder.shipping_address?.pincode}
                  </p>
                </div>
                <div className="space-y-1.5 border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-6">
                  <h4 className="font-bold uppercase tracking-wider text-gray-400 mb-2 text-[11px]">Fulfillment Details:</h4>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Status:</span>
                    <span className="font-bold text-gray-900">{selectedPackingSlipOrder.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Status:</span>
                    <span className="font-bold text-emerald-700">{selectedPackingSlipOrder.payment_status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Method:</span>
                    <span className="font-semibold text-gray-900">{selectedPackingSlipOrder.shipping_address?.paymentMethod || 'Prepaid'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Carrier / Courier:</span>
                    <span className="font-semibold text-gray-900">{selectedPackingSlipOrder.shipping_address?.tracking_info?.carrier || 'Delhivery Express'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tracking / AWB #:</span>
                    <span className="font-mono font-bold text-gray-900">{selectedPackingSlipOrder.shipping_address?.tracking_info?.tracking_number || 'Pending Dispatch'}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Item Description</th>
                      <th className="px-4 py-3">Variant / Option</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPackingSlipOrder.items?.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="px-4 py-3 font-bold text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 max-w-[200px]">
                          {item.product?.name || (item as any).product_name || 'Apparel Item'}
                        </td>
                        <td className="px-4 py-3">
                          {item.selected_variant ? (
                            <span className="font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {item.selected_variant}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Standard</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500 text-[11px]">
                          {item.variant?.sku || item.product?.sku || 'EBC-SAN'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-700">₹{item.price?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">₹{(item.price * item.quantity).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Price Calculation Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>₹{selectedPackingSlipOrder.total_amount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Insured Wooden Crate Freight:</span>
                    <span className="text-emerald-700 font-bold">FREE</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-200 pt-2">
                    <span>Grand Total:</span>
                    <span className="text-primary">₹{selectedPackingSlipOrder.total_amount?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Quality & Dispatch Signoff */}
              <div className="border-t border-gray-200 pt-4 text-[10px] text-gray-500 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-700">Quality Inspection Certificate:</p>
                  <p>All garments undergo comprehensive quality inspection for zero weave, stitching, or color defects prior to dispatch.</p>
                </div>
                <div className="text-right sm:text-right">
                  <p className="font-semibold text-gray-700">Authorized Signatory</p>
                  <p className="mt-4 text-gray-400">TRYVOAL Logistics Team</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QIKINK OPEN API CONFIGURATION MODAL */}
      {isQikinkSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl my-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Qikink Open API Settings</h3>
                  <p className="text-xs text-gray-500">Configure print-on-demand fulfillment credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQikinkSettingsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveQikinkConfig(qikinkConfigForm);
                alert(`Qikink API configuration saved! Active Mode: ${qikinkConfigForm.environment.toUpperCase()}`);
                setIsQikinkSettingsModalOpen(false);
              }}
              className="space-y-4 pt-4"
            >
              {/* Environment Toggle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Fulfillment Environment
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setQikinkConfigForm({ ...qikinkConfigForm, environment: 'sandbox', baseUrl: 'https://sandbox.qikink.com' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      qikinkConfigForm.environment === 'sandbox'
                        ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">🧪 Sandbox (Testing)</span>
                      {qikinkConfigForm.environment === 'sandbox' && <CheckCircle2 className="h-4 w-4 text-amber-600" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Simulated test orders, mock tracking, zero wallet deductions.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQikinkConfigForm({ ...qikinkConfigForm, environment: 'production', baseUrl: 'https://api.qikink.com' })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      qikinkConfigForm.environment === 'production'
                        ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">🚀 Production (Live)</span>
                      {qikinkConfigForm.environment === 'production' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Real garments printed, auto-shipped via Delhivery / BlueDart.</p>
                  </button>
                </div>
              </div>

              {/* Client ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Client ID (API Key)
                </label>
                <input
                  type="text"
                  placeholder="e.g. qk_live_abc123 or qk_test_xyz789"
                  value={qikinkConfigForm.clientId}
                  onChange={(e) => setQikinkConfigForm({ ...qikinkConfigForm, clientId: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>

              {/* Client Secret */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Client Secret / Access Token
                </label>
                <input
                  type="password"
                  placeholder="Enter Qikink client secret or access token..."
                  value={qikinkConfigForm.clientSecret}
                  onChange={(e) => setQikinkConfigForm({ ...qikinkConfigForm, clientSecret: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  API Endpoint Base URL
                </label>
                <input
                  type="text"
                  value={qikinkConfigForm.baseUrl}
                  onChange={(e) => setQikinkConfigForm({ ...qikinkConfigForm, baseUrl: e.target.value.trim() })}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Default: <code>https://sandbox.qikink.com</code> (Sandbox) or <code>https://api.qikink.com</code> (Production). Path routing to <code>/api/order/...</code> is automatically normalized.
                </p>
              </div>

              {/* Guide box */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-800">
                  <Package className="h-3.5 w-3.5 text-amber-700" /> Where to get credentials:
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Log in to <strong>dashboard.qikink.com</strong> &gt; <strong>Integrations</strong> &gt; <strong>Custom API</strong>. Generate your Client ID and Client Secret, then paste them above. In Sandbox mode, mock test dispatches work immediately even before obtaining live keys.
                </p>
              </div>

              {/* Test Connection Button & Result */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={testingQikink}
                  onClick={async () => {
                    setTestingQikink(true);
                    setQikinkTestResult(null);
                    try {
                      const res = await testQikinkConnection(qikinkConfigForm);
                      setQikinkTestResult(res);
                    } catch (err: any) {
                      setQikinkTestResult({ success: false, message: err.message || 'Test failed' });
                    } finally {
                      setTestingQikink(false);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-gray-300 hover:border-gray-400 bg-gray-50 text-gray-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 ${testingQikink ? 'animate-spin' : ''}`} />
                  {testingQikink ? 'Testing Authentication...' : 'Test Qikink API Connection'}
                </button>

                {qikinkTestResult && (
                  <div
                    className={`mt-2.5 p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2 ${
                      qikinkTestResult.success
                        ? qikinkTestResult.is_simulation
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-red-50 text-red-900 border-red-200'
                    }`}
                  >
                    {qikinkTestResult.success ? (
                      qikinkTestResult.is_simulation ? (
                        <CheckCircle2 className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      )
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{qikinkTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-3 border-t border-gray-200 justify-end">
                <Button variant="outline" type="button" onClick={() => setIsQikinkSettingsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                  Save Qikink Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANIME SUB-CATEGORY / UNIVERSE MODAL */}
      {isAnimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-2xl my-8">
            <button
              onClick={() => {
                setIsAnimeModalOpen(false);
                setEditingAnimeSeries(null);
              }}
              className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-500 hover:text-gray-900 rounded-full border border-gray-300 focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-2">
              <div className="p-2 rounded-xl bg-red-100 text-primary">
                <Tag className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {editingAnimeSeries
                  ? `Change Thumbnail / Edit "${editingAnimeSeries.label}"`
                  : 'Add Anime Franchise / Universe'}
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              {editingAnimeSeries
                ? 'Upload or change the thumbnail image, name, and acronym for this sub-category. Thumbnails immediately update on the storefront, home page cards, and filter chips.'
                : 'Create a new anime universe tag and thumbnail (e.g. Solo Leveling, Bleach, Chainsaw Man) for storefront filtering, product tagging, and home page cards.'}
            </p>

            <form onSubmit={handleSaveAnimeSeries} className="space-y-4">
              <ImageUploadZone
                mode="single"
                label="Sub-Category Thumbnail Image"
                description="Upload an anime banner or thumbnail image to 'product-images/subcategories'."
                value={animeForm.image_url}
                onChange={(url) => setAnimeForm({ ...animeForm, image_url: url })}
                bucket="product-images"
                folder="subcategories"
              />

              <Input
                label="Or Direct Image URL"
                type="url"
                placeholder="https://images.unsplash.com/... or https://..."
                value={animeForm.image_url}
                onChange={(e) => setAnimeForm({ ...animeForm, image_url: e.target.value })}
              />

              {animeForm.image_url && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <img
                    src={animeForm.image_url}
                    alt="Thumbnail preview"
                    className="w-14 h-14 object-cover rounded-xl border border-gray-300 flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.jpg'; }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900">Live Thumbnail Preview</p>
                    <p className="text-[11px] text-gray-500 truncate max-w-xs">{animeForm.image_url}</p>
                  </div>
                </div>
              )}

              <Input
                label="Anime Franchise Name"
                type="text"
                required
                placeholder="e.g. Jujutsu Kaisen, Berserk, Bleach"
                value={animeForm.label}
                onChange={(e) => setAnimeForm({ ...animeForm, label: e.target.value })}
              />

              <Input
                label="Short Code / Acronym (Optional)"
                type="text"
                placeholder="e.g. JJK, BLC, BRSK (default: 3 letters)"
                value={animeForm.short}
                onChange={(e) => setAnimeForm({ ...animeForm, short: e.target.value.toUpperCase() })}
              />

              <Input
                label="Unique Slug / Tag ID (Optional)"
                type="text"
                disabled={Boolean(editingAnimeSeries)}
                placeholder="e.g. jjk, berserk (auto-generated if empty)"
                value={animeForm.id}
                onChange={(e) => setAnimeForm({ ...animeForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              />
              {editingAnimeSeries && (
                <p className="text-[10px] text-gray-400 -mt-2">
                  * Unique slug cannot be changed when editing to preserve product associations.
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end pt-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsAnimeModalOpen(false);
                    setEditingAnimeSeries(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingAnime}
                  className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  {savingAnime ? 'Saving...' : editingAnimeSeries ? 'Save Changes' : 'Save Anime Universe'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK REVIEWS JSON IMPORT MODAL */}
      {isReviewImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-2xl p-5 sm:p-7 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    Bulk Import Fake Reviews (JSON)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upload a JSON file to distribute authentic-looking reviews equally across products with zero repetition.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (importingReviews) return;
                  setIsReviewImportModalOpen(false);
                  setJsonReviewError(null);
                }}
                disabled={importingReviews}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-5 space-y-5 flex-1 pr-1">
              {/* Requirements & Rule Info Box */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  JSON Structure & Distribution Rules:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800/90">
                  <li>
                    Each item must contain: <strong>NAME</strong> (string), <strong>MESSAGE</strong> (string), and <strong>RATING</strong> (number from 3 to 5).
                  </li>
                  <li>
                    <strong>Equal & Unique Distribution:</strong> If you upload 100 reviews and have 20 products, each product receives exactly 5 unique reviews. No review is repeated.
                  </li>
                  <li>
                    Any rating below 3 is automatically clamped to 3, and ratings above 5 are clamped to 5.
                  </li>
                </ul>
              </div>

              {/* File Upload Zone */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Select JSON File
                </label>
                <div className="border-2 border-dashed border-gray-300 hover:border-red-400 rounded-2xl p-6 text-center bg-gray-50/50 hover:bg-red-50/20 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleReviewJsonFileUpload}
                    disabled={importingReviews}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                    <div className="p-3 bg-red-100/70 text-red-600 rounded-full">
                      <FileText className="h-6 w-6" />
                    </div>
                    {jsonReviewFileName ? (
                      <div>
                        <p className="text-xs font-bold text-gray-900">{jsonReviewFileName}</p>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          ✓ File selected ({jsonReviewList.length} valid reviews parsed)
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold text-gray-800">
                          Click to browse or drag and drop your <span className="text-red-600">.json</span> file
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">Accepts standard JSON array format</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 px-1">
                  <span className="text-[11px] text-gray-400">Need a template?</span>
                  <button
                    type="button"
                    onClick={downloadSampleReviewsJson}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Download Sample JSON Template
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {jsonReviewError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{jsonReviewError}</span>
                </div>
              )}

              {/* Config & Live Distribution Preview (only shown once valid reviews are loaded) */}
              {jsonReviewList.length > 0 && (
                <div className="space-y-4 pt-2 border-t border-gray-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-red-600" />
                    Distribution & Target Settings
                  </h4>

                  {/* Target Scope */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">Distribute Reviews Across:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewTargetScope('ALL')}
                        className={`p-3 text-left rounded-xl border text-xs font-bold transition ${
                          reviewTargetScope === 'ALL'
                            ? 'border-red-600 bg-red-50/70 text-red-700 ring-2 ring-red-500/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-black">All Active Products</p>
                        <p className="text-[10px] font-normal text-gray-500 mt-0.5">
                          {products.filter((p) => p.is_active !== false).length} active products
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewTargetScope('CATEGORY')}
                        className={`p-3 text-left rounded-xl border text-xs font-bold transition ${
                          reviewTargetScope === 'CATEGORY'
                            ? 'border-red-600 bg-red-50/70 text-red-700 ring-2 ring-red-500/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-black">Specific Category</p>
                        <p className="text-[10px] font-normal text-gray-500 mt-0.5">Select anime universe/cat</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReviewTargetScope('SPECIFIC')}
                        className={`p-3 text-left rounded-xl border text-xs font-bold transition ${
                          reviewTargetScope === 'SPECIFIC'
                            ? 'border-red-600 bg-red-50/70 text-red-700 ring-2 ring-red-500/20'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-black">Hand-picked Products</p>
                        <p className="text-[10px] font-normal text-gray-500 mt-0.5">
                          {reviewTargetProductIds.length} selected
                        </p>
                      </button>
                    </div>

                    {/* Sub-selectors */}
                    {reviewTargetScope === 'CATEGORY' && (
                      <div className="pt-1">
                        <select
                          value={reviewTargetCategoryId}
                          onChange={(e) => setReviewTargetCategoryId(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-red-500"
                        >
                          <option value="all">Choose a category...</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({products.filter((p) => p.category_id === c.id).length} products)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {reviewTargetScope === 'SPECIFIC' && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto space-y-1.5">
                        <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Select Products:</p>
                        {products.map((p) => {
                          const isSelected = reviewTargetProductIds.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setReviewTargetProductIds([...reviewTargetProductIds, p.id]);
                                  } else {
                                    setReviewTargetProductIds(reviewTargetProductIds.filter((id) => id !== p.id));
                                  }
                                }}
                                className="rounded text-red-600 focus:ring-red-500"
                              />
                              <span className="truncate">{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Distribution Calculation Card */}
                  {(() => {
                    let targetCount = 0;
                    if (reviewTargetScope === 'ALL') {
                      targetCount = products.filter((p) => p.is_active !== false).length || products.length;
                    } else if (reviewTargetScope === 'CATEGORY') {
                      targetCount = products.filter((p) => p.category_id === reviewTargetCategoryId).length;
                    } else {
                      targetCount = reviewTargetProductIds.length;
                    }

                    const reviewsCount = jsonReviewList.length;
                    const perProduct = targetCount > 0 ? (reviewsCount / targetCount).toFixed(1) : '0';
                    const approxEach = targetCount > 0 ? Math.floor(reviewsCount / targetCount) : 0;

                    return (
                      <div className="p-3.5 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200/80 text-xs">
                        <div className="flex items-center justify-between font-bold text-red-950">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            Equal & Unique Assignment Plan:
                          </span>
                          <span className="text-[11px] bg-red-200/60 text-red-900 px-2 py-0.5 rounded-full">
                            Zero Repetition
                          </span>
                        </div>
                        <p className="text-[11px] text-red-900/90 mt-1.5 leading-relaxed">
                          Distributing <strong>{reviewsCount} reviews</strong> across{' '}
                          <strong>{targetCount} products</strong>. Each product will receive{' '}
                          <strong>~{approxEach === 0 ? '<1' : approxEach}</strong> unique reviews (average {perProduct} reviews/product). Every single review will be assigned exactly once!
                        </p>
                      </div>
                    );
                  })()}

                  {/* Additional Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Timestamp Staggering (Realism)
                      </label>
                      <select
                        value={reviewDateWindow}
                        onChange={(e) => setReviewDateWindow(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-red-500"
                      >
                        <option value="30">Spread over Last 30 Days (Recommended)</option>
                        <option value="14">Spread over Last 14 Days</option>
                        <option value="7">Spread over Last 7 Days</option>
                        <option value="60">Spread over Last 60 Days</option>
                        <option value="0">All Today</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 pt-4">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewShuffle}
                          onChange={(e) => setReviewShuffle(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span>Shuffle before assignment (Natural variety)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewVerifiedBuyer}
                          onChange={(e) => setReviewVerifiedBuyer(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span>Add "Verified Buyer" badge</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewAutoApprove}
                          onChange={(e) => setReviewAutoApprove(e.target.checked)}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span>Auto-Approve reviews immediately</span>
                      </label>
                    </div>
                  </div>

                  {/* Preview of first 3 parsed reviews */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <p className="text-[11px] font-bold uppercase text-gray-500">
                      Sample Preview (First 3 Reviews):
                    </p>
                    <div className="space-y-1.5">
                      {jsonReviewList.slice(0, 3).map((r, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-200 text-xs flex justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-900">{r.name}</span>
                            <p className="text-gray-600 italic line-clamp-1 text-[11px]">"{r.message}"</p>
                          </div>
                          <div className="flex items-center gap-0.5 text-yellow-500 font-bold shrink-0 text-xs">
                            {r.rating} <Star className="h-3 w-3 fill-current" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar when importing */}
              {importingReviews && importProgress && (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-700">
                    <span>Importing & Distributing Reviews...</span>
                    <span>
                      {importProgress.current} / {importProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-600 h-2 transition-all duration-300"
                      style={{
                        width: `${Math.round((importProgress.current / importProgress.total) * 100)}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-4 border-t border-gray-200 shrink-0">
              <Button
                variant="outline"
                type="button"
                disabled={importingReviews}
                onClick={() => {
                  setIsReviewImportModalOpen(false);
                  setJsonReviewError(null);
                }}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importingReviews || jsonReviewList.length === 0}
                onClick={handleExecuteReviewImport}
                className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold shadow-md"
              >
                {importingReviews
                  ? 'Importing...'
                  : `Distribute & Import ${jsonReviewList.length} Reviews`}
              </Button>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
};
