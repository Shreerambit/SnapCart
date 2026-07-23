/* SnapCart Admin */
let orders = [];
let products = [];
let reviews = [];
let banners = [];
let editImages = [];

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  seedStore();
  if (isAdminLoggedIn()) showDash();

  $('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const res = await adminLogin($('loginEmail').value.trim(), $('loginPass').value);
    if (res.success) showDash();
    else {
      $('loginErr').textContent = res.error || 'Invalid credentials';
      $('loginErr').style.display = 'block';
    }
  };

  $('logoutBtn').onclick = async () => {
    await adminLogout();
    $('dashView').classList.remove('on');
    $('loginView').style.display = 'flex';
  };

  document.querySelectorAll('#tabs button').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('on'));
      $('p-' + btn.dataset.p).classList.add('on');
    };
  });

  $('orderQ').oninput = renderOrders;
  $('orderF').onchange = renderOrders;
  $('refOrders').onclick = loadOrders;
  $('exportBtn').onclick = exportCSV;

  $('newProd').onclick = () => openProd(null);
  $('cancelProd').onclick = () => ($('prodEditor').style.display = 'none');
  $('saveProd').onclick = saveProd;
  $('pName').oninput = () => {
    if (!$('pSlug').dataset.lock) {
      $('pSlug').value = slugify($('pName').value);
      $('slugPrev').textContent = $('pSlug').value || '…';
    }
  };
  $('pSlug').onchange = () => {
    $('pSlug').dataset.lock = '1';
    $('slugPrev').textContent = slugify($('pSlug').value);
  };
  $('pFiles').onchange = async (e) => {
    for (const f of e.target.files) {
      try {
        editImages.push(await fileToDataURL(f));
      } catch (_) {}
    }
    renderImgs();
    e.target.value = '';
  };
  $('addImgUrl').onclick = () => {
    const v = $('pImgUrl').value.trim();
    if (!v) return;
    editImages.push(v);
    $('pImgUrl').value = '';
    renderImgs();
  };

  $('newRev').onclick = () => openRev(null);
  $('cancelRev').onclick = () => ($('revEditor').style.display = 'none');
  $('saveRev').onclick = saveRev;
  $('rFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('rImg').value = await fileToDataURL(f);
  };

  $('addBan').onclick = () => {
    window.banners = window.banners || banners;
    window.banners.push({ id: Date.now(), text: 'New promo', active: true });
    banners = window.banners;
    renderBans();
  };
  $('saveBan').onclick = async () => {
    banners = window.banners || banners;
    await saveBanners(banners);
    toast('Banners saved');
  };

  $('saveSet').onclick = saveSet;
  $('sHeroFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) $('sHero').value = await fileToDataURL(f, 1600);
  };

  $('chgPass').onclick = async () => {
    if ($('newP').value !== $('newP2').value) return toast('Passwords do not match');
    const res = await changeAdminPassword($('curP').value, $('newP').value);
    toast(res.success ? 'Password updated' : res.error || 'Failed');
    if (res.success) {
      $('curP').value = '';
      $('newP').value = '';
      $('newP2').value = '';
    }
  };
});

async function showDash() {
  $('loginView').style.display = 'none';
  $('dashView').classList.add('on');
  await Promise.all([loadOrders(), loadProds(), loadRevs(), loadBans(), loadSet()]);
}

/** Prefer Σ(price×qty) from line items when available (fixes legacy bad totals). */
function displayOrderTotal(o) {
  if (Array.isArray(o?.products) && o.products.length) {
    return o.products.reduce((s, p) => {
      const price = Number(p?.price) || 0;
      const qty = Math.max(0, parseInt(p?.qty, 10) || 0);
      return s + price * qty;
    }, 0);
  }
  return Number(o?.total) || 0;
}

function stats() {
  const rev = orders
    .filter((o) => (o.order_status || '') !== 'cancelled')
    .reduce((s, o) => s + displayOrderTotal(o), 0);
  $('stOrders').textContent = orders.length;
  $('stRev').textContent = '₹' + rev.toLocaleString('en-IN');
  $('stProd').textContent = products.length;
  $('stPend').textContent = orders.filter((o) => (o.order_status || '') === 'pending').length;
}

async function loadOrders() {
  orders = await fetchOrders();
  stats();
  renderOrders();
}

