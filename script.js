/* SnapCart — Storefront app */
const state = {
  products: [],
  product: null,
  reviews: [],
  banners: [],
  settings: {},
  qty: 1,
  cart: [],
  galleryIndex: 0,
  page: 'home',
  submitting: false,
  revOffset: 0,
};

const INR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const PAGES = [
  'home', 'product', 'about', 'contact', 'track', 'checkout', 'success',
  'privacy', 'shipping', 'refund', 'terms', '404',
];

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    state.cart = JSON.parse(localStorage.getItem(KEYS.cart) || '[]');
  } catch {
    state.cart = [];
  }
  /* Fix any legacy duplicate cart rows from older builds */
  state.cart = mergeCartLines(state.cart);
  try {
    localStorage.setItem(KEYS.cart, JSON.stringify(state.cart));
  } catch (_) {}

  initLoader();
  initNav();
  const client = initSupabase();
  if (client) {
    console.info('[SnapCart] Boot: Supabase ready');
  } else {
    console.warn('[SnapCart] Boot: running OFFLINE (orders stay in this browser only)');
  }
  await seedStore();
  await refreshData();

  initQty();
  initBuy();
  initCart();
  initGallery();
  initFAQ();
  initForms();
  initReveal();
  initSticky();
  initSupport();

  window.addEventListener('hashchange', onRoute);

  /* Debounced admin/live updates — never loop with seedStore */
  let _refreshTimer = null;
  let _refreshing = false;
  window.addEventListener('sc:data', () => {
    if (_refreshing) return;
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(async () => {
      if (_refreshing) return;
      _refreshing = true;
      try {
        await refreshData(false);
      } finally {
        _refreshing = false;
      }
    }, 120);
  });

  onRoute();
});

async function refreshData(resetProduct = true) {
  state.products = await fetchProducts();
  if (resetProduct || !state.product) {
    state.product = state.products[0] || null;
  } else {
    /* keep current product in sync if still exists */
    const cur = state.products.find((p) => p.id === state.product.id || p.slug === state.product.slug);
    state.product = cur || state.products[0] || state.product;
  }
  state.reviews = await fetchReviews(state.page === 'product' ? state.product?.slug : undefined);
  state.banners = await fetchBanners();
  state.settings = await fetchSettings();

  renderAnnounce();
  renderHero();
  renderGrids();
  renderProductUI(state.product);
  renderGallery(state.product);
  renderReviews();
  renderCart();
  updateSummary();
}

/* ---------- Loader / Nav ---------- */
function initLoader() {
  const el = document.getElementById('loader');
  window.addEventListener('load', () => setTimeout(() => el?.classList.add('hide'), 600));
  setTimeout(() => el?.classList.add('hide'), 2000);
}

function initNav() {
  const nav = document.getElementById('navbar');
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');

  window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', scrollY > 16), { passive: true });

  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const page = el.getAttribute('data-nav');
      const scroll = el.getAttribute('data-scroll');
      if (!page) return;
      e.preventDefault();
      menu?.classList.remove('open');
      toggle?.classList.remove('open');
      document.body.style.overflow = '';
      if (page === 'home' && scroll) {
        location.hash = 'home';
        setTimeout(() => document.getElementById(scroll)?.scrollIntoView({ behavior: 'smooth' }), 80);
      } else {
        go(page);
      }
    });
  });
}

