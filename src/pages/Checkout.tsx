import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import {
  CreditCard,
  ShieldCheck,
  Lock,
  Truck,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Check,
  Package,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  createTrustGatewayOrder,
  checkTrustGatewayStatus,
  getCheckoutUrl,
} from '../lib/trustgateway';
import { checkRateLimit, recordRateLimitAttempt } from '../lib/rateLimiter';
import { dispatchOrderToQikink, getQikinkConfig } from '../lib/qikink';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { user, initialized } = useAuthStore();
  const {
    items,
    getTotalAmount,
    clearCart,
  } = useCartStore();


  // Multi-Step Checkout Navigation: 1 (Preview) -> 2 (Address) -> 3 (Payment) -> 4 (Confirmation)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Applied Coupon from cart/storage
  const [appliedCoupon] = useState<any>(() => {
    return JSON.parse(
      localStorage.getItem('elitebath_applied_coupon') ||
        localStorage.getItem('animemaze_applied_coupon') ||
        'null'
    );
  });

  // Base Products Subtotal (Product price remains completely unchanged)
  const subtotal = getTotalAmount();

  // Validate coupon
  const isCouponValid =
    appliedCoupon &&
    appliedCoupon.active !== false &&
    (!appliedCoupon.minOrder || subtotal >= appliedCoupon.minOrder);

  let discountAmount = 0;
  if (isCouponValid) {
    if (appliedCoupon.type === 'PERCENT' || appliedCoupon.type === 'PERCENTAGE') {
      discountAmount = Math.round((subtotal * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === 'FIXED') {
      discountAmount = Math.min(subtotal, appliedCoupon.value);
    }
  }

  // Per-product shipping charge
  const shippingCharge = items.reduce((sum, item) => {
    return sum + (Number(item.product.shipping_fee) || 0) * item.quantity;
  }, 0);

  // Total order amount: Subtotal - Discount + Shipping
  const total = Math.max(0, subtotal - discountAmount) + shippingCharge;

  // Step 2: Customer Delivery & Address Information (Preserved across all step navigation)
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');

  // Step 3: Payment & Order State
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);
  const [orderPaymentId, setOrderPaymentId] = useState<string | null>(null);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState<string | null>(null);

  // TrustGateway specific state
  const [tgOrderId, setTgOrderId] = useState<string | null>(null);
  const [tgCheckoutUrl, setTgCheckoutUrl] = useState<string | null>(null);
  const [tgQrUrl, setTgQrUrl] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enforce mandatory authentication: user must be logged in to checkout
  useEffect(() => {
    if (initialized && !user) {
      navigate('/auth?redirect=/checkout');
    }
  }, [user, initialized, navigate]);

  // Sync user info into form when session loads
  useEffect(() => {
    if (user) {
      if (!email && user.email) setEmail(user.email);
      if (!fullName && user.user_metadata?.full_name) setFullName(user.user_metadata.full_name);
    }
  }, [user, email, fullName]);

  // Redirect if cart is empty and no active completed order
  useEffect(() => {
    if (items.length === 0 && !orderCreatedId && !loading && currentStep !== 4) {
      navigate('/cart');
    }
  }, [items, navigate, orderCreatedId, loading, currentStep]);

  // Clear cart when payment is confirmed
  useEffect(() => {
    if (paymentStatus === 'paid') {
      clearCart();
      localStorage.removeItem('elitebath_applied_coupon');
      localStorage.removeItem('animemaze_applied_coupon');
    }
  }, [paymentStatus, clearCart]);

  // Save Confirmed Order to DB and Local Storage
  const persistConfirmedOrder = async (
    orderId: string,
    paymentId: string,
    paymentMethodUsed: string
  ) => {
    const shippingAddressJson = {
      fullName,
      phone,
      email,
      address,
      landmark,
      city,
      state,
      pincode,
      country,
      paymentMethod: paymentMethodUsed,
      paymentId,
      order_ref: orderId,
      item_variants: items.map((item) => ({
        product_id: item.product.id,
        selected_variant: item.selectedVariant || null,
        selected_variant_id: item.selectedVariantId || null,
        selected_attributes: item.selectedAttributes || {},
      })),
    };

    const estDelivery = new Date();
    estDelivery.setDate(estDelivery.getDate() + 5);

    // 1. Persist order in Supabase
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId);
      const { data: insertedOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          ...(isUuid ? { id: orderId } : {}),
          user_id: user?.id || null,
          total_amount: total,
          status: 'PAID',
          payment_status: 'PAID',
          shipping_address: shippingAddressJson,
          estimated_delivery_date: estDelivery.toISOString(),
        })
        .select()
        .maybeSingle();

      if (orderError) {
        console.warn('Supabase DB order insert error:', orderError);
      } else if (insertedOrder?.id) {
        const orderItemsPayload = items.map((item) => ({
          order_id: insertedOrder.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.variantPrice ?? item.product.price,
          selected_variant: item.selectedVariant || null,
          selected_variant_id: item.selectedVariantId || null,
          selected_attributes: item.selectedAttributes || {},
        }));
        await supabase.from('order_items').insert(orderItemsPayload);
      }
    } catch (dbErr) {
      console.warn('Supabase DB order insert exception, storing locally:', dbErr);
    }

    // 3. Persist order in localStorage for 100% reliable local access
    try {
      const localOrder = {
        id: orderId,
        user_id: user?.id || 'guest',
        total_amount: total,
        status: 'PAID',
        payment_status: 'PAID',
        payment_id: paymentId,
        shipping_address: shippingAddressJson,
        estimated_delivery_date: estDelivery.toISOString(),
        items: items.map((item, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.variantPrice ?? item.product.price,
          selected_variant: item.selectedVariant || null,
          selected_variant_id: item.selectedVariantId || null,
          selected_attributes: item.selectedAttributes || {},
          image_url: item.variantImage || item.product.main_image_url,
          product: {
            id: item.product.id,
            name: item.product.name,
            main_image_url: item.variantImage || item.product.main_image_url,
            price: item.variantPrice ?? item.product.price,
            slug: item.product.slug,
          },
        })),
        created_at: new Date().toISOString(),
      };

      const existingOrders = JSON.parse(
        localStorage.getItem('elitebath_local_orders') ||
          localStorage.getItem('animemaze_local_orders') ||
          '[]'
      );
      existingOrders.unshift(localOrder);
      localStorage.setItem('elitebath_local_orders', JSON.stringify(existingOrders));
      localStorage.setItem('animemaze_local_orders', JSON.stringify(existingOrders));

      // 4. Automated Qikink POD fulfillment dispatch
      try {
        void dispatchOrderToQikink(localOrder as any).then(async (qRes) => {
          if (qRes && qRes.success) {
            console.info('[Qikink Auto-Fulfillment Successful]:', qRes);
            const qikinkInfo = {
              order_id: qRes.qikink_order_id || `QK-${Date.now()}`,
              status: qRes.status || 'QUEUED',
              awb_number: qRes.awb_number,
              courier_name: qRes.courier_name,
              tracking_url: qRes.tracking_url,
              dispatched_at: new Date().toISOString(),
              environment: getQikinkConfig().environment,
            };
            const trackingInfo = qRes.awb_number
              ? {
                  carrier: qRes.courier_name || 'Delhivery Express',
                  tracking_number: qRes.awb_number,
                  shipped_at: new Date().toISOString(),
                }
              : undefined;

            try {
              const currentOrders = JSON.parse(localStorage.getItem('elitebath_local_orders') || '[]');
              const updated = currentOrders.map((o: any) =>
                o.id === orderId
                  ? {
                      ...o,
                      status: 'PROCESSING',
                      shipping_address: {
                        ...(o.shipping_address || {}),
                        qikink_info: qikinkInfo,
                        ...(trackingInfo ? { tracking_info: trackingInfo } : {}),
                      },
                    }
                  : o
              );
              localStorage.setItem('elitebath_local_orders', JSON.stringify(updated));
            } catch (_) {}

            try {
              await supabase.from('orders').update({
                status: 'PROCESSING',
                shipping_address: {
                  ...shippingAddressJson,
                  qikink_info: qikinkInfo,
                  ...(trackingInfo ? { tracking_info: trackingInfo } : {})
                }
              }).eq('id', orderId);
            } catch (_) {}
          }
        });
      } catch (podErr) {
        console.warn('Qikink automated fulfillment background dispatch error:', podErr);
      }
    } catch (e) {
      console.error('Failed to write to local orders:', e);
    }
  };

  // Step 2 Validation: Address & Customer Details
  const handleValidateAddressStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address for order notifications.');
      return;
    }

    if (!address.trim()) {
      setErrorMsg('Please enter your complete delivery street address.');
      return;
    }

    if (!city.trim()) {
      setErrorMsg('Please enter your city.');
      return;
    }

    if (!state.trim()) {
      setErrorMsg('Please enter your state.');
      return;
    }

    const cleanPincode = pincode.trim().replace(/[^0-9]/g, '');
    if (cleanPincode.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit postal pincode.');
      return;
    }

    // Step 2 passed -> advance to Step 3 (Payment)
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll TrustGateway for payment confirmation
  const startPolling = useCallback(
    (gatewayOrderId: string, localOrderId: string) => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setPollingActive(true);

      pollingRef.current = setInterval(async () => {
        try {
          const result = await checkTrustGatewayStatus(gatewayOrderId);

          if (result.paid === true && result.data?.order_id === gatewayOrderId) {
            // Payment confirmed!
            if (pollingRef.current) clearInterval(pollingRef.current);
            setPollingActive(false);
            setPaymentStatus('paid');

            const paymentId = result.data.transaction_id || result.data.utr || gatewayOrderId;
            setOrderPaymentId(paymentId);

            await persistConfirmedOrder(localOrderId, paymentId, 'TrustGateway UPI');
            setCurrentStep(4);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setLoading(false);
          }
        } catch (err) {
          console.warn('[TrustGateway] Poll error (will retry):', err);
        }
      }, 5000); // Poll every 5 seconds
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, fullName, phone, email, address, landmark, city, state, pincode, country, user, total]
  );

  // Step 3 Execution: Handle TrustGateway UPI Checkout
  const handleTrustGatewayCheckout = async () => {
    // Rate limiting abuse prevention
    const rateCheck = checkRateLimit('checkout_payment', {
      maxRequests: 5,
      windowSeconds: 60,
      actionName: 'order payment attempts',
    });
    if (!rateCheck.allowed) {
      setErrorMsg(rateCheck.errorMessage || 'Too many payment requests. Please wait a moment.');
      return;
    }
    recordRateLimitAttempt('checkout_payment', { maxRequests: 5, windowSeconds: 60 });

    setLoading(true);
    setErrorMsg('');

    try {
      // Generate local order reference
      const localOrderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setOrderCreatedId(localOrderId);

      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 5);
      setOrderDeliveryDate(deliveryDate.toISOString());

      // Create TrustGateway order
      const tgResult = await createTrustGatewayOrder({
        amount: total.toFixed(2),
        note: `Tryvoal Order ${localOrderId}`,
      });

      if (!tgResult.success || !tgResult.data) {
        throw new Error(tgResult.error || 'Failed to create payment order. Please try again.');
      }

      const { order_id, checkout_url, qr_url } = tgResult.data;
      setTgOrderId(order_id);
      setTgCheckoutUrl(getCheckoutUrl(checkout_url));
      setTgQrUrl(qr_url);

      // Open the hosted checkout in a new tab
      window.open(getCheckoutUrl(checkout_url), '_blank');

      // Start polling for payment confirmation
      startPolling(order_id, localOrderId);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMsg(err.message || 'Something went wrong during checkout.');
      setLoading(false);
    }
  };

  // STEP WIZARD PROGRESS STEPPER
  const stepItems = [
    { number: 1, title: 'Product Preview' },
    { number: 2, title: 'Address & Contact' },
    { number: 3, title: 'Payment' },
    { number: 4, title: 'Order Confirmation' },
  ];

  // If auth is still initializing, show a smooth loading state
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center py-20">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-500">Checking your session...</p>
        </div>
      </div>
    );
  }

  // Enforce mandatory authentication: User must be logged in to make a purchase
  if (initialized && !user) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mx-auto text-primary">
            <Lock className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Account Required to Checkout</h2>
            <p className="text-sm text-gray-500 mt-2">
              Please sign in or create an account to proceed with your order. This allows you to track shipments, receive doorstep delivery updates, and request size exchanges.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <Button
              fullWidth
              size="lg"
              onClick={() => navigate('/auth?redirect=/checkout')}
            >
              Log In / Register to Continue
            </Button>
            <Link to="/cart" className="block text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              Return to Bag
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEP 4: ORDER CONFIRMATION VIEW
  // =========================================================================
  if (currentStep === 4 || (orderCreatedId && paymentStatus === 'paid')) {
    const formattedDeliveryDate = orderDeliveryDate
      ? new Date(orderDeliveryDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'Within 5-7 business days';

    return (
      <div className="min-h-screen bg-gray-50/50 py-12 animate-fadeIn">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Stepper (Finished) */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary w-full -z-0" />
              {stepItems.map((step) => (
                <div key={step.number} className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold ring-4 ring-white shadow-sm">
                    <Check className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-primary mt-1.5 hidden sm:block">
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-10 shadow-xl text-center space-y-8">
            {/* Animated Success Badge */}
            <div className="w-20 h-20 bg-primary/10 border-2 border-primary rounded-full flex items-center justify-center mx-auto text-primary shadow-inner">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Order & Payment Confirmed
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Thank You for Choosing TRYVOAL!
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                Your luxury apparel order has been confirmed and forwarded for precision quality inspection and express dispatch.
              </p>
            </div>

            {/* Order Details Grid */}
            <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-6 text-left space-y-5 text-xs text-gray-600">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-gray-200">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Order Reference
                  </span>
                  <p className="font-mono text-sm font-bold text-gray-900 select-all mt-0.5">
                    {orderCreatedId}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Payment Reference
                  </span>
                  <p className="font-mono text-sm font-bold text-primary select-all mt-0.5 truncate">
                    {orderPaymentId || 'Online Payment'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Est. Arrival
                  </span>
                  <p className="text-sm font-bold text-gray-900 flex items-center gap-1 mt-0.5">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    {formattedDeliveryDate}
                  </p>
                </div>
              </div>

              {/* Destination */}
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                  Delivery Destination
                </span>
                <p className="font-bold text-gray-900 text-sm">{fullName}</p>
                <p className="text-gray-600">
                  {address}
                  {landmark ? `, Near ${landmark}` : ''}, {city}, {state} - {pincode}
                </p>
                <p className="text-gray-500 mt-0.5">Contact: {phone} • {email}</p>
              </div>

              
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button
                onClick={() => navigate(`/track-order?id=${orderCreatedId}`)}
                className="w-full sm:w-auto px-8 py-3.5 flex items-center justify-center gap-2"
              >
                <Truck className="h-4 w-4" />
                <span>Track Order Shipment</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/shop')}
                className="w-full sm:w-auto px-8 py-3.5"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STEPS 1, 2, 3: MULTI-STEP CHECKOUT WIZARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-50/50 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            TRYVOAL Checkout
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Premium apparel checkout with doorstep exchange guarantee, insured transit, and 256-bit payment encryption.
          </p>
        </div>

        {/* 4-Step Interactive Stepper Indicator */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 mb-8 shadow-sm">
          <div className="grid grid-cols-4 gap-2 relative">
            {stepItems.map((step) => {
              const isPassed = currentStep > step.number;
              const isCurrent = currentStep === step.number;

              return (
                <div
                  key={step.number}
                  className={`flex flex-col items-center text-center cursor-default ${
                    isCurrent
                      ? 'text-primary'
                      : isPassed
                      ? 'text-emerald-700'
                      : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm mb-1.5 ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isPassed ? <Check className="h-4 w-4" /> : step.number}
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold line-clamp-1">
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inline Error Notice */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between animate-shake">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-danger hover:opacity-75 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* MAIN 2-COLUMN LAYOUT: Wizard Form (Left) & Sticky Order Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* ============================================================= */}
            {/* STEP 1: ORDER REVIEW                                          */}
            {/* ============================================================= */}
            {currentStep === 1 && (
              <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-card space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <span>Step 1: Order Review</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Review your ordered apparel items and configure sizes or quantities.
                    </p>
                  </div>
                  <Link
                    to="/cart"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Edit Cart
                  </Link>
                </div>

                {/* Ordered Items Preview */}
                <div className="divide-y divide-gray-100">
                  {items.map((item) => {
                    const itemPrice = item.variantPrice ?? item.product.price;
                    const itemImg = item.variantImage || item.product.main_image_url;
                    const variantKey = item.selectedVariantId || item.selectedVariant || '';

                    return (
                      <div
                        key={`${item.product.id}-${variantKey}`}
                        className="py-3.5 flex items-center gap-4 first:pt-0 last:pb-0"
                      >
                        <div className="w-14 h-16 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 p-1">
                          <img
                            src={itemImg}
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {item.product.name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mt-1">
                            <span>Quantity: {item.quantity}</span>
                            {item.selectedVariant && (
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold">
                                {item.selectedVariant}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Unit Price: ₹{itemPrice.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="text-sm font-black text-gray-900 whitespace-nowrap">
                          ₹{(itemPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Continue CTA */}
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <Button
                    size="lg"
                    onClick={() => {
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-8"
                  >
                    <span>Continue to Delivery Address</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* STEP 2: ADDRESS & CUSTOMER INFORMATION                        */}
            {/* ============================================================= */}
            {currentStep === 2 && (
              <form
                onSubmit={handleValidateAddressStep}
                className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-card space-y-6"
              >
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span>Step 2: Customer & Delivery Address</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enter the exact recipient name and delivery destination for safe timber crate arrival.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Input
                      label="Full Name"
                      type="text"
                      required
                      placeholder="e.g. Vikram Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <Input
                    label="Mobile Phone Number (10 digits)"
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />

                  <Input
                    label="Email Address (Order Confirmation)"
                    type="email"
                    required
                    placeholder="e.g. vikram.sharma@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <div className="sm:col-span-2">
                    <Input
                      label="Complete Delivery Address"
                      type="text"
                      required
                      placeholder="House / Flat No, Floor, Building Name, Street"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <Input
                    label="Landmark (Optional)"
                    type="text"
                    placeholder="Near metro station, circle, etc."
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />

                  <Input
                    label="City"
                    type="text"
                    required
                    placeholder="e.g. Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />

                  <Input
                    label="State"
                    type="text"
                    required
                    placeholder="e.g. Maharashtra"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />

                  <Input
                    label="Postal Pincode (6 digits)"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 400001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />

                  <Input
                    label="Country"
                    type="text"
                    required
                    disabled
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>

                {/* Step 2 Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCurrentStep(1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Preview</span>
                  </Button>
                  <Button type="submit" size="lg" className="flex items-center gap-2 px-8">
                    <span>Continue to Payment</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}

            {/* ============================================================= */}
            {/* STEP 3: PAYMENT & FINAL VERIFICATION                          */}
            {/* ============================================================= */}
            {currentStep === 3 && (
              <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-card space-y-6">
                <div className="pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span>Step 3: Review & Secure Payment</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review your delivery destination and pay securely via UPI checkout.
                  </p>
                </div>

                {/* Destination Review Box */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Delivering To
                    </span>
                    <p className="text-xs font-bold text-gray-900">{fullName}</p>
                    <p className="text-xs text-gray-600">
                      {address}
                      {landmark ? `, Near ${landmark}` : ''}, {city}, {state} - {pincode}
                    </p>
                    <p className="text-[11px] text-gray-500">Phone: {phone} • Email: {email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-xs font-bold text-primary hover:underline flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>

                {/* TrustGateway UPI Gateway Card */}
                <div className="p-5 rounded-xl border-2 border-primary bg-primary/5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900 block">
                          Trust Gateway — UPI Checkout
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          Secure hosted UPI payment with instant verification
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-white">
                      SECURE
                    </span>
                  </div>

                  <div className="pt-2 border-t border-primary/15 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-gray-700">
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                      ⚡ Google Pay
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                      ⚡ PhonePe
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                      ⚡ Paytm
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                      ⚡ BHIM UPI
                    </span>
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-md shadow-2xs">
                      📱 Any UPI App
                    </span>
                  </div>
                </div>

                {/* Polling status — shown after checkout is initiated */}
                {pollingActive && tgCheckoutUrl && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">
                          Waiting for your payment...
                        </p>
                        <p className="text-xs text-amber-600">
                          Complete the payment on the checkout page. This screen will update automatically.
                        </p>
                        {tgOrderId && (
                          <p className="text-[10px] text-amber-700/70 font-mono mt-1">
                            Gateway Order ID: {tgOrderId}
                          </p>
                        )}
                      </div>
                    </div>
                    <a
                      href={tgCheckoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Re-open checkout page
                    </a>
                    {tgQrUrl && (
                      <div className="pt-3 border-t border-amber-200">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2">
                          Or scan QR code to pay
                        </p>
                        <img
                          src={tgQrUrl}
                          alt="UPI QR Code"
                          className="w-40 h-40 rounded-lg border border-gray-200 bg-white p-1"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2.5 text-xs text-gray-600">
                  <Lock className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>
                    Hosted UPI checkout by Trust Gateway. Your payment details never touch our servers.
                  </span>
                </div>

                {/* Step 3 Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (pollingRef.current) clearInterval(pollingRef.current);
                      setPollingActive(false);
                      setCurrentStep(2);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Address</span>
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    loading={loading}
                    disabled={pollingActive}
                    onClick={handleTrustGatewayCheckout}
                    className="flex items-center gap-2 px-8 shadow-md"
                  >
                    <Lock className="h-4 w-4" />
                    <span>{pollingActive ? 'Awaiting Payment...' : `Pay ₹${total.toLocaleString('en-IN')} via UPI`}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================= */}
          {/* RIGHT SIDEBAR: REAL-TIME ORDER CALCULATION SUMMARY             */}
          {/* ============================================================= */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-7 rounded-2xl border border-gray-200 shadow-card space-y-5 sticky top-24">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900">Order Summary</h3>
                <span className="text-xs text-gray-500 font-semibold">{items.length} item(s)</span>
              </div>

              {/* Items List Snapshot */}
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto pr-1">
                {items.map((item) => {
                  const itemPrice = item.variantPrice ?? item.product.price;
                  const itemImg = item.variantImage || item.product.main_image_url;
                  const variantKey = item.selectedVariantId || item.selectedVariant || '';

                  return (
                    <div
                      key={`${item.product.id}-${variantKey}`}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3"
                    >
                      <div className="w-10 h-12 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                        <img
                          src={itemImg}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-[10px] text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-900">
                        ₹{(itemPrice * item.quantity).toLocaleString('en-IN')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2.5 text-xs text-gray-600 pt-3 border-t border-gray-100">
                <div className="flex justify-between">
                  <span>Products Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount ({appliedCoupon?.code}):</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Insured Express Shipping:</span>
                  {shippingCharge === 0 ? (
                    <span className="text-success font-bold uppercase text-[11px]">FREE</span>
                  ) : (
                    <span className="font-semibold text-gray-900">₹{shippingCharge}</span>
                  )}
                </div>

                
              </div>

              {/* Total Order Amount */}
              <div className="border-t border-gray-200 pt-4 flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-extrabold text-primary">
                  ₹{total.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Current Step Action Button on Mobile or Sidebar */}
              {currentStep === 1 && (
                <Button
                  fullWidth
                  size="lg"
                  onClick={() => {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="py-3.5 shadow-md text-sm font-bold"
                >
                  <span>Proceed to Delivery Address</span>
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              {currentStep === 2 && (
                <Button
                  fullWidth
                  size="lg"
                  onClick={handleValidateAddressStep}
                  className="py-3.5 shadow-md text-sm font-bold"
                >
                  <span>Proceed to Payment</span>
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              {currentStep === 3 && (
                <Button
                  fullWidth
                  size="lg"
                  loading={loading}
                  disabled={pollingActive}
                  onClick={handleTrustGatewayCheckout}
                  className="py-3.5 shadow-md text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  <span>{pollingActive ? 'Awaiting Payment...' : `Pay ₹${total.toLocaleString('en-IN')} via UPI`}</span>
                </Button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 font-medium pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>100% Authentic Luxury Apparel • Insured Safe Transit</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