function renderOrders() {
  const q = ($('orderQ').value || '').toLowerCase();
  const f = $('orderF').value;
  let list = [...orders];
  if (f) list = list.filter((o) => (o.order_status || '') === f);
  if (q)
    list = list.filter((o) =>
      [o.order_id, o.customer_name, o.phone, o.city].join(' ').toLowerCase().includes(q)
    );
  const tb = $('ordersBody');
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="8" class="empty">No orders</td></tr>';
    return;
  }
  tb.innerHTML = list
    .map((o) => {
      const st = (o.order_status || 'pending').toLowerCase();
      const d = o.created_at
        ? new Date(o.created_at).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—';
      return `<tr>
      <td><strong>${esc(o.order_id)}</strong></td>
      <td>${esc(o.customer_name)}<br><span style="font-size:11px;color:var(--g400)">${esc(o.house)}, ${esc(o.street)}</span></td>
      <td>${esc(o.phone)}</td>
      <td>${esc(o.city)}</td>
      <td><strong>₹${Number(displayOrderTotal(o)).toLocaleString('en-IN')}</strong></td>
      <td><span class="badge ${st}">${st}</span></td>
      <td>${d}</td>
      <td><div class="acts">
        <select onchange="setStatus('${esc(o.order_id)}',this.value)">
          ${['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
            .map((s) => `<option ${s === st ? 'selected' : ''}>${s}</option>`)
            .join('')}
        </select>
        <button type="button" class="danger" onclick="delOrder('${esc(o.order_id)}')">Delete</button>
      </div></td>
    </tr>`;
    })
    .join('');
}

async function setStatus(id, status) {
  await updateOrderStatus(id, status);
  const o = orders.find((x) => x.order_id === id);
  if (o) o.order_status = status;
  stats();
  renderOrders();
  toast('Status → ' + status);
}
async function delOrder(id) {
  if (!confirm('Delete ' + id + '?')) return;
  await deleteOrder(id);
  orders = orders.filter((o) => o.order_id !== id);
  stats();
  renderOrders();
  toast('Deleted');
}

function exportCSV() {
  if (!orders.length) return toast('No orders');
  const h = [
    'order_id',
    'customer_name',
    'phone',
    'city',
    'state',
    'pincode',
    'total',
    'order_status',
    'created_at',
  ];
  const rows = orders.map((o) =>
    h
      .map((k) => {
        const s = o[k] == null ? '' : String(o[k]);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      })
      .join(',')
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([[h.join(','), ...rows].join('\n')], { type: 'text/csv' }));
  a.download = 'snapcart-orders.csv';
  a.click();
}

async function loadProds() {
  products = await fetchAllProductsAdmin();
  stats();
  renderProds();
}

function renderProds() {
  const tb = $('prodBody');
  if (!products.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty">No products</td></tr>';
    return;
  }
  tb.innerHTML = products
    .map(
      (p) => `<tr>
    <td><img class="thumb" src="${esc(p.images?.[0] || 'assets/images/product-front.png')}" alt="" /></td>
    <td><strong>${esc(p.name)}</strong><br><span style="font-size:11px;color:var(--g400)">${esc(p.badge || '')}</span></td>
    <td><code>#product/${esc(p.slug)}</code></td>
    <td>₹${p.price}<br><s style="color:var(--g400)">₹${p.original_price || ''}</s></td>
    <td>${p.stock ?? '—'}</td>
    <td><div class="acts">
      <button type="button" onclick="editProd('${esc(p.id)}')">Edit</button>
      <button type="button" class="danger" onclick="delProd('${esc(p.id)}')">Delete</button>
      <a class="btn btn-sm btn-secondary" href="index.html#product/${esc(p.slug)}" target="_blank">View</a>
    </div></td>
  </tr>`
    )
    .join('');
}

function openProd(p) {
  $('prodEditor').style.display = 'block';
  $('prodEditorTitle').textContent = p ? 'Edit product' : 'Add product';
  $('pSlug').dataset.lock = p ? '1' : '';
  $('pId').value = p?.id || '';
  $('pName').value = p?.name || '';
  $('pSlug').value = p?.slug || '';
  $('slugPrev').textContent = p?.slug || '…';
  $('pPrice').value = p?.price ?? 499;
  $('pMrp').value = p?.original_price ?? 1299;
  $('pStock').value = p?.stock ?? 50;
  $('pBadge').value = p?.badge || '';
  $('pDesc').value = p?.description || '';
  $('pActive').checked = p?.active !== false;
  ['bestseller', 'featured', 'trending', 'latest', 'flash_sale', 'recommended'].forEach((f) => {
    const el = $('f_' + f);
    if (el) el.checked = !!p?.flags?.[f];
  });
  editImages = [...(p?.images || ['assets/images/product-front.png'])];
  renderImgs();
  $('prodEditor').scrollIntoView({ behavior: 'smooth' });
}

function renderImgs() {
  $('pImgs').innerHTML = editImages
    .map(
      (src, i) =>
        `<div class="chip"><img src="${esc(src)}" alt="" /><button type="button" onclick="rmImg(${i})">×</button></div>`
    )
    .join('');
}
function rmImg(i) {
  editImages.splice(i, 1);
  renderImgs();
}

async function saveProd() {
  const name = $('pName').value.trim();
  const slug = slugify($('pSlug').value || name);
  const price = Number($('pPrice').value);
  if (!name || !slug || !price) return toast('Name, slug, price required');
  const flags = {};
  ['bestseller', 'featured', 'trending', 'latest', 'flash_sale', 'recommended'].forEach((f) => {
    flags[f] = !!$('f_' + f)?.checked;
  });
  await saveProduct({
    id: $('pId').value || 'sc-' + Date.now(),
    name,
    slug,
    price,
    original_price: Number($('pMrp').value) || price,
    stock: Number($('pStock').value) || 0,
    badge: $('pBadge').value.trim(),
    description: $('pDesc').value.trim(),
    images: editImages.length ? editImages : ['assets/images/product-front.png'],
    flags,
    active: $('pActive').checked,
  });
  $('prodEditor').style.display = 'none';
  await loadProds();
  toast('Product saved — live on store');
}