/* ---------- Routing ---------- */
function go(page) {
  if (!page) return;
  if (page === 'product' && state.product) {
    page = 'product/' + state.product.slug;
  }
  const next = '#' + String(page).replace(/^#/, '');
  if (location.hash === next) {
    onRoute();
    return;
  }
  location.hash = next.slice(1);
}

function onRoute() {
  const raw = (location.hash || '#home').slice(1);
  const parts = raw.split('/').filter(Boolean);
  const root = parts[0] || 'home';

  if (root === 'product') {
    const slug = parts[1];
    openProduct(slug);
    return;
  }

  if (!PAGES.includes(root)) {
    showPage('404');
    return;
  }

  showPage(root);
  if (root === 'home') {
    state.product = state.products[0] || state.product;
    renderProductUI(state.product);
    renderGallery(state.product);
    document.title = 'SnapCart — Intelligence Sound Book | ₹499';
  }
  if (root === 'checkout') updateSummary();
  if (root === 'success') {
    const id = sessionStorage.getItem('sc_last_order');
    if (id) {
      document.getElementById('successOrderId').textContent = id;
      confetti();
    }
  }
}

async function openProduct(slug) {
  if (!slug) {
    if (state.product?.slug) {
      if (location.hash !== '#product/' + state.product.slug) {
        location.hash = 'product/' + state.product.slug;
      }
      return;
    }
    return showPage('404');
  }

  let p = state.products.find((x) => x.slug === slug);
  if (!p) p = await fetchProductBySlug(slug);
  if (!p) return showPage('404');

  /* Skip full re-render if already showing this product page */
  const already =
    state.page === 'product' && state.product && state.product.slug === slug;
  state.product = p;
  if (!already) state.qty = 1;
  syncQty();
  showPage('product');
  renderProductUI(p);
  renderGallery(p);

  const crumb = document.getElementById('productCrumb');
  if (crumb) {
    crumb.innerHTML = `<a href="#home" data-nav="home">Home</a> <span class="crumb-sep">/</span> <span class="crumb-current">${esc(p.name)}</span>`;
    crumb.querySelector('[data-nav]')?.addEventListener('click', (e) => {
      e.preventDefault();
      go('home');
    });
  }
  const desc = document.getElementById('pdpDesc');
  if (desc) desc.textContent = p.description || '';
  const feats = document.getElementById('pdpFeatures');
  if (feats) feats.innerHTML = (p.features || []).map((f) => `<li>${esc(f)}</li>`).join('');

  state.reviews = await fetchReviews(slug);
  renderReviews();
  document.title = `${p.name} — ${INR(p.price)} | SnapCart`;
  updateSummary();
}

function showPage(name) {
  state.page = name;
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const el = document.getElementById('page-' + name);
  (el || document.getElementById('page-404')).classList.add('active');
  window.scrollTo(0, 0);
  /* Sticky buy bar ONLY on product detail page — never home/cart/track/etc. */
  const showSticky = name === 'product';
  document.body.classList.toggle('show-sticky', showSticky);
  const sb = document.getElementById('stickyBuy');
  if (sb) sb.style.display = showSticky ? '' : 'none';
}

/* ---------- Render helpers ---------- */
function renderAnnounce() {
  const track = document.getElementById('announceTrack');
  if (!track) return;
  const items = state.banners.length ? state.banners : [{ text: 'Free Shipping Across India' }];
  const html = [...items, ...items].map((b) => `<span>${esc(b.text)}</span>`).join('');
  track.innerHTML = html;
}

function renderHero() {
  const s = state.settings || {};
  const t = document.getElementById('heroTitle');
  const sub = document.getElementById('heroSub');
  const img = document.getElementById('heroImg');
  if (t && s.hero_title) t.innerHTML = s.hero_title.replace(/play/i, '<em>play</em>');
  if (sub && s.hero_subtitle) sub.textContent = s.hero_subtitle;
  if (img) img.src = s.hero_image || 'assets/images/product-front.png';
  const btn = document.getElementById('heroBuyBtn');
  if (btn && state.product) btn.textContent = `Buy Now — ${INR(state.product.price)}`;
  const cta = document.getElementById('ctaBuyBtn');
  if (cta && state.product) cta.textContent = `Order Now — ${INR(state.product.price)}`;
  const phone = document.getElementById('supportPhone');
  const mail = document.getElementById('supportEmail');
  if (phone && s.support_phone) phone.textContent = s.support_phone;
  if (mail && s.support_email) {
    mail.textContent = s.support_email;
    mail.href = 'mailto:' + s.support_email;
  }
}

function cardHTML(p) {
  const off = discountOf(p);
  const img = p.images?.[0] || 'assets/images/product-front.png';
  return `<article class="p-card" data-reveal>
    <a href="#product/${esc(p.slug)}" class="p-card-link">
      <div class="p-card-img">
        ${p.badge ? `<span class="p-badge">${esc(p.badge)}</span>` : ''}
        ${off ? `<span class="p-off">-${off}%</span>` : ''}
        <img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" width="320" height="320" />
      </div>
      <div class="p-card-body">
        <h3>${esc(p.name)}</h3>
        <div class="p-card-stars">★★★★★</div>
        <div class="p-card-price">
          <strong>${INR(p.price)}</strong>
          ${p.original_price ? `<s>${INR(p.original_price)}</s>` : ''}
        </div>
      </div>
    </a>
    <button type="button" class="btn btn-primary btn-sm" data-add="${esc(p.slug)}">Add to Cart</button>
  </article>`;
}

function renderGrids() {
  const all = state.products;
  const map = {
    'grid-all': all,
    'grid-flash': all.filter((p) => p.flags?.flash_sale),
    'grid-bestsellers': all.filter((p) => p.flags?.bestseller),
  };
  Object.entries(map).forEach(([id, list]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const items = list.length ? list : all;
    el.innerHTML = items.map(cardHTML).join('');
  });
  initFlashTimer();
  initReveal();
}

function renderProductUI(p) {
  if (!p) return;
  const off = discountOf(p);
  const set = (id, val) => {
    document.querySelectorAll('#' + id + ', [data-bind="' + id + '"]').forEach((el) => {
      el.textContent = val;
    });
  };
  set('productName', p.name);
  set('priceNow', INR(p.price));
  set('priceWas', INR(p.original_price));
  set('priceOff', off ? off + '% OFF' : '');
  set('stickyPrice', INR(p.price));
  set('stockStatus', p.stock > 0 ? `In Stock — only ${p.stock} left` : 'Out of Stock');

  const badges = ['Limited Time Offer', "Today's Deal", 'Best Value', 'Special Offer'];
  if (off >= 50) badges.unshift('Save ' + off + '%');
  const html = badges.slice(0, 4).map((b, i) => `<span class="deal deal-${i}">${b}</span>`).join('');
  ['offerBadges', 'offerBadgesPdp'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  const hf = document.getElementById('homeFeatures');
  if (hf) hf.innerHTML = (p.features || []).map((f) => `<li>${esc(f)}</li>`).join('');
}

function renderGallery(p) {
  const images = p?.images?.length ? p.images : ['assets/images/product-front.png'];
  const html = images
    .map(
      (src, i) =>
        `<button type="button" class="gallery-thumb ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Image ${i + 1}">
          <img src="${esc(src)}" alt="" loading="lazy" />
        </button>`
    )
    .join('');
  ['galleryThumbs', 'galleryThumbsPdp'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
    el.querySelectorAll('.gallery-thumb').forEach((btn) => {
      btn.addEventListener('click', () => setGallery(+btn.dataset.i));
    });
  });
  state.galleryIndex = 0;
  setGallery(0);
}

function setGallery(i) {
  const images = state.product?.images || ['assets/images/product-front.png'];
  state.galleryIndex = ((i % images.length) + images.length) % images.length;
  const src = images[state.galleryIndex];
  ['mainImage', 'mainImagePdp'].forEach((id) => {
    const img = document.getElementById(id);
    if (img) img.src = src;
  });
  document.querySelectorAll('.gallery-thumb').forEach((t) => {
    t.classList.toggle('active', +t.dataset.i === state.galleryIndex);
  });
}

function initGallery() {
  const open = () => {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lbImg');
    const images = state.product?.images || [];
    if (!images.length) return;
    img.src = images[state.galleryIndex];
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    document.getElementById('lightbox')?.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.getElementById('galleryMain')?.addEventListener('click', open);
  document.getElementById('galleryMainPdp')?.addEventListener('click', open);
  document.getElementById('lbClose')?.addEventListener('click', close);
  document.getElementById('lightbox')?.addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') close();
  });
  document.getElementById('lbPrev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setGallery(state.galleryIndex - 1);
    document.getElementById('lbImg').src = state.product.images[state.galleryIndex];
  });
  document.getElementById('lbNext')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setGallery(state.galleryIndex + 1);
    document.getElementById('lbImg').src = state.product.images[state.galleryIndex];
  });
}

