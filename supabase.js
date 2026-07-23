/* SnapCart — Data layer (localStorage + optional Supabase) */
/* IMPORTANT: plain strings only — no markdown links */
const SUPABASE_URL = 'https://ttfwaxqembcdwaclezhp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NeNUSoOUAxgLYaD1TqlBhQ_S79Pfqqc';
const ADMIN_EMAIL = 'admin@snapcart.in';

const KEYS = {
  products: 'sc_products_v4',
  orders: 'sc_orders_v4',
  reviews: 'sc_reviews_v4',
  banners: 'sc_banners_v4',
  settings: 'sc_settings_v4',
  adminHash: 'sc_admin_hash_v4',
  session: 'sc_admin_session_v4',
  cart: 'sc_cart_v4',
};

let sb = null;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let _seedQuiet = false;
let _seedDone = false;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return structuredClone(fallback);
    }
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function save(key, data, opts = {}) {
  const next = JSON.stringify(data);
  const prev = localStorage.getItem(key);
  if (prev === next) return false; /* no-op if unchanged */
  localStorage.setItem(key, next);
  if (!opts.silent && !_seedQuiet) {
    window.dispatchEvent(new CustomEvent('sc:data', { detail: { key } }));
  }
  return true;
}

function sanitize(s) {
  return String(s ?? '').replace(/[<>]/g, '').trim().slice(0, 500);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function discountOf(p) {
  if (!p?.original_price || p.original_price <= p.price) return 0;
  return Math.round(((p.original_price - p.price) / p.original_price) * 100);
}

const CLEAN_IMAGES = [
  'assets/images/product-front.png',
  'assets/images/product-modes.png',
  'assets/images/product-rhymes.png',
  'assets/images/product-activities.png',
  'assets/images/product-practice.png',
  'assets/images/product-reusable.png',
  'assets/images/product-speaker.jpeg',
  'assets/images/product-heart.png',
  'assets/images/howto-use.png',
];

const DEFAULT_PRODUCTS = [
  {
    id: 'sc-soundbook-01',
    slug: 'intelligence-book',
    name: 'SnapCart Intelligence Sound Book',
    tagline: 'Learn · Play · Grow',
    description:
      'Premium interactive sound book for kids ages 2+. Clear audio, 500+ sounds & words, interactive buttons, and bright colorful pages. Builds memory, confidence, and joyful parent–child learning — screen free.',
    price: 499,
    original_price: 1299,
    stock: 86,
    category: 'Educational Toys',
    badge: 'Best Seller',
    flags: {
      bestseller: true,
      featured: true,
      trending: true,
      latest: true,
      flash_sale: true,
      recommended: true,
    },
    images: CLEAN_IMAGES.slice(),
    features: [
      '500+ sounds & words',
      'Interactive learning buttons',
      'Alphabets, numbers, fruits, animals, vehicles & rhymes',
      'Clear high-quality speaker',
      'Safe & durable material',
      'Easy for little hands',
    ],
    package_includes: [
      '1 × Intelligence Sound Book',
      '1 × Erasable marker (if included in pack)',
      'Quick start guide',
    ],
    specs: {
      Age: '2+ years',
      Language: 'English',
      Power: 'AAA batteries (not included)',
      Material: 'Non-toxic ABS + paperboard',
    },
    delivery_estimate: '3–6 business days',
    active: true,
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_REVIEWS = [
  {
    id: 1,
    customer_name: 'Priya Sharma',
    rating: 5,
    review: 'My daughter loves tapping every page. Sound is clear and the book feels premium. Best buy under ₹500!',
    review_image: 'assets/reviews/review-1.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-05-12T10:00:00Z',
  },
  {
    id: 2,
    customer_name: 'Rahul Mehta',
    rating: 5,
    review: 'COD delivery was smooth to Bengaluru. Kids are glued to the rhymes and alphabet pages.',
    review_image: 'assets/reviews/review-2.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-05-28T14:30:00Z',
  },
  {
    id: 3,
    customer_name: 'Ananya Reddy',
    rating: 5,
    review: 'Perfect screen-free gift. Bright pages, sturdy build, and my niece actually sits and learns.',
    review_image: 'assets/reviews/review-3.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-06-03T09:15:00Z',
  },
  {
    id: 4,
    customer_name: 'Vikram Singh',
    rating: 5,
    review: 'Great value at ₹499. Question mode keeps them curious. Highly recommend.',
    review_image: 'assets/reviews/review-4.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-06-15T16:45:00Z',
  },
  {
    id: 5,
    customer_name: 'Sneha Patel',
    rating: 5,
    review: 'Reusable practice sheets are a bonus. Parent–child time has improved so much.',
    review_image: 'assets/reviews/review-5.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-06-22T11:20:00Z',
  },
  {
    id: 6,
    customer_name: 'Arjun Nair',
    rating: 4,
    review: 'Solid product. Wish batteries were included, otherwise excellent for the price.',
    review_image: 'assets/reviews/review-1.jpeg',
    verified: true,
    product_slug: 'intelligence-book',
    created_at: '2026-07-01T08:00:00Z',
  },
];

const DEFAULT_BANNERS = [
  { id: 1, text: 'Free Shipping Across India', active: true },
  { id: 2, text: 'Cash on Delivery Available', active: true },
  { id: 3, text: 'Limited Time · Up to 62% OFF', active: true },
  { id: 4, text: 'Trusted by Thousands of Parents', active: true },
  { id: 5, text: 'Fast Dispatch within 24 Hours', active: true },
  { id: 6, text: 'Easy 7-Day Returns', active: true },
];

const DEFAULT_SETTINGS = {
  store_name: 'SnapCart',
  tagline: 'Smart Choice, Happy Kids!',
  support_email: 'hello@snapcart.in',
  support_phone: '+91 98765 43210',
  hero_title: 'Learning that feels like play',
  hero_subtitle:
    'Interactive sound book for curious kids — clear audio, joyful learning, zero screens.',
  hero_image: 'assets/images/product-front.png',
  delivery_info: '3–6 business days across India',
};

function isSupabaseConfigured() {
  return (
    typeof supabase !== 'undefined' &&
    SUPABASE_URL &&
    !String(SUPABASE_URL).includes('YOUR_') &&
    SUPABASE_ANON_KEY &&
    !String(SUPABASE_ANON_KEY).includes('YOUR_')
  );
}

function initSupabase() {
  /* Singleton — never create two clients (avoids GoTrueClient warning) */
  if (sb) return sb;
  if (!isSupabaseConfigured()) {
    console.info('[SnapCart] Supabase not configured — using localStorage.');
    return null;
  }
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[SnapCart] Supabase SDK not loaded. Check script tag in HTML.');
    return null;
  }
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'snapcart-auth',
      },
    });
    console.info('[SnapCart] Supabase connected:', SUPABASE_URL);
    return sb;
  } catch (e) {
    console.error('[SnapCart] Supabase init failed', e);
    sb = null;
    return null;
  }
}

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description || '',
    price: Number(row.price) || 0,
    original_price: Number(row.original_price) || 0,
    stock: Number(row.stock) || 0,
    category: row.category || '',
    badge: row.badge || '',
    flags: row.flags || {},
    images: row.images || [],
    features: row.features || [],
    package_includes: row.package_includes || [],
    specs: row.specs || {},
    delivery_estimate: row.delivery_estimate || '',
    video: row.video || '',
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function seedStore() {
  if (_seedDone) return;
  _seedQuiet = true;
  try {
    if (!localStorage.getItem(KEYS.products)) {
      localStorage.setItem(KEYS.products, JSON.stringify(DEFAULT_PRODUCTS));
    }
    if (!localStorage.getItem(KEYS.reviews)) {
      localStorage.setItem(KEYS.reviews, JSON.stringify(DEFAULT_REVIEWS));
    }
    if (!localStorage.getItem(KEYS.banners)) {
      localStorage.setItem(KEYS.banners, JSON.stringify(DEFAULT_BANNERS));
    }
    if (!localStorage.getItem(KEYS.settings)) {
      localStorage.setItem(KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(KEYS.orders)) {
      localStorage.setItem(KEYS.orders, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEYS.adminHash)) {
      localStorage.setItem(KEYS.adminHash, await sha256('SnapCart@Admin2026'));
    }

    /* One-time normalize main product images/price if needed */
    const products = load(KEYS.products, DEFAULT_PRODUCTS);
    let pChanged = false;
    products.forEach((p) => {
      if (p.slug !== 'intelligence-book') return;
      const front = 'assets/images/product-front.png';
      const imgs = Array.isArray(p.images) ? p.images : [];
      if (!imgs.length || imgs[0] !== front) {
        p.images = CLEAN_IMAGES.slice();
        pChanged = true;
      }
      if (!p.price || p.price === 1499) {
        p.price = 499;
        pChanged = true;
      }
      if (!p.original_price || p.original_price === 2999) {
        p.original_price = 1299;
        pChanged = true;
      }
      if (!p.name) {
        p.name = 'SnapCart Intelligence Sound Book';
        pChanged = true;
      }
    });
    if (pChanged) {
      localStorage.setItem(KEYS.products, JSON.stringify(products));
    }

    const settings = load(KEYS.settings, DEFAULT_SETTINGS);
    if (settings.hero_image !== 'assets/images/product-front.png') {
      settings.hero_image = 'assets/images/product-front.png';
      localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    }
  } finally {
    _seedQuiet = false;
    _seedDone = true;
  }
}

/* Products */
async function fetchProducts() {
  await seedStore();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (!error && data?.length) {
        const mapped = data.map(mapProductRow);
        save(KEYS.products, mapped, { silent: true });
        return mapped;
      }
    } catch (e) {
      console.warn('[SnapCart] fetchProducts', e);
    }
  }
  return load(KEYS.products, DEFAULT_PRODUCTS).filter((p) => p.active !== false);
}