function editProd(id) {
  const p = products.find((x) => x.id === id);
  if (p) openProd(p);
}
async function delProd(id) {
  if (!confirm('Delete product?')) return;
  await deleteProduct(id);
  await loadProds();
  toast('Deleted');
}

async function loadRevs() {
  reviews = await fetchReviews();
  renderRevs();
}
function renderRevs() {
  const tb = $('revBody');
  if (!reviews.length) {
    tb.innerHTML = '<tr><td colspan="5" class="empty">No reviews</td></tr>';
    return;
  }
  tb.innerHTML = reviews
    .map(
      (r) => `<tr>
    <td>${r.review_image ? `<img class="thumb" src="${esc(r.review_image)}" alt="" />` : '—'}</td>
    <td>${esc(r.customer_name)}</td>
    <td>${'★'.repeat(r.rating || 5)}</td>
    <td style="max-width:280px">${esc(r.review)}</td>
    <td><div class="acts">
      <button type="button" onclick="editRev(${JSON.stringify(r.id)})">Edit</button>
      <button type="button" class="danger" onclick="delRev(${JSON.stringify(r.id)})">Delete</button>
    </div></td>
  </tr>`
    )
    .join('');
}
function openRev(r) {
  $('revEditor').style.display = 'block';
  $('rId').value = r?.id || '';
  $('rName').value = r?.customer_name || '';
  $('rRating').value = r?.rating || 5;
  $('rSlug').value = r?.product_slug || 'intelligence-book';
  $('rText').value = r?.review || '';
  $('rImg').value = r?.review_image || '';
  $('rVer').checked = r?.verified !== false;
}
function editRev(id) {
  const r = reviews.find((x) => x.id === id);
  if (r) openRev(r);
}
async function saveRev() {
  if (!$('rName').value.trim() || !$('rText').value.trim()) return toast('Name & review required');
  await saveReview({
    id: $('rId').value ? (isNaN(+$('rId').value) ? $('rId').value : +$('rId').value) : Date.now(),
    customer_name: $('rName').value.trim(),
    rating: +$('rRating').value,
    review: $('rText').value.trim(),
    product_slug: $('rSlug').value.trim(),
    review_image: $('rImg').value,
    verified: $('rVer').checked,
  });
  $('revEditor').style.display = 'none';
  await loadRevs();
  toast('Review saved');
}
async function delRev(id) {
  if (!confirm('Delete review?')) return;
  await deleteReview(id);
  await loadRevs();
  toast('Deleted');
}

async function loadBans() {
  try {
    banners = JSON.parse(localStorage.getItem(KEYS.banners) || '[]');
  } catch {
    banners = [];
  }
  if (!banners.length) banners = await fetchBanners();
  window.banners = banners;
  renderBans();
}
function renderBans() {
  banners = window.banners || banners;
  window.banners = banners;
  $('banList').innerHTML = banners
    .map(
      (b, i) => `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
    <input style="flex:1" value="${esc(b.text)}" onchange="window.banners[${i}].text=this.value" />
    <label style="font-size:12px;white-space:nowrap"><input type="checkbox" ${b.active !== false ? 'checked' : ''} onchange="window.banners[${i}].active=this.checked" /> On</label>
    <button type="button" class="danger" style="padding:6px 10px;border:1px solid #f5c6cb;border-radius:6px;background:#fff;color:var(--red)" onclick="window.banners.splice(${i},1);renderBans()">×</button>
  </div>`
    )
    .join('');
}

async function loadSet() {
  const s = await fetchSettings();
  $('sName').value = s.store_name || '';
  $('sEmail').value = s.support_email || '';
  $('sPhone').value = s.support_phone || '';
  $('sHero').value = s.hero_image || '';
  $('sTitle').value = s.hero_title || '';
  $('sSub').value = s.hero_subtitle || '';
}
async function saveSet() {
  await saveSettings({
    store_name: $('sName').value.trim(),
    support_email: $('sEmail').value.trim(),
    support_phone: $('sPhone').value.trim(),
    hero_image: $('sHero').value.trim() || 'assets/images/product-front.png',
    hero_title: $('sTitle').value.trim(),
    hero_subtitle: $('sSub').value.trim(),
  });
  toast('Settings saved');
}

function toast(msg) {
  const w = $('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  w.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

window.setStatus = setStatus;
window.delOrder = delOrder;
window.editProd = editProd;
window.delProd = delProd;
window.rmImg = rmImg;
window.editRev = editRev;
window.delRev = delRev;
window.banners = banners;
window.renderBans = renderBans;