/* ---------- Qty / Buy / Cart ---------- */
function initQty() {
  const minus = () => {
    if (state.qty > 1) {
      state.qty--;
      syncQty();
    }
  };
  const plus = () => {
    if (state.qty < 10) {
      state.qty++;
      syncQty();
    }
  };
  document.getElementById('qtyMinus')?.addEventListener('click', minus);
  document.getElementById('qtyPlus')?.addEventListener('click', plus);
  document.getElementById('qtyMinusPdp')?.addEventListener('click', minus);
  document.getElementById('qtyPlusPdp')?.addEventListener('click', plus);
}

function syncQty() {
  document.querySelectorAll('#qtyVal, #qtyValPdp').forEach((el) => {
    el.textContent = state.qty;
  });
  updateSummary();
}

function initBuy() {
  const add = (e) => {
    e?.preventDefault?.();
    addToCart(state.qty || 1);
    toast('Added to cart');
    openCart();
  };
  const buy = (e) => {
    e?.preventDefault?.();
    addToCart(state.qty || 1);
    closeCart();
    go('checkout');
  };

  ['addCartBtn', 'addCartBtnPdp'].forEach((id) =>
    document.getElementById(id)?.addEventListener('click', add)
  );
  ['buyNowBtn', 'buyNowBtnPdp', 'stickyBuyBtn', 'heroBuyBtn', 'ctaBuyBtn'].forEach((id) =>
    document.getElementById(id)?.addEventListener('click', buy)
  );

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const p = state.products.find((x) => x.slug === btn.getAttribute('data-add'));
    if (!p) return;
    state.product = p;
    addToCart(1);
    toast('Added to cart');
    openCart();
  });

  document.getElementById('cartCheckout')?.addEventListener('click', () => {
    closeCart();
    go('checkout');
  });
}

