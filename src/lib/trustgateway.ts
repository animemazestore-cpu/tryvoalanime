/**
 * Trust Gateway — Client-Side Integration Library
 * https://trustgateway.in/docs
 *
 * All API-key-authenticated requests are proxied through our own backend
 * (Vercel Edge functions / Vite dev middleware) to keep the key off the client.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrustGatewayCreatePayload {
  /** Total order amount in INR (e.g. "499.00") */
  amount: string;
  /** Free-text note shown on checkout (e.g. "Order 1042") */
  note: string;
  /** Optional webhook callback URL for this specific order */
  callback_url?: string;
}

export interface TrustGatewayCreateResponse {
  success: boolean;
  data?: {
    order_id: string;
    status: string;
    /** Payable amount (may differ from requested by ≤ ₹0.20 for Gmail matching) */
    amount: number;
    /** Your original requested amount */
    requested_amount: number;
    matching_adjustment: number;
    /** Hosted checkout path — prepend https://trustgateway.in */
    checkout_url: string;
    /** UPI deep-link */
    upi_url: string;
    /** QR code image URL */
    qr_url: string;
    expires_at: string;
  };
  message?: string;
  error?: string;
}

export interface TrustGatewayStatusResponse {
  status: string;
  success: boolean;
  paid: boolean;
  data?: {
    order_id: string;
    status: string;
    amount: string;
    utr: string;
    transaction_id: string;
    signature: string;
  };
  message?: string;
  error?: string;
}

// ─── API Calls ──────────────────────────────────────────────────────────────

const TRUSTGATEWAY_BASE = 'https://trustgateway.in';

/**
 * Create a TrustGateway order via our backend proxy.
 * Returns the hosted checkout URL and order metadata.
 */
export async function createTrustGatewayOrder(
  payload: TrustGatewayCreatePayload
): Promise<TrustGatewayCreateResponse> {
  try {
    const res = await fetch('/api/trustgateway-create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      return {
        success: false,
        error: json.message || json.error || `Server returned ${res.status}`,
      };
    }

    return json as TrustGatewayCreateResponse;
  } catch (err: any) {
    console.error('[TrustGateway] createOrder error:', err);
    return {
      success: false,
      error: err.message || 'Network error while creating payment order',
    };
  }
}

/**
 * Check payment status for a TrustGateway order via our backend proxy.
 * Only returns `paid: true` when the order is genuinely completed.
 */
export async function checkTrustGatewayStatus(
  orderId: string
): Promise<TrustGatewayStatusResponse> {
  try {
    const res = await fetch(
      `/api/trustgateway-verify?order_id=${encodeURIComponent(orderId)}`
    );
    const json = await res.json();
    return json as TrustGatewayStatusResponse;
  } catch (err: any) {
    console.error('[TrustGateway] checkStatus error:', err);
    return {
      status: 'error',
      success: false,
      paid: false,
      error: err.message || 'Network error while checking payment status',
    };
  }
}

/**
 * Build the full hosted checkout URL from the relative checkout path
 * returned by the create-order API.
 */
export function getCheckoutUrl(checkoutPath: string): string {
  if (checkoutPath.startsWith('http')) return checkoutPath;
  return `${TRUSTGATEWAY_BASE}${checkoutPath.startsWith('/') ? '' : '/'}${checkoutPath}`;
}
