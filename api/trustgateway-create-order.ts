export const config = {
  runtime: 'edge',
};

/**
 * POST /api/trustgateway-create-order
 *
 * Server-side proxy for Trust Gateway order creation.
 * Keeps the API key off the client.
 *
 * Body: { amount: "499.00", note: "Order 1042", callback_url?: "..." }
 */
export default async function handler(req: Request) {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
    'Access-Control-Allow-Headers':
      'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { amount, note, callback_url } = body;

    if (!amount) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use env var for API key — set in Vercel project settings
    const apiKey = process.env.TRUST_GATEWAY_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Trust Gateway API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: Record<string, string> = {
      amount: String(amount),
      note: note || 'Tryvoal Anime Store Order',
    };
    if (callback_url) {
      payload.callback_url = callback_url;
    }

    const tgRes = await fetch('https://trustgateway.in/api/v1/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const tgData = await tgRes.json();

    return new Response(JSON.stringify(tgData), {
      status: tgRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('TrustGateway Create Order Proxy Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