/* ---------- Single source of truth for money math ---------- */
function lineTotal(item) {
  const price = Number(item?.price) || 0;
  const qty = Math.max(0, parseInt(item?.qty, 10) || 0);
  return price * qty;
}

/** Total = Σ (unit price × quantity). Never anything else. */
function calcOrderTotal(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

function calcOrderQty(items) {
  if (!Array.isArray(items) || !items.length) return 0;
  return items.reduce((sum, item) => sum + (Math.max(0, parseInt(item?.qty, 10) || 0)), 0);
}

/**
 * Merge duplicate product rows into one line each.
 * Key = id if present, else slug. Qty is summed; price taken from latest.
 */
function mergeCartLines(items) {
  const map = new Map();
  (items || []).forEach((raw) => {
    if (!raw) return;
    const id = raw.id != null && raw.id !== '' ? String(raw.id) : '';
    const slug = raw.slug != null && raw.slug !== '' ? String(raw.slug) : '';
    const key = id || slug;
    if (!key) return;
    const qty = Math.max(0, parseInt(raw.qty, 10) || 0);
    if (qty <= 0) return;
    const price = Number(raw.price) || 0;
    if (map.has(key)) {
      const cur = map.get(key);
      cur.qty = Math.min(10, cur.qty + qty);
      /* keep a valid unit price */
      if (price > 0) cur.price = price;
      if (raw.original_price != null) cur.original_price = Number(raw.original_price) || cur.original_price;
      if (raw.image) cur.image = raw.image;
      if (raw.name) cur.name = raw.name;
      if (!cur.id && id) cur.id = raw.id;
      if (!cur.slug && slug) cur.slug = raw.slug;
    } else {
      map.set(key, {
        id: raw.id || id,
        slug: raw.slug || slug,
        name: raw.name || 'Product',
        price,
        original_price: Number(raw.original_price) || price,
        image: raw.image || 'assets/images/product-front.png',
        qty: Math.min(10, qty),
      });
    }
  });
  return Array.from(map.values());
}

function normalizeCart() {
  state.cart = mergeCartLines(state.cart);
  return state.cart;
}

function addToCart(qty) {
  let p = state.product || state.products[0];
  if (!p) {
    toast('No product available');
    return;
  }
  state.product = p;
  const addQty = Math.max(1, parseInt(qty, 10) || 1);
  const unitPrice = Number(p.price) || 0;
  const img = (p.images && p.images[0]) || 'assets/images/product-front.png';

  /* Always merge first so we never create a second row */
  normalizeCart();

  const existing = state.cart.find(
    (c) =>
      (p.id != null && String(c.id) === String(p.id)) ||
      (p.slug && c.slug && String(c.slug) === String(p.slug))
  );

  if (existing) {
    existing.qty = Math.min(10, (parseInt(existing.qty, 10) || 0) + addQty);
    existing.price = unitPrice;
    existing.original_price = Number(p.original_price) || unitPrice;
    existing.image = img;
    existing.name = p.name;
    existing.id = p.id;
    existing.slug = p.slug;
  } else {
    state.cart.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: unitPrice,
      original_price: Number(p.original_price) || unitPrice,
      image: img,
      qty: Math.min(10, addQty),
    });
  }

  normalizeCart();
  persistCart();
  renderCart();
  updateSummary();
}

