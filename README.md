# Geo Locale Worker

---

## Prerequisites

| Tool                          |
| ----------------------------- |
| **Wrangler v3**               |
| **Node 18+**                  |
| **Cloudflare account**        |
| **Shopify app shared secret** | 

---

## Quick start – local development

1. **Copy the env template**

   ```bash
   cp .dev.vars.example .dev.vars
   # then edit .dev.vars ➜  SHOPIFY_SHARED_SECRET=<your‑secret>
   ```

2. **Run the dev server**

   ```bash
   npx wrangler dev
   ```
   The Worker listens at **[http://localhost:8787/](http://localhost:8787/)**.

---

## Testing with Postman

> These steps show how to generate the required `signature` query‑param automatically.

1. **Create a new request**

   * **Method:** `POST`
   * **URL:** `http://localhost:8787/`
   * **Headers:** `Content-Type: application/json`
   * **Body (raw → JSON):**

     ```json
     { "country": "RS" }
     ```

2. **Add this *Pre‑request Script*** (Postman ➜ Pre‑request Script tab):

   ```javascript
   // Requires built‑in CryptoJS lib in Postman
   const secret = pm.environment.get('SHOPIFY_SHARED_SECRET');
   const url = new URL(pm.request.url.toString());

   // Merge duplicate params (Shopify quirk) and exclude "signature"
   const merged = {};
   url.searchParams.forEach((v, k) => {
     if (k === 'signature') return;
     merged[k] = merged[k] ? `${merged[k]},${v}` : v;
   });

   // Sort keys, join without delimiter
   const message = Object.keys(merged)
     .sort((a, b) => a.localeCompare(b))
     .map(k => `${k}=${merged[k]}`)
     .join('');

   const digest = CryptoJS.HmacSHA256(message, secret)
                       .toString(CryptoJS.enc.Hex)
                       .toLowerCase();

   url.searchParams.set('signature', digest);
   pm.request.url = url.toString();
   ```

3. **Send** – you should receive a `200 OK` response with neighbouring countries.

![Screenshot 2025-07-22 at 21 58 16](https://github.com/user-attachments/assets/3b49dfca-6a0b-414e-9a46-769e49d2311d)


```json
{
  "countries": [
    { "code": "AD", "name": "Andorra" },
    { "code": "AL", "name": "Albania" },
    { "code": "AT", "name": "Austria" },
    // …additional entries…
  ]
}
```

---

## Deploying to Cloudflare

1. **Store the secret in your Worker env** (encrypted):

   ```bash
   npx wrangler secret put SHOPIFY_SHARED_SECRET            # default env
   npx wrangler secret put SHOPIFY_SHARED_SECRET --env prod # optional
   ```

2. **Deploy**:

   ```bash
   npx wrangler deploy              # default (⧉ dev)
   npx wrangler deploy --env prod   # production
   ```

   Wrangler will print the public URL when the upload completes.

---

## Project layout

```
├── src/worker.ts         # Cloudflare Worker logic
├── wrangler.toml         # Wrangler configuration
├── .dev.vars.example     # Template for local secrets
└── README.md             # You are here
```

---

Made by Ekim Basoglu - 2025