async function fetchAllProductsAdmin() {
  await seedStore();
  if (sb) {
    try {
      const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        const mapped = data.map(mapProductRow);
        save(KEYS.products, mapped, { silent: true });
        return mapped;
      }
    } catch (e) {
      console.warn('[SnapCart] fetchAllProductsAdmin', e);
    }
  }
  return load(KEYS.products, DEFAULT_PRODUCTS);
}

async function fetchProductBySlug(slug) {
  if (sb) {
    try {
      const { data, error } = await sb.from('products').select('*').eq('slug', slug).maybeSingle();
      if (!error && data) return mapProductRow(data);
    } catch (_) {}
  }
  const list = await fetchProducts();
  return list.find((p) => p.slug === slug) || null;
}

async function saveProduct(product) {
  const payload = {
    ...product,
    id: product.id || 'sc-' + Date.now(),
    slug: slugify(product.slug || product.name),
    updated_at: new Date().toISOString(),
    active: product.active !== false,
  };
  if (!payload.created_at) payload.created_at = new Date().toISOString();

  /* local cache */
  const list = load(KEYS.products, DEFAULT_PRODUCTS);
  const i = list.findIndex((p) => p.id === payload.id);
  if (i >= 0) list[i] = { ...list[i], ...payload };
  else list.unshift(payload);
  save(KEYS.products, list);

  if (sb) {
    try {
      const row = {
        id: payload.id,
        slug: payload.slug,
        name: payload.name,
        tagline: payload.tagline || '',
        description: payload.description || '',
        price: Number(payload.price) || 0,
        original_price: Number(payload.original_price) || 0,
        stock: Number(payload.stock) || 0,
        category: payload.category || '',
        badge: payload.badge || '',
        flags: payload.flags || {},
        images: payload.images || [],
        features: payload.features || [],
        package_includes: payload.package_includes || [],
        specs: payload.specs || {},
        delivery_estimate: payload.delivery_estimate || '',
        video: payload.video || '',
        active: payload.active !== false,
        updated_at: payload.updated_at,
      };
      const { error } = await sb.from('products').upsert(row, { onConflict: 'id' });
      if (error) console.warn('[SnapCart] saveProduct remote', error);
    } catch (e) {
      console.warn('[SnapCart] saveProduct', e);
    }
  }
  return { success: true, product: payload };
}