function persistCart() {
  normalizeCart();
  localStorage.setItem(KEYS.cart, JSON.stringify(state.cart));
}

function cartQty() {
  return calcOrderQty(state.cart);
}

function cartTotal() {
  return calcOrderTotal(state.cart);
}

function renderCart() {
  normalizeCart();
  const body = document.getElementById('cartBody');
  const foot = document.getElementById('cartFoot');
  const badge = document.getElementById('cartBadge');
  const q = cartQty();
  if (badge) {
    badge.textContent = String(q);
    badge.classList.toggle('show', q > 0);
  }
  if (!body) return;

  if (!state.cart.length) {
    body.innerHTML = `<div class="cart-empty"><p>Your cart is empty</p>
      <button type="button" class="btn btn-primary btn-sm" id="cartContinue" style="margin-top:16px">Continue Shopping</button></div>`;
    if (foot) foot.style.display = 'none';
    return;
  }

  body.innerHTML = state.cart
    .map((c, i) => {
      const unit = Number(c.price) || 0;
      const qty = parseInt(c.qty, 10) || 0;
      const rowTotal = unit * qty;
      return `<div class="cart-item">
      <img src="${esc(c.image || 'assets/images/product-front.png')}" alt="" width="70" height="70" />
      <div class="cart-item-info">
        <h4>${esc(c.name)}</h4>
        <div class="price">${INR(unit)} × ${qty} = <strong>${INR(rowTotal)}</strong></div>
        <div class="cart-item-qty">
          <button type="button" data-act="dec" data-i="${i}" aria-label="Decrease">−</button>
          <span>${qty}</span>
          <button type="button" data-act="inc" data-i="${i}" aria-label="Increase">+</button>
          <button type="button" class="rm" data-act="rm" data-i="${i}">Remove</button>
        </div>
      </div>
    </div>`;
    })
    .join('');
  if (foot) foot.style.display = 'block';
  const tot = document.getElementById('cartTotal');
  if (tot) tot.textContent = INR(cartTotal());
}

function changeCartQty(i, d) {
  i = Number(i);
  normalizeCart();
  if (!state.cart[i]) return;
  const next = (parseInt(state.cart[i].qty, 10) || 0) + d;
  if (next <= 0) state.cart.splice(i, 1);
  else state.cart[i].qty = Math.min(10, next);
  persistCart();
  renderCart();
  updateSummary();
}

function removeCartItem(i) {
  i = Number(i);
  normalizeCart();
  if (i < 0 || i >= state.cart.length) return;
  state.cart.splice(i, 1);
  persistCart();
  renderCart();
  updateSummary();
  toast('Removed from cart');
}

function initCart() {
  document.getElementById('cartBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCart();
  });
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);

  const body = document.getElementById('cartBody');
  body?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (btn) {
      e.preventDefault();
      const act = btn.getAttribute('data-act');
      const i = btn.getAttribute('data-i');
      if (act === 'dec') changeCartQty(i, -1);
      else if (act === 'inc') changeCartQty(i, 1);
      else if (act === 'rm') removeCartItem(i);
      return;
    }
    if (e.target.id === 'cartContinue' || e.target.closest('#cartContinue')) {
      closeCart();
      go('home');
    }
  });
}

