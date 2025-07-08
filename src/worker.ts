export default {
	async fetch(req: Request): Promise<Response> {
		// Cors Headers
		const baseHeaders = { 'Access-Control-Allow-Origin': '*' };

		// POST
		if (req.method !== 'POST')
			return new Response(JSON.stringify({ error: 'Use POST with JSON body' }), { status: 405, headers: baseHeaders });

		let payload: { country?: string };
		try {
			payload = await req.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: baseHeaders });
		}

		const code = payload.country?.trim().toUpperCase();
		if (!code || code.length !== 2)
			return new Response(JSON.stringify({ error: 'Body must contain a 2-letter "country" code' }), { status: 422, headers: baseHeaders });

		// GraphQL query
		const query = /* GraphQL */ `
			query ($code: ID!) {
				country(code: $code) {
					continent {
						countries {
							code
							name
						}
					}
				}
			}
		`;
		const gqlRes = await fetch('https://countries.trevorblades.com/graphql/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query, variables: { code } }),
		});

		if (!gqlRes.ok) return new Response(JSON.stringify({ error: 'Upstream API failure' }), { status: 502, headers: baseHeaders });

		const { data } = await gqlRes.json();

		if (!data?.country)
			return new Response(JSON.stringify({ error: `Country "${code}" not found` }), { status: 404, headers: baseHeaders });

		const countries = data.country.continent.countries.filter((c: any) => c.code !== code).map(({ code, name }: any) => ({ code, name }));

		return new Response(JSON.stringify({ countries }), { status: 200, headers: { ...baseHeaders, 'content-type': 'application/json' } });
	},
};