async function deleteProduct(id) {
  save(
    KEYS.products,
    load(KEYS.products, []).filter((p) => p.id !== id)
  );
  if (sb) {
    try {
      const { error } = await sb.from('products').delete().eq('id', id);
      if (error) console.warn('[SnapCart] deleteProduct remote', error);
    } catch (e) {
      console.warn('[SnapCart] deleteProduct', e);
    }
  }
  return { success: true };
}

/* Orders */
function generateOrderId() {
  return (
    'SC-' +
    Date.now().toString(36).toUpperCase() +
    '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/**
 * Canonical order math — total MUST be Σ(price × qty) only.
 * Recalculates from products[] so bad client totals never reach Supabase.
 */
function computeOrderTotals(products, fallbackTotal, fallbackQty) {
  const lines = Array.isArray(products) ? products : [];
  let total = 0;
  let quantity = 0;
  const normalized = lines
    .map((p) => {
      const price = Number(p?.price) || 0;
      const qty = Math.max(0, parseInt(p?.qty, 10) || 0);
      total += price * qty;
      quantity += qty;
      return {
        id: p?.id || '',
        slug: p?.slug || '',
        name: sanitize(p?.name || 'Product'),
        price,
        qty,
      };
    })
    .filter((p) => p.qty > 0);

  if (!normalized.length) {
    total = Number(fallbackTotal) || 0;
    quantity = Math.max(1, parseInt(fallbackQty, 10) || 1);
  }
  return { products: normalized, total, quantity };
}

async function saveOrder(data) {
  /* Always (re)init client before write */
  initSupabase();

  const computed = computeOrderTotals(data.products, data.total, data.quantity);
  if (computed.total <= 0) {
    return { success: false, error: 'Invalid order total (must be price × quantity)' };
  }

  const order_id = generateOrderId();
  const created_at = new Date().toISOString();
  const row = {
    order_id,
    customer_name: sanitize(data.customer_name),
    phone: sanitize(data.phone),
    alternate_phone: sanitize(data.alternate_phone || ''),
    email: sanitize(data.email || ''),
    house: sanitize(data.house),
    street: sanitize(data.street),
    landmark: sanitize(data.landmark || ''),
    city: sanitize(data.city),
    state: sanitize(data.state),
    pincode: sanitize(data.pincode),
    order_notes: sanitize(data.order_notes || ''),
    payment_method: 'COD',
    order_status: 'pending',
    total: computed.total,
    quantity: computed.quantity,
    products: computed.products,
    created_at,
  };

  /* local backup first */
  const localOrder = { id: order_id, ...row };
  const list = load(KEYS.orders, []);
  list.unshift(localOrder);
  save(KEYS.orders, list, { silent: true });

  if (!sb) {
    console.error('[SnapCart] saveOrder: Supabase client is null — order LOCAL only', order_id);
    return {
      success: true,
      order_id,
      offline: true,
      error: 'Supabase not connected. Check SUPABASE_URL / ANON_KEY and hard refresh.',
    };
  }

  try {
    /* Let Postgres generate uuid id — do not send id */
    const { data: inserted, error } = await sb
      .from('orders')
      .insert([row])
      .select('order_id,id,created_at')
      .single();

    if (error) {
      console.error('[SnapCart] saveOrder Supabase error:', error);
      return {
        success: true,
        order_id,
        offline: true,
        error: error.message || JSON.stringify(error),
      };
    }

    console.info('[SnapCart] Order saved to Supabase:', inserted?.order_id || order_id);
    return {
      success: true,
      order_id: inserted?.order_id || order_id,
      offline: false,
      remote_id: inserted?.id,
    };
  } catch (e) {
    console.error('[SnapCart] saveOrder exception:', e);
    return {
      success: true,
      order_id,
      offline: true,
      error: e.message || 'Network error',
    };
  }
}

async function fetchOrders() {
  initSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[SnapCart] fetchOrders error:', error);
      } else if (data) {
        console.info('[SnapCart] Loaded orders from Supabase:', data.length);
        save(KEYS.orders, data, { silent: true });
        return data;
      }
    } catch (e) {
      console.warn('[SnapCart] fetchOrders', e);
    }
  } else {
    console.warn('[SnapCart] fetchOrders: offline mode (no Supabase client)');
  }
  return load(KEYS.orders, []);
}