function openCart() {
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- Checkout ---------- */
/**
 * Prepare cart for checkout WITHOUT silently multiplying items.
 * - Merges duplicates
 * - Only if cart is empty, adds current product once at page qty (or 1)
 */
function ensureCartForCheckout() {
  normalizeCart();
  if (state.cart.length) return;
  const p = state.product || state.products[0];
  if (!p) return;
  state.product = p;
  const q = Math.max(1, Math.min(10, parseInt(state.qty, 10) || 1));
  state.cart = [
    {
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: Number(p.price) || 0,
      original_price: Number(p.original_price) || Number(p.price) || 0,
      image: (p.images && p.images[0]) || 'assets/images/product-front.png',
      qty: q,
    },
  ];
  persistCart();
}

function updateSummary() {
  normalizeCart();
  /* Display-only: never call addToCart here (that caused inflated totals) */
  let lines = state.cart.slice();
  if (!lines.length && state.product) {
    const q = Math.max(1, Math.min(10, parseInt(state.qty, 10) || 1));
    lines = [
      {
        name: state.product.name,
        price: Number(state.product.price) || 0,
        original_price: Number(state.product.original_price) || Number(state.product.price) || 0,
        image: (state.product.images && state.product.images[0]) || 'assets/images/product-front.png',
        qty: q,
      },
    ];
  }

  const qty = calcOrderQty(lines);
  const sub = calcOrderTotal(lines);
  const orig = lines.reduce((s, c) => {
    const unit = Number(c.original_price != null ? c.original_price : c.price) || 0;
    const q = Math.max(0, parseInt(c.qty, 10) || 0);
    return s + unit * q;
  }, 0);

  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set('sumQty', qty || 0);
  set('sumSub', INR(sub));
  set('sumDisc', '−' + INR(Math.max(0, orig - sub)));
  set('sumTotal', INR(sub));

  const first = lines[0];
  if (first) {
    set('sumName', first.name || (state.product && state.product.name) || 'Product');
    set('sumUnit', INR(Number(first.price) || 0));
    const img = document.getElementById('sumImg');
    if (img) img.src = first.image || 'assets/images/product-front.png';
  }
}

function initForms() {
  document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckout);
  document.getElementById('trackForm')?.addEventListener('submit', handleTrack);
  document.getElementById('contactForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    toast('Thanks! We’ll reply soon.');
    e.target.reset();
  });
  document.addEventListener('input', (e) => {
    if (e.target.classList?.contains('error') && e.target.checkValidity()) {
      e.target.classList.remove('error');
    }
  });
}

async function handleCheckout(e) {
  e.preventDefault();
  if (state.submitting) return;
  const form = e.target;
  const required = ['customer_name', 'phone', 'house', 'street', 'city', 'state', 'pincode'];
  let ok = true;
  required.forEach((n) => {
    const input = form[n];
    if (!input) return;
    if (!input.checkValidity()) {
      input.classList.add('error');
      ok = false;
    } else input.classList.remove('error');
  });
  if (!/^[6-9]\d{9}$/.test(form.phone.value.trim())) {
    form.phone.classList.add('error');
    ok = false;
  }
  if (!/^[1-9]\d{5}$/.test(form.pincode.value.trim())) {
    form.pincode.classList.add('error');
    ok = false;
  }
  if (!ok) {
    toast('Please fill required fields correctly');
    form.querySelector('.error')?.focus();
    return;
  }

  ensureCartForCheckout();
  normalizeCart();

  if (!state.cart.length) {
    toast('Your cart is empty');
    return;
  }

  /* Build order lines once — total is ONLY price × qty */
  const orderProducts = state.cart.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    price: Number(c.price) || 0,
    qty: Math.max(1, parseInt(c.qty, 10) || 1),
  }));
  const orderTotal = calcOrderTotal(orderProducts);
  const orderQty = calcOrderQty(orderProducts);

  if (orderTotal <= 0) {
    toast('Invalid order total');
    return;
  }

  state.submitting = true;
  const btn = document.getElementById('placeOrderBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Placing order…';
  }

  try {
    if (typeof initSupabase === 'function') initSupabase();

    const result = await saveOrder({
      customer_name: form.customer_name.value,
      phone: form.phone.value,
      alternate_phone: form.alternate_phone?.value || '',
      email: form.email?.value || '',
      house: form.house.value,
      street: form.street.value,
      landmark: form.landmark?.value || '',
      city: form.city.value,
      state: form.state.value,
      pincode: form.pincode.value,
      order_notes: form.order_notes?.value || '',
      total: orderTotal,
      quantity: orderQty,
      products: orderProducts,
    });

    console.log('[SnapCart] checkout result', result, { orderTotal, orderQty, orderProducts });

    if (result.success) {
      sessionStorage.setItem('sc_last_order', result.order_id);
      state.cart = [];
      persistCart();
      renderCart();
      form.reset();
      go('success');
      const oid = document.getElementById('successOrderId');
      if (oid) oid.textContent = result.order_id;
      confetti();
      if (result.offline) {
        toast('Order saved on this device only — cloud sync failed');
        console.error('[SnapCart] Order NOT in Supabase:', result.error);
      } else {
        toast('Order placed & saved to cloud!');
      }
    } else toast('Something went wrong');
  } catch (err) {
    console.error(err);
    toast('Could not place order');
  } finally {
    state.submitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Place Order';
    }
  }
}

