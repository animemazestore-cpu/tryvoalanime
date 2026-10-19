export const config = {
  runtime: 'edge',
};

/**
 * POST /api/trustgateway-webhook
 *
 * Receives `payment.success` webhook events from Trust Gateway.
 * Validates `X-Gateway-Signature` using HMAC-SHA256 before processing.
 *
 * Webhook body fields:
 *   event, order_id, amount, status, utr, transaction_id
 *
 * Signature message = `order_id|amount.toFixed(2)|status|utr-or-NONE`
 */
export default async function handler(req: Request) {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Gateway-Signature',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);

    // Determine the signing secret (webhook secret takes priority, API key as fallback)
    const signingSecret =
      process.env.TRUST_GATEWAY_WEBHOOK_SECRET || process.env.TRUST_GATEWAY_API_KEY;

    if (!signingSecret) {
      console.error('[TrustGateway Webhook] No signing secret configured');
      return new Response('Server misconfigured', { status: 500, headers: corsHeaders });
    }

    // Validate X-Gateway-Signature
    const provided = req.headers.get('X-Gateway-Signature') || '';
    const message = [
      event.order_id,
      Number(event.amount).toFixed(2),
      event.status,
      event.utr || 'NONE',
    ].join('|');

    // Edge-compatible HMAC-SHA256 via Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    if (
      !/^[a-f0-9]{64}$/i.test(provided) ||
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided.toLowerCase())
    ) {
      console.warn('[TrustGateway Webhook] Invalid signature');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    if (event.event !== 'payment.success') {
      console.log('[TrustGateway Webhook] Ignored non-success event:', event.event);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // ─── Payment confirmed — log for now ───
    // In production, look up event.order_id in your DB, verify amount matches,
    // and fulfill the order exactly once (idempotent).
    console.log('[TrustGateway Webhook] Payment confirmed:', {
      order_id: event.order_id,
      amount: event.amount,
      utr: event.utr,
      transaction_id: event.transaction_id,
    });

    // TODO: Update Supabase order status to 'PAID' here if not already done
    // via the client-side polling path.

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('[TrustGateway Webhook] Error:', error);
    return new Response('Internal error', { status: 500, headers: corsHeaders });
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings must be the same length.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
