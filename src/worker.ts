export interface Env {
	SHOPIFY_SHARED_SECRET: string;
}

async function verifyShopifySignature(url: URL, secret: string): Promise<boolean> {
	const signature = url.searchParams.get('signature');
	if (!signature) return false;

	// Build a Map<key, joinedValue>
	const map = new Map<string, string>();
	url.searchParams.forEach((value, key) => {
		if (key === 'signature') return;
		map.set(key, map.has(key) ? `${map.get(key)},${value}` : value);
	});

	// Sort keys, join WITHOUT any delimiter (Shopify quirk)
	const message = [...map.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `${k}=${v}`)
		.join('');

	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const digest = await crypto.subtle.sign('HMAC', key, enc.encode(message));
	const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');

	return hash === signature.toLowerCase();
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		// Cors Headers
		const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

		const url = new URL(req.url);

		// Verifying the Shopify signature
		if (!(await verifyShopifySignature(url, env.SHOPIFY_SHARED_SECRET))) {
			return new Response('Forbidden – bad signature', { status: 403 });
		}

		// POST
		if (req.method !== 'POST')
			return new Response(JSON.stringify({ error: 'Use POST with JSON body' }), { status: 405, headers: baseHeaders });

		let payload: { continent?: string };
		try {
			payload = await req.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: baseHeaders });
		}

		const code = payload.continent?.trim().toUpperCase();
		if (!code || code.length !== 2)
			return new Response(JSON.stringify({ error: 'Body must contain a 2-letter "continent" code' }), {
				status: 422,
				headers: baseHeaders,
			});

		const query = /* GraphQL */ `
			query CountriesByContinent($code: String!) {
				countries(filter: { continent: { eq: $code } }) {
					code
					name
				}
			}
		`;
		const variables = { code };
		const gqlRes = await fetch('https://countries.trevorblades.com/graphql/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query, variables }),
		});

		const { data, errors } = await gqlRes.json();
		if (errors) {
			return new Response(JSON.stringify({ error: 'Upstream API error', details: errors }), { status: 502, headers: baseHeaders });
		}

		if (!data?.countries?.length) {
			return new Response(JSON.stringify({ error: `Continent "${code}" not found` }), { status: 404, headers: baseHeaders });
		}

		const countries = data.countries;
		return new Response(JSON.stringify({ countries }), {
			status: 200,
			headers: { ...baseHeaders, 'content-type': 'application/json' },
		});
	},
};