async function handleTrack(e) {
  e.preventDefault();
  const id = document.getElementById('trackInput').value.trim().toUpperCase();
  const box = document.getElementById('trackResult');
  box.classList.add('show');
  box.innerHTML = '<p style="color:var(--g500)">Looking up…</p>';
  const order = await trackOrder(id);
  if (!order) {
    box.innerHTML = '<p style="color:var(--red);font-weight:600">Order not found.</p><p style="font-size:13px;color:var(--g500);margin-top:8px">Check the ID (format SC-XXXX-XXXX).</p>';
    return;
  }
  const st = (order.order_status || 'pending').toLowerCase();
  /* Prefer recomputed total from line items if present (fixes legacy bad totals) */
  let displayTotal = Number(order.total) || 0;
  let displayQty = Number(order.quantity) || 0;
  if (Array.isArray(order.products) && order.products.length) {
    displayTotal = calcOrderTotal(order.products);
    displayQty = calcOrderQty(order.products);
  }
  const linesHtml = Array.isArray(order.products) && order.products.length
    ? order.products
        .map((p) => {
          const unit = Number(p.price) || 0;
          const q = parseInt(p.qty, 10) || 0;
          return `<div class="track-detail" style="padding-left:8px">• ${esc(p.name || 'Product')} — ${INR(unit)} × ${q} = ${INR(unit * q)}</div>`;
        })
        .join('')
    : '';
  box.innerHTML = `
    <span class="badge ${st}">${st}</span>
    <div class="track-detail"><strong>Order ID:</strong> ${esc(order.order_id)}</div>
    <div class="track-detail"><strong>Customer:</strong> ${esc(order.customer_name)}</div>
    <div class="track-detail"><strong>Items:</strong> ${displayQty || '—'}</div>
    ${linesHtml}
    <div class="track-detail"><strong>Total:</strong> ${INR(displayTotal)}</div>
    <div class="track-detail"><strong>Payment:</strong> COD</div>
    <div class="track-detail"><strong>Ship to:</strong> ${esc(order.city)}, ${esc(order.state)} — ${esc(order.pincode)}</div>
    <div class="track-detail"><strong>Placed:</strong> ${order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : '—'}</div>
  `;
}

/* ---------- Reviews / FAQ ---------- */
function renderReviews() {
  const track = document.getElementById('reviewsTrack');
  const list = state.reviews || [];
  if (track) {
    track.innerHTML = list
      .map((r) => {
        const initial = (r.customer_name || 'A')[0].toUpperCase();
        const date = r.created_at
          ? new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        const photo = r.review_image
          ? `<div class="rev-photo"><img src="${esc(r.review_image)}" alt="" loading="lazy" /></div>`
          : '';
        return `<article class="rev-card">${photo}
          <div class="rev-body">
            <div class="rev-top">
              <div class="rev-av">${initial}</div>
              <div>
                <div class="rev-name">${esc(r.customer_name)}</div>
                <div class="rev-meta">${r.verified !== false ? '<span class="verified">✓ Verified</span> · ' : ''}${date}</div>
              </div>
            </div>
            <div class="rev-stars">${'★'.repeat(r.rating || 5)}</div>
            <p class="rev-text">${esc(r.review)}</p>
          </div>
        </article>`;
      })
      .join('');
  }

  const masonryHTML = list
    .filter((r) => r.review_image)
    .map(
      (r) => `<figure>
        <img src="${esc(r.review_image)}" alt="${esc(r.customer_name)}" loading="lazy" />
        <figcaption>
          <div class="rev-stars">${'★'.repeat(r.rating || 5)}</div>
          “${esc(r.review)}”
          <strong>${esc(r.customer_name)} · Verified</strong>
        </figcaption>
      </figure>`
    )
    .join('');
  ['reviewsMasonry', 'reviewsMasonryPdp'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = masonryHTML;
  });

  const prev = document.getElementById('revPrev');
  const next = document.getElementById('revNext');
  if (track && prev && next && !track.dataset.bound) {
    track.dataset.bound = '1';
    const step = () => (track.querySelector('.rev-card')?.offsetWidth || 300) + 16;
    prev.onclick = () => {
      state.revOffset = Math.min(0, state.revOffset + step());
      track.style.transform = `translateX(${state.revOffset}px)`;
      track.style.transition = 'transform .4s ease';
    };
    next.onclick = () => {
      const max = -(track.scrollWidth - track.parentElement.offsetWidth);
      state.revOffset = Math.max(max - 20, state.revOffset - step());
      track.style.transform = `translateX(${state.revOffset}px)`;
      track.style.transition = 'transform .4s ease';
    };
    setInterval(() => {
      if (document.hidden || (state.page !== 'home' && state.page !== 'product')) return;
      const max = -(track.scrollWidth - track.parentElement.offsetWidth);
      if (max >= 0) return;
      state.revOffset -= step();
      if (state.revOffset < max - 40) state.revOffset = 0;
      track.style.transition = 'transform .5s ease';
      track.style.transform = `translateX(${state.revOffset}px)`;
    }, 4200);
  }
}