async function updateOrderStatus(orderId, status) {
  const list = load(KEYS.orders, []);
  const o = list.find((x) => x.order_id === orderId);
  if (o) o.order_status = status;
  save(KEYS.orders, list);
  if (sb) {
    try {
      const { error } = await sb.from('orders').update({ order_status: status }).eq('order_id', orderId);
      if (error) console.warn('[SnapCart] updateOrderStatus remote', error);
    } catch (e) {
      console.warn('[SnapCart] updateOrderStatus', e);
    }
  }
  return { success: true };
}

async function deleteOrder(orderId) {
  save(
    KEYS.orders,
    load(KEYS.orders, []).filter((o) => o.order_id !== orderId)
  );
  if (sb) {
    try {
      const { error } = await sb.from('orders').delete().eq('order_id', orderId);
      if (error) console.warn('[SnapCart] deleteOrder remote', error);
    } catch (e) {
      console.warn('[SnapCart] deleteOrder', e);
    }
  }
  return { success: true };
}

async function trackOrder(orderId) {
  if (sb) {
    try {
      const { data, error } = await sb.from('orders').select('*').eq('order_id', orderId).maybeSingle();
      if (!error && data) return data;
    } catch (_) {}
  }
  return load(KEYS.orders, []).find((o) => o.order_id === orderId) || null;
}

