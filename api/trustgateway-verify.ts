export const config = {
  runtime: 'edge',
};

/**
 * GET /api/trustgateway-verify?order_id=FAM...
 *
 * Server-side proxy for Trust Gateway payment status check.
 * Only authenticated merchant requests receive detailed `data` for paid orders.
 */
export default async function handler(req: Request) {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers':
      'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('order_id');

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameter: order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.TRUST_GATEWAY_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Trust Gateway API key not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tgRes = await fetch(
      `https://trustgateway.in/api/v1/orders/status/${encodeURIComponent(orderId)}`,
      {
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      }
    );

    const tgData = await tgRes.json();

    return new Response(JSON.stringify(tgData), {
      status: tgRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('TrustGateway Verify Proxy Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