function initFAQ() {
  const items = [
    ['How long does delivery take?', 'Orders ship within 24 hours and arrive in 3–6 business days across India.'],
    ['Is COD available?', 'Yes. Cash on Delivery is available on all orders.'],
    ['What is your return policy?', '7-day easy returns on unused products in original packaging. Damaged items replaced free.'],
    ['How do I track my order?', 'Use Track Order in the menu and enter your Order ID from checkout.'],
    ['Are batteries included?', 'AAA batteries are not included due to shipping rules.'],
    ['How do I contact support?', 'Email hello@snapcart.in or call +91 98765 43210 (Mon–Sat, 10–6 IST).'],
  ];
  const box = document.getElementById('faqList');
  if (!box) return;
  box.innerHTML = items
    .map(
      ([q, a]) => `<div class="faq-item">
      <button type="button" class="faq-q">${esc(q)}<span class="faq-ico">+</span></button>
      <div class="faq-a"><p>${esc(a)}</p></div>
    </div>`
    )
    .join('');
  box.querySelectorAll('.faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = item.classList.contains('open');
      box.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });
}

/* ---------- UX extras ---------- */
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]:not(.in)');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -24px 0px' }
  );
  els.forEach((el) => io.observe(el));
}

function initSticky() {
  const sticky = document.getElementById('stickyBuy');
  const buy = document.querySelector('.buy-row');
  if (!sticky || !buy || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    ([en]) => {
      if (innerWidth > 768) {
        sticky.style.opacity = '0';
        sticky.style.pointerEvents = 'none';
        return;
      }
      sticky.style.opacity = en.isIntersecting ? '0' : '1';
      sticky.style.pointerEvents = en.isIntersecting ? 'none' : 'auto';
    },
    { threshold: 0.15 }
  );
  io.observe(buy);
}

function initSupport() {
  document.getElementById('supportFab')?.addEventListener('click', () => go('contact'));
}

function initFlashTimer() {
  const el = document.getElementById('flashTimer');
  if (!el || el.dataset.on) return;
  el.dataset.on = '1';
  const end = Date.now() + 14 * 3600 * 1000;
  const tick = () => {
    const d = Math.max(0, end - Date.now());
    const h = String((d / 3600000) | 0).padStart(2, '0');
    const m = String(((d % 3600000) / 60000) | 0).padStart(2, '0');
    const s = String(((d % 60000) / 1000) | 0).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  };
  tick();
  setInterval(tick, 1000);
}

function toast(msg) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

function confetti() {
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const colors = ['#0071e3', '#2997ff', '#34c759', '#ff9500', '#ff3b30'];
  const pcs = Array.from({ length: 100 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: colors[(Math.random() * colors.length) | 0],
    vy: 2 + Math.random() * 3,
    vx: -1 + Math.random() * 2,
    r: Math.random() * Math.PI,
    vr: -0.1 + Math.random() * 0.2,
  }));
  let f = 0;
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pcs.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = 1 - f / 140;
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    f++;
    if (f < 140) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

window.go = go;
window.openCart = openCart;
window.closeCart = closeCart;