/* Reviews */
async function fetchReviews(slug) {
  await seedStore();
  if (sb) {
    try {
      let q = sb.from('reviews').select('*').order('created_at', { ascending: false });
      if (slug) q = q.or(`product_slug.eq.${slug},product_slug.eq.`);
      const { data, error } = await q;
      if (!error && data?.length) {
        save(KEYS.reviews, data, { silent: true });
        return slug
          ? data.filter((r) => !r.product_slug || r.product_slug === slug)
          : data;
      }
    } catch (e) {
      console.warn('[SnapCart] fetchReviews', e);
    }
  }
  let list = load(KEYS.reviews, DEFAULT_REVIEWS);
  if (slug) list = list.filter((r) => !r.product_slug || r.product_slug === slug);
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function saveReview(review) {
  const payload = {
    id: review.id || Date.now(),
    customer_name: sanitize(review.customer_name),
    rating: Number(review.rating) || 5,
    review: sanitize(review.review),
    review_image: review.review_image || '',
    product_slug: review.product_slug || '',
    verified: review.verified !== false,
    created_at: review.created_at || new Date().toISOString(),
  };
  const list = load(KEYS.reviews, DEFAULT_REVIEWS);
  const i = list.findIndex((r) => String(r.id) === String(payload.id));
  if (i >= 0) list[i] = payload;
  else list.unshift(payload);
  save(KEYS.reviews, list);

  if (sb) {
    try {
      /* bigserial id: omit id on insert if new numeric timestamp */
      const row = {
        customer_name: payload.customer_name,
        rating: payload.rating,
        review: payload.review,
        review_image: payload.review_image,
        product_slug: payload.product_slug,
        verified: payload.verified,
        created_at: payload.created_at,
      };
      if (typeof payload.id === 'number' && payload.id < 1e12) {
        row.id = payload.id;
        const { error } = await sb.from('reviews').upsert(row, { onConflict: 'id' });
        if (error) console.warn('[SnapCart] saveReview remote', error);
      } else {
        const { error } = await sb.from('reviews').insert([row]);
        if (error) console.warn('[SnapCart] saveReview remote', error);
      }
    } catch (e) {
      console.warn('[SnapCart] saveReview', e);
    }
  }
  return { success: true };
}

async function deleteReview(id) {
  save(
    KEYS.reviews,
    load(KEYS.reviews, []).filter((r) => String(r.id) !== String(id))
  );
  if (sb) {
    try {
      const { error } = await sb.from('reviews').delete().eq('id', id);
      if (error) console.warn('[SnapCart] deleteReview remote', error);
    } catch (e) {
      console.warn('[SnapCart] deleteReview', e);
    }
  }
  return { success: true };
}

/* Banners & settings */
async function fetchBanners() {
  await seedStore();
  if (sb) {
    try {
      const { data, error } = await sb.from('banners').select('*').order('id');
      if (!error && data?.length) {
        save(KEYS.banners, data, { silent: true });
        return data.filter((b) => b.active !== false);
      }
    } catch (e) {
      console.warn('[SnapCart] fetchBanners', e);
    }
  }
  return load(KEYS.banners, DEFAULT_BANNERS).filter((b) => b.active !== false);
}

async function saveBanners(banners) {
  save(KEYS.banners, banners);
  if (sb) {
    try {
      /* replace set */
      await sb.from('banners').delete().neq('id', -1);
      const rows = banners.map((b, idx) => ({
        id: b.id || idx + 1,
        text: b.text,
        active: b.active !== false,
      }));
      if (rows.length) {
        const { error } = await sb.from('banners').upsert(rows);
        if (error) console.warn('[SnapCart] saveBanners remote', error);
      }
    } catch (e) {
      console.warn('[SnapCart] saveBanners', e);
    }
  }
  return { success: true };
}

async function fetchSettings() {
  await seedStore();
  if (sb) {
    try {
      const { data, error } = await sb.from('settings').select('data').eq('id', 'main').maybeSingle();
      if (!error && data?.data) {
        const merged = { ...DEFAULT_SETTINGS, ...data.data };
        save(KEYS.settings, merged, { silent: true });
        return merged;
      }
    } catch (e) {
      console.warn('[SnapCart] fetchSettings', e);
    }
  }
  return { ...DEFAULT_SETTINGS, ...load(KEYS.settings, DEFAULT_SETTINGS) };
}

async function saveSettings(partial) {
  const cur = await fetchSettings();
  const next = { ...cur, ...partial };
  save(KEYS.settings, next);
  if (sb) {
    try {
      const { error } = await sb.from('settings').upsert({
        id: 'main',
        data: next,
        updated_at: new Date().toISOString(),
      });
      if (error) console.warn('[SnapCart] saveSettings remote', error);
    } catch (e) {
      console.warn('[SnapCart] saveSettings', e);
    }
  }
  return { success: true };
}

/* Auth — Supabase Auth when configured, else local hashed password */
async function adminLogin(email, password) {
  await seedStore();
  initSupabase();

  if (sb) {
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { success: false, error: error.message };
      sessionStorage.setItem(
        KEYS.session,
        JSON.stringify({
          token: data.session?.access_token || 'sb',
          email: data.user?.email || email.trim(),
          exp: Date.now() + 12 * 60 * 60 * 1000,
          provider: 'supabase',
        })
      );
      return { success: true, provider: 'supabase' };
    } catch (e) {
      return { success: false, error: e.message || 'Login failed' };
    }
  }

  /* Offline / local fallback */
  const hash = localStorage.getItem(KEYS.adminHash);
  const okEmail = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const okPass = (await sha256(password)) === hash;
  if (!okEmail || !okPass) return { success: false, error: 'Invalid email or password' };
  const token = await sha256(hash + Date.now() + Math.random());
  sessionStorage.setItem(
    KEYS.session,
    JSON.stringify({ token, email: ADMIN_EMAIL, exp: Date.now() + 12 * 60 * 60 * 1000, provider: 'local' })
  );
  return { success: true, provider: 'local' };
}

