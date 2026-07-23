# SnapCart → Supabase (Full Setup Guide)

This guide connects your SnapCart store to **Supabase** so:

- Customer **orders** save in the cloud (not only this browser)
- **Admin** sees the same orders from any device
- **Products / reviews / banners / settings** sync across devices
- Admin login uses **Supabase Auth** (secure)

Until you finish this guide, the site still works in **localStorage offline mode**.

---

## What you need

1. A free account at [https://supabase.com](https://supabase.com)
2. Your SnapCart project folder (this repo)
3. ~15 minutes

---

## Step 1 — Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Fill in:
   - **Name:** `snapcart` (or anything)
   - **Database password:** save it somewhere safe (you rarely need it for this app)
   - **Region:** choose closest to India (e.g. Mumbai / Singapore if available)
4. Click **Create project** and wait until it finishes provisioning

---

## Step 2 — Create tables (SQL)

1. In the left sidebar open **SQL Editor**
2. Click **New query**
3. Open the file in this project:

   ```
   SnapCart/supabase-schema.sql
   ```

4. **Copy the entire file** and paste into the SQL Editor
5. Click **Run** (or Ctrl/Cmd + Enter)
6. You should see **Success**. No red errors.

### What this creates

| Table | Purpose |
|--------|---------|
| `products` | Catalog (price, images, flags…) |
| `orders` | COD checkouts |
| `reviews` | Customer reviews |
| `banners` | Top announcement bar |
| `settings` | Hero text, support phone/email |

It also turns on **Row Level Security (RLS)** with policies:

- Public can **read** products, reviews, banners, settings  
- Public can **insert** orders (checkout) and **select** orders (track)  
- **Authenticated** admin can update/delete orders and manage catalog  

---

## Step 3 — Create your Admin user (Auth)

1. Left sidebar → **Authentication**
2. Open **Users**
3. Click **Add user** → **Create new user**
4. Enter:
   - **Email:** `admin@snapcart.in`  
     (or any email you prefer — you’ll use this to log in)
   - **Password:** choose a strong password (min 8 chars)  
   - Enable **Auto Confirm User** if you see that option
5. Click **Create user**

> After Supabase is connected, admin login uses **this** email/password  
> (not the old offline password), because the app prefers Supabase Auth.

---

## Step 4 — Copy API keys

1. Left sidebar → **Project Settings** (gear icon)
2. Open **API**
3. Copy:

| Field in Dashboard | Paste into `supabase.js` as |
|--------------------|-----------------------------|
| **Project URL** | `SUPABASE_URL` |
| **anon public** key | `SUPABASE_ANON_KEY` |

⚠️ Use the **anon public** key only.  
Never put the **service_role** key in frontend code.

---

## Step 5 — Paste keys into SnapCart

1. Open:

   ```
   SnapCart/supabase.js
   ```

2. At the top, replace:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

with your real values, for example:

```js
const SUPABASE_URL = 'https://abcdefghijk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

3. Save the file.

4. (Optional) Match admin email constant if you used a different email:

```js
const ADMIN_EMAIL = 'admin@snapcart.in';
```

This constant is mainly for offline mode; Supabase Auth uses the user you created in Step 3.

---

## Step 6 — Confirm the JS library is loaded

Your `index.html` and `admin.html` should already include:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase.js"></script>
```

Do **not** remove these lines.

---

## Step 7 — Test the connection

1. Start / refresh your site (Live Server or `npx serve .`)
2. Open the browser **Console** (F12 → Console)
3. You should see something like:

   ```
   [SnapCart] Supabase connected: https://xxxx.supabase.co
   ```

4. Optional quick test in Console:

   ```js
   testSupabaseConnection().then(console.log)
   ```

   Expected:

   ```js
   { ok: true, message: "Connected. Tables reachable." }
   ```

---

## Step 8 — Place a test order

1. Open the storefront  
2. Add product → **Checkout** → fill form → **Place Order**  
3. Copy the Order ID (e.g. `SC-XXXX-XXXX`)  
4. In Supabase Dashboard → **Table Editor** → **orders**  
5. You should see the new row  

Also test:

- **Track Order** page with that Order ID  
- **Admin** → Orders (after logging in with Supabase user)

---

## Step 9 — Admin login after Supabase

1. Open `admin.html`
2. Log in with the **Supabase Auth user** from Step 3  
   (email + password you created in the dashboard)
3. You should see orders from the cloud  
4. Edit a product price → refresh the storefront → price updates  

### Offline password (only if keys are missing)

If Supabase is **not** configured, admin falls back to:

- Email: `admin@snapcart.in`  
- Password: `SnapCart@Admin2026`

Once Supabase Auth works, use your Supabase user instead.

---

## How data flows (after setup)

```
Customer browser
    │
    ├─ Checkout ──insert──► Supabase orders
    ├─ Track ────select───► Supabase orders
    ├─ Shop ─────select───► Supabase products / reviews
    │
Admin (logged in)
    ├─ Update status ─────► Supabase orders
    ├─ Edit products ─────► Supabase products
    └─ Banners/settings ──► Supabase banners / settings
```

LocalStorage is still used as a **cache / backup** so the site keeps working if the network blips.

---

## GitHub Pages / Live domain notes

1. Deploy the `SnapCart` folder as usual  
2. In Supabase → **Authentication** → **URL Configuration**:
   - **Site URL:** your live site URL  
   - **Redirect URLs:** add your live site (and `http://127.0.0.1:5500/**` for local)
3. Keys in `supabase.js` are the **anon** key (public by design with RLS)

---

## Optional: Storage for uploaded images

Admin can upload images as **base64 data URLs** (works without Storage).  
For large photos later:

1. Supabase → **Storage** → create bucket `product-images` (public)
2. Add upload code that uses `sb.storage.from('product-images').upload(...)`  
3. Save the public URL into `products.images`

Not required for COD launch.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Console: `Supabase not configured` | Keys still say `YOUR_...` — paste real URL + anon key |
| `relation "products" does not exist` | Run `supabase-schema.sql` again |
| Order places but not in Table Editor | Check Console errors; confirm RLS insert policy ran |
| Admin login fails with Supabase | Create user under Authentication → Users; confirm email |
| `Invalid API key` | Copied **service_role** by mistake — use **anon public** |
| CORS / blocked on file:// | Serve via Live Server or `npx serve`, not raw `file://` |
| Track works locally only | Orders only in localStorage — Supabase not connected |
| Old data after connecting | Hard refresh; cloud data loads from Supabase tables |

### Verify RLS quickly

SQL Editor:

```sql
select count(*) from products;
select count(*) from orders;
```

---

## Security checklist (production)

- [ ] Only **anon** key in frontend  
- [ ] Strong admin password in Supabase Auth  
- [ ] RLS enabled (schema file does this)  
- [ ] Don’t commit service_role key  
- [ ] Change default offline password if you still use offline mode  
- [ ] For higher security later: restrict public `orders` select and track via a secure function  

---

## Files involved

| File | Role |
|------|------|
| `supabase.js` | URL, anon key, all DB read/write |
| `supabase-schema.sql` | Tables + RLS + seed product |
| `index.html` | Loads Supabase JS SDK |
| `admin.html` | Admin login + management |
| `SUPABASE_SETUP.md` | This guide |

---

## Minimal “I’m done” checklist

1. Project created on supabase.com  
2. `supabase-schema.sql` ran successfully  
3. Auth user created  
4. URL + anon key pasted into `supabase.js`  
5. Console shows **Supabase connected**  
6. Test order appears in **Table Editor → orders**  
7. Admin login works with Supabase user  

That’s a full SnapCart + Supabase connection.