async function adminLogout() {
  sessionStorage.removeItem(KEYS.session);
  if (sb) {
    try {
      await sb.auth.signOut();
    } catch (_) {}
  }
  return { success: true };
}

function isAdminLoggedIn() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEYS.session) || 'null');
    if (!s?.token || !s.exp || Date.now() > s.exp) {
      sessionStorage.removeItem(KEYS.session);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function changeAdminPassword(cur, next) {
  if (!next || next.length < 8) return { success: false, error: 'Use at least 8 characters' };

  if (sb) {
    /* Must already be logged in via Supabase Auth */
    try {
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) return { success: false, error: 'Not logged in with Supabase' };
      /* Re-auth then update */
      const email = userData.user.email;
      const { error: signErr } = await sb.auth.signInWithPassword({ email, password: cur });
      if (signErr) return { success: false, error: 'Current password incorrect' };
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) return { success: false, error: error.message };
      return { success: true, provider: 'supabase' };
    } catch (e) {
      return { success: false, error: e.message || 'Failed' };
    }
  }

  const hash = localStorage.getItem(KEYS.adminHash);
  if ((await sha256(cur)) !== hash) return { success: false, error: 'Current password incorrect' };
  localStorage.setItem(KEYS.adminHash, await sha256(next));
  return { success: true, provider: 'local' };
}

/** Quick connection test for setup */
async function testSupabaseConnection() {
  initSupabase();
  if (!sb) return { ok: false, message: 'Not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase.js' };
  try {
    const { error } = await sb.from('products').select('id').limit(1);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Connected. Tables reachable.' };
  } catch (e) {
    return { ok: false, message: e.message || 'Connection failed' };
  }
}

function fileToDataURL(file, maxW = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  seedStore();
  initSupabase();
});
