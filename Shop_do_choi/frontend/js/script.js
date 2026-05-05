// ToyLand Pro - standalone frontend (no /_sdk required)

let currentUser = null;
let cart = [];
let wishlist = [];
let allProducts = [];
let allOrders = [];
let allUsers = [];
let allReviews = [];
let allCoupons = [];
let allFlashSales = [];
let notifications = [];
let currentPage = "home";
let categories = ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học"];
let compareList = [];
let chatHistory = [];
let bannerUrls = [];
let bannerIndex = 0;
let bannerTimer = null;

let flashSaleEndMs = Date.now() + 60 * 60 * 1000;
let adminEditingProductId = null;
let adminEditingCategory = null;

const defaultConfig = {
  site_name: "ToyLand Pro",
  hero_title: "Thế Giới Đồ Chơi Kỳ Diệu",
  hero_subtitle: "Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em",
};

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

function safeDecodeURIComponent(value) {
  const s = String(value ?? "");
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function getProductDisplayName(p) {
  const rawName = p && typeof p.name !== "undefined" ? p.name : "";
  return safeDecodeURIComponent(rawName);
}

function renderProductThumb(p) {
  const src = String((p && p.image) || "").trim();
  const name = getProductDisplayName(p) || "Sản phẩm";
  const isUrl = src.startsWith("/media/") || /\.(png|jpe?g|webp)$/i.test(src);

  if (isUrl) {
    return `<img src="${src}" alt="${escapeHtml(name)}" class="w-10 h-10 rounded object-cover bg-white" loading="lazy" />`;
  }

  return `<span class="text-xl leading-none">${escapeHtml(src || "🎁")}</span>`;
}

function renderProductImage(p, { size = "md", fit } = {}) {
  const src = String((p && p.image) || "").trim();
  const name = String((p && p.name) || "Sản phẩm");
  const isUrl = src.startsWith("/media/") || /\.(png|jpe?g|webp)$/i.test(src);

  if (isUrl) {
    const resolvedFit = fit || (size === "xl" || size === "lg" ? "contain" : "cover");
    if (resolvedFit === "cover") {
      return `<img src="${src}" alt="${name}" class="w-full h-full object-cover" loading="lazy" />`;
    }
    const h = size === "lg" ? "h-64" : size === "xl" ? "h-80" : "h-40";
    return `<img src="${src}" alt="${name}" class="w-full ${h} object-contain" loading="lazy" />`;
  }

  return `<div class="${size === "xl" ? "text-8xl" : size === "lg" ? "text-7xl" : "text-6xl"}">${src || "🎁"}</div>`;
}

function createProductCard(p) {
  const priceNow = discountedPrice(p);
  return `
    <div class="toy-card bg-white rounded-lg shadow overflow-hidden">
      <div class="h-56 bg-gradient-to-br from-purple-100 to-pink-100 text-center relative flex items-center justify-center overflow-hidden">
        ${renderProductImage(p, { size: "md", fit: "cover" })}
        ${p.isSale ? `<span class="absolute top-2 right-2 badge-sale text-white px-2 py-1 rounded text-xs font-bold">-${p.discount}%</span>` : ""}
        ${p.isFlashSale ? `<span class="absolute top-2 left-2 flash-sale-badge bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">⚡ FLASH</span>` : ""}
      </div>
      <div class="p-4">
        <h3 class="font-bold text-lg mb-2">${p.name}</h3>
        <div class="flex items-center mb-2">
          <span class="star-rating text-sm">★ ${Number(p.rating || 0).toFixed(1)}</span>
          <span class="text-gray-500 text-xs ml-2">(${Number(p.reviews || 0)})</span>
        </div>
        <div class="flex gap-2 items-center mb-4">
          ${p.discount ? `<p class="text-gray-400 line-through text-sm">${money(p.price)}</p>` : ""}
          <p class="text-purple-600 font-bold text-lg">${money(priceNow)}</p>
        </div>
        <div class="flex gap-2 text-xs">
          <button onclick="viewProduct('${p.backendId}')" class="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">Chi Tiết</button>
          <button onclick="addToWishlist('${p.backendId}')" class="py-2 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition">❤️</button>
          <button onclick="addToCart('${p.backendId}')" class="flex-1 py-2 btn-primary text-white rounded">Thêm</button>
        </div>
      </div>
    </div>`;
}

function discountedPrice(p) {
  const price = Number(p.price || 0);
  const discount = Number(p.discount || 0);
  if (!discount) return price;
  return Math.floor(price * (1 - discount / 100));
}

async function apiJson(path, { method = "GET", body } = {}) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    const csrfToken =
      document.cookie
        .split(";")
        .find((c) => c.trim().startsWith("csrftoken="))
        ?.split("=")[1] || "";
    options.headers["X-CSRFToken"] = csrfToken;
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error((payload && payload.error) || res.statusText);
  if (payload && payload.ok === false) throw new Error(payload.error || "Request failed");
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

async function refreshBanners() {
  try {
    const data = (await apiJson("/api/banners")) || [];
    // Exclude any banner files that appear to be flash-sale images (filename contains 'flash')
    const filtered = (Array.isArray(data) ? data : []).filter((u) => !/flash/i.test(String(u || "")));
    bannerUrls = filtered.slice(0, 3);
  } catch {
    bannerUrls = [];
  }
  renderBannerSlider();
  updateBannerAutoplay();
}

function renderBannerSlider() {
  const wrap = document.getElementById("banner-slider");
  const slides = document.getElementById("banner-slides");
  const dots = document.getElementById("banner-dots");
  if (!wrap || !slides || !dots) return;

  if (!bannerUrls || bannerUrls.length === 0) {
    wrap.classList.add("hidden");
    slides.innerHTML = "";
    dots.innerHTML = "";
    return;
  }

  wrap.classList.remove("hidden");
  bannerIndex = Math.max(0, Math.min(bannerIndex, bannerUrls.length - 1));

  slides.innerHTML = bannerUrls
    .map(
      (url) => `
      <div class="min-w-full h-full flex-shrink-0 relative">
        <div class="absolute inset-0 bg-center bg-cover blur-md scale-110" style="background-image:url('${url}')"></div>
        <div class="absolute inset-0 bg-black/8"></div>
        <div class="relative z-10 w-full h-full flex items-center justify-center">
          <img src="${url}" alt="Banner" class="max-w-3xl w-full h-full object-cover rounded-2xl" loading="lazy" />
        </div>
      </div>`
    )
    .join("");

  dots.innerHTML = bannerUrls
    .map((_, i) => {
      const active = i === bannerIndex;
      return `<button onclick="bannerGo(${i})" class="w-2.5 h-2.5 rounded-full ${active ? "bg-purple-600" : "bg-white/80"} shadow"></button>`;
    })
    .join("");

  slides.style.transform = `translateX(-${bannerIndex * 100}%)`;

  if (!wrap.dataset.bannerHoverBound) {
    wrap.addEventListener("mouseenter", () => stopBannerAutoplay());
    wrap.addEventListener("mouseleave", () => updateBannerAutoplay());
    wrap.dataset.bannerHoverBound = "1";
  }

  // inject arrows if not present
  if (!wrap.querySelector('.banner-arrow.left')) {
    const left = document.createElement('button');
    left.className = 'banner-arrow left';
    left.innerHTML = '&#x2039;';
    left.onclick = () => bannerPrev();
    wrap.appendChild(left);
  }
  if (!wrap.querySelector('.banner-arrow.right')) {
    const right = document.createElement('button');
    right.className = 'banner-arrow right';
    right.innerHTML = '&#x203A;';
    right.onclick = () => bannerNext();
    wrap.appendChild(right);
  }
}

function bannerGo(i) {
  if (!bannerUrls || bannerUrls.length === 0) return;
  bannerIndex = (i + bannerUrls.length) % bannerUrls.length;
  renderBannerSlider();
  updateBannerAutoplay();
}

function bannerNext() {
  bannerGo(bannerIndex + 1);
}

function bannerPrev() {
  bannerGo(bannerIndex - 1);
}

function stopBannerAutoplay() {
  if (bannerTimer) {
    clearInterval(bannerTimer);
    bannerTimer = null;
  }
}

function updateBannerAutoplay() {
  stopBannerAutoplay();
  const wrap = document.getElementById("banner-slider");
  if (!wrap || wrap.classList.contains("hidden")) return;
  if (currentPage !== "home") return;
  if (!bannerUrls || bannerUrls.length <= 1) return;
  bannerTimer = setInterval(() => {
    bannerIndex = (bannerIndex + 1) % bannerUrls.length;
    renderBannerSlider();
  }, 4000);
}

async function refreshProducts() {
  allProducts = (await apiJson("/api/products")) || [];
  // Normalize ids and image fields for backward compatibility
  allProducts = (allProducts || []).map((p) => {
    const prod = { ...(p || {}) };
    prod.backendId = String(prod.backendId || prod.__backendId || prod.id || prod.product || prod.product_id || "");
    prod.__backendId = prod.__backendId || prod.backendId;
    prod.image = prod.image || "";
    return prod;
  });
}

async function refreshCoupons() {
  allCoupons = (await apiJson("/api/coupons")) || [];
}

async function refreshOrders(user) {
  const qs = user ? `?user=${encodeURIComponent(user)}` : "";
  allOrders = (await apiJson(`/api/orders${qs}`)) || [];
}

async function loadInitialData() {
  await refreshProducts();
  if (!allProducts || allProducts.length === 0) {
    await apiJson("/api/seed", { method: "POST" });
    await refreshProducts();
  }
  await refreshCoupons();
}

function addNotification(message) {
  notifications.unshift(message);
  if (notifications.length > 5) notifications.pop();
  updateNotifications();
}

function updateNotifications() {
  const countEl = document.getElementById("notification-count");
  const count = notifications.length;
  if (count > 0) {
    countEl.textContent = String(count);
    countEl.classList.remove("hidden");
  } else {
    countEl.classList.add("hidden");
  }
}

function openNotifications() {
  const panel = document.getElementById("notifications-panel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    const list = document.getElementById("notifications-list");
    list.innerHTML = notifications.length
      ? notifications
          .map((n) => `<div class="bg-gray-50 p-3 rounded border-l-4 border-purple-600 text-sm">${n}</div>`)
          .join("")
      : '<p class="text-gray-500 text-sm">Không có thông báo nào</p>';
  }
}

function updateAuthUI() {
  const authButtons = document.getElementById("auth-buttons");
  const userMenu = document.getElementById("user-menu");
  const ordersNav = document.getElementById("orders-nav");
  const adminBtn = document.getElementById("admin-btn");

  if (currentUser) {
    authButtons.classList.add("hidden");
    userMenu.classList.remove("hidden");
    document.getElementById("user-name").textContent = currentUser.name;
    ordersNav.classList.remove("hidden");
    if (currentUser.email === "admin@toystore.com") adminBtn.classList.remove("hidden");
    else adminBtn.classList.add("hidden");
  } else {
    authButtons.classList.remove("hidden");
    userMenu.classList.add("hidden");
    ordersNav.classList.add("hidden");
    adminBtn.classList.add("hidden");
  }
}

function showPage(page) {
  if (page === "orders" && !currentUser) page = "login";
  if (page === "admin" && (!currentUser || currentUser.email !== "admin@toystore.com")) page = "home";

  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  const target = document.getElementById(page + "-page");
  if (target) target.classList.remove("hidden");
  currentPage = page;

  if (page === "products") filterProducts();
  if (page === "flashsale") displayFlashSale();
  if (page === "wishlist") displayWishlist();
  if (page === "orders") displayOrders();
  if (page === "profile") loadProfile();
  if (page === "admin") showAdminTab("dashboard");

  updateUI();
  updateBannerAutoplay();
}

function displayProducts(products) {
  const grid = document.getElementById("products-grid");
  const featured = document.getElementById("featured-products");
  const bestsellers = document.getElementById("bestsellers-grid");

  if (grid) grid.innerHTML = products.map(createProductCard).join("");
  if (featured) featured.innerHTML = products.filter((p) => Number(p.rating || 0) >= 4.8).slice(0, 4).map(createProductCard).join("");
  if (bestsellers) bestsellers.innerHTML = products.filter((p) => String(p.tags || "").includes("bán chạy")).slice(0, 4).map(createProductCard).join("");
}

function filterProducts() {
  const search = (document.getElementById("search-input").value || "").toLowerCase();
  const category = document.getElementById("category-filter").value || "";
  const minPrice = parseInt(document.getElementById("price-min").value || "0", 10) || 0;
  const maxPrice = parseInt(document.getElementById("price-max").value || "10000000", 10) || 10000000;
  const sort = document.getElementById("sort-filter").value || "new";

  let filtered = allProducts.filter((p) => {
    const price = discountedPrice(p);
    return p.name.toLowerCase().includes(search) && (!category || p.category === category) && price >= minPrice && price <= maxPrice;
  });

  if (sort === "price-low") filtered.sort((a, b) => discountedPrice(a) - discountedPrice(b));
  else if (sort === "price-high") filtered.sort((a, b) => discountedPrice(b) - discountedPrice(a));
  else if (sort === "rating") filtered.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));

  displayProducts(filtered);
}

function displayFlashSale() {
  const grid = document.getElementById("flashsale-grid");
  const flashProducts = allProducts.filter((p) => p.isFlashSale);
  grid.innerHTML = flashProducts.length
    ? flashProducts.map(createProductCard).join("")
    : '<p class="col-span-full text-center text-gray-500">Không có flash sale nào</p>';
}

function addToWishlist(id) {
  if (!currentUser) return showPage("login");
  const product = allProducts.find((p) => p.backendId === id);
  if (!product) return;
  if (!wishlist.some((w) => w.backendId === id)) {
    wishlist.push(product);
    addNotification(`${product.name} đã được thêm vào danh sách yêu thích!`);
  } else {
    addNotification("Sản phẩm này đã có trong danh sách yêu thích.");
  }
  updateUI();
}

function removeFromWishlist(id) {
  wishlist = wishlist.filter((w) => w.backendId !== id);
  displayWishlist();
  updateUI();
}

function displayWishlist() {
  const container = document.getElementById("wishlist-items");
  if (!currentUser) {
    container.innerHTML = '<p class="col-span-full text-center text-gray-500">Vui lòng đăng nhập để xem danh sách yêu thích</p>';
    return;
  }
  if (wishlist.length === 0) {
    container.innerHTML = '<p class="col-span-full text-center text-gray-500">Danh sách yêu thích trống</p>';
    return;
  }
  container.innerHTML = wishlist
    .map(
      (p) => `
    <div class="toy-card bg-white rounded-lg shadow overflow-hidden">
      <div class="text-6xl p-6 bg-gradient-to-br from-purple-100 to-pink-100 text-center">${p.image || "🎁"}</div>
      <div class="p-4">
        <h3 class="font-bold text-lg mb-2">${p.name}</h3>
        <p class="text-purple-600 font-bold text-lg mb-4">${money(discountedPrice(p))}</p>
        <div class="flex gap-2">
            <button onclick="addToCart('${p.backendId}')" class="flex-1 py-2 btn-primary text-white rounded text-sm">Thêm Vào Giỏ</button>
          <button onclick="removeFromWishlist('${p.backendId}')" class="py-2 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition">Xóa</button>
        </div>
      </div>
    </div>`
    )
    .join("");
}

function viewProduct(id) {
  const product = allProducts.find((p) => p.backendId === id);
  if (!product) return;

  const detail = document.getElementById("product-detail-content");
  const priceNow = discountedPrice(product);
  detail.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="text-8xl p-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg text-center flex items-center justify-center relative">
        ${product.image || "🎁"}
        ${product.isSale ? `<span class="absolute top-4 right-4 badge-sale text-white px-3 py-2 rounded font-bold">-${product.discount}%</span>` : ""}
      </div>
      <div>
        <h1 class="text-3xl font-bold mb-4">${product.name}</h1>
        <div class="mb-4">
          <span class="star-rating text-2xl">★ ${Number(product.rating || 0).toFixed(1)}</span>
          <span class="text-gray-500 ml-2">(${Number(product.reviews || 0)} đánh giá)</span>
        </div>
        <div class="mb-6">
          ${product.discount ? `<p class="text-gray-400 line-through text-lg">${money(product.price)}</p>` : ""}
          <p class="text-4xl font-bold text-purple-600">${money(priceNow)}</p>
        </div>
        <p class="text-gray-600 mb-6">${product.description || ""}</p>
        <p class="text-gray-700 mb-6">Còn hàng: <span class="font-bold text-green-600">${Number(product.stock || 0)}</span></p>
        <div class="mb-6">
          <label class="block text-sm font-medium mb-2">Số Lượng</label>
          <input type="number" id="detail-quantity" value="1" min="1" max="${Number(product.stock || 0)}" class="px-4 py-2 border rounded-lg w-20 focus:outline-none focus:ring-2 focus:ring-purple-500">
        </div>
        <div class="flex gap-2 mb-4">
          <button onclick="addToCartFromDetail('${id}')" class="flex-1 py-3 btn-primary text-white rounded-lg font-bold">🛒 Thêm Vào Giỏ</button>
          <button onclick="addToWishlist('${id}')" class="py-3 px-6 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition">❤️ Yêu Thích</button>
        </div>
        <button onclick="showPage('products')" class="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-bold">Tiếp Tục Mua</button>
      </div>
    </div>`;
  showPage("product-detail");
}

function addToCart(id) {
  if (!currentUser) return showPage("login");
  const product = allProducts.find((p) => p.backendId === id);
  if (!product) return;
  const existing = cart.find((i) => i.backendId === id);
  if (existing) existing.quantity++;
  else cart.push({ ...product, quantity: 1 });
  updateUI();
}

function addToCartFromDetail(id) {
  const qty = parseInt(document.getElementById("detail-quantity").value || "1", 10) || 1;
  const product = allProducts.find((p) => p.backendId === id);
  if (!product) return;
  const existing = cart.find((i) => i.backendId === id);
  if (existing) existing.quantity += qty;
  else cart.push({ ...product, quantity: qty });
  addNotification(`${product.name} x${qty} đã được thêm vào giỏ hàng`);
  updateUI();
  showPage("cart");
}

function updateCartItem(id, quantity) {
  const item = cart.find((i) => i.backendId === id);
  if (!item) return;
  item.quantity = parseInt(quantity, 10);
  if (item.quantity <= 0) cart = cart.filter((i) => i.backendId !== id);
  updateUI();
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.backendId !== id);
  updateUI();
}

function displayCart() {
  const cartItems = document.getElementById("cart-items");
  if (!currentUser) {
    cartItems.innerHTML = '<p class="text-center text-gray-500 py-8">Vui lòng đăng nhập để xem giỏ hàng</p>';
    return;
  }
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="text-center text-gray-500 py-8">Giỏ hàng trống</p>';
    document.getElementById("subtotal").textContent = "0 đ";
    document.getElementById("discount-amount").textContent = "-0 đ";
    document.getElementById("total").textContent = "30,000 đ";
    return;
  }

  cartItems.innerHTML = `
    <table class="w-full">
      <tr class="border-b">
        <th class="text-left py-2">Sản Phẩm</th>
        <th class="text-center py-2">Giá</th>
        <th class="text-center py-2">Số Lượng</th>
        <th class="text-center py-2">Thành Tiền</th>
        <th class="text-center py-2">Xóa</th>
      </tr>
      ${cart
        .map((item) => {
          const pNow = discountedPrice(item);
          return `
        <tr class="border-b py-4">
          <td class="py-4">
            ${(() => {
              const src = String(item.image || "").trim();
              const isUrl = src.startsWith("/media/") || src.startsWith("http") || /\.(png|jpe?g|webp)$/i.test(src);
              return isUrl
                ? `<img src="${src}" alt="${escapeHtml(item.name)}" class="inline-block w-12 h-12 object-contain align-middle mr-3 bg-white rounded" loading="lazy" />`
                : `<span class="text-3xl mr-3 align-middle">${src || "🎁"}</span>`;
            })()}
            <span class="align-middle">${item.name}</span>
          </td>
          <td class="text-center">${money(pNow)}</td>
          <td class="text-center">
            <input type="number" value="${item.quantity}" min="1" onchange="updateCartItem('${item.backendId}', this.value)" class="w-16 px-2 py-1 border rounded text-center">
          </td>
          <td class="text-center font-bold">${money(pNow * item.quantity)}</td>
          <td class="text-center"><button onclick="removeFromCart('${item.backendId}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button></td>
        </tr>`;
        })
        .join("")}
    </table>`;

  updateCartTotal();
}

function updateCartTotal() {
  const subtotal = cart.reduce((sum, item) => sum + discountedPrice(item) * item.quantity, 0);
  const discount = parseFloat(sessionStorage.getItem("appliedDiscount") || "0") || 0;
  const discountAmount = Math.floor((subtotal * discount) / 100);
  const total = subtotal - discountAmount + 30000;

  document.getElementById("subtotal").textContent = subtotal.toLocaleString("vi-VN") + " đ";
  document.getElementById("discount-amount").textContent = "-" + discountAmount.toLocaleString("vi-VN") + " đ";
  document.getElementById("total").textContent = total.toLocaleString("vi-VN") + " đ";
}

function cancelOrder(id) {
  (async () => {
    try {
      await apiJson(`/api/orders/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "Hủy" } });
      addNotification(`✅ Yêu cầu hủy đơn ${id} đã được gửi.`);
      if (currentUser) await refreshOrders(currentUser.name);
      updateUI();
      showPage("orders");
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể hủy đơn"}`);
    }
  })();
}

function applyCoupon() {
  (async () => {
    const code = (document.getElementById("coupon-code").value || "").trim();
    if (!code) return;
    try {
      const result = await apiJson("/api/coupons/apply", { method: "POST", body: { code } });
      sessionStorage.setItem("appliedDiscount", result.discount);
      await refreshCoupons();
      updateCartTotal();
      addNotification(`✅ Áp dụng mã giảm giá ${result.discount}% thành công!`);
      document.getElementById("coupon-code").value = "";
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể áp dụng mã giảm giá"}`);
    }
  })();
}

function checkout() {
  (async () => {
    if (!currentUser) return showPage("login");
    if (cart.length === 0) return addNotification("Giỏ hàng trống!");

    const paymentMethod = document.getElementById("payment-method").value;
    const discount = parseFloat(sessionStorage.getItem("appliedDiscount") || "0") || 0;

    try {
      // sanitize payload and validate client-side
      const rawItems = JSON.parse(JSON.stringify(cart || []));
      const items = rawItems.map((it) => ({ backendId: it.backendId || it.__backendId || it.id, quantity: Number(it.quantity || 1) }));
      for (const it of items) {
        if (!it.backendId) return addNotification("❌ Có sản phẩm thiếu mã. Vui lòng kiểm tra giỏ hàng.");
        if (!Number.isFinite(it.quantity) || it.quantity <= 0) return addNotification("❌ Số lượng không hợp lệ trong giỏ hàng.");
      }
      if (!["cod", "bank", "wallet"].includes(paymentMethod)) return addNotification("❌ Phương thức thanh toán không hợp lệ.");

      const payload = { user: currentUser.name, items, paymentMethod, discount };
      console.debug("checkout payload:", payload);
      const order = await apiJson("/api/orders", { method: "POST", body: payload });
      cart = [];
      sessionStorage.removeItem("appliedDiscount");
      await refreshProducts();
      await refreshOrders(currentUser.name);
      addNotification(`✅ Đặt hàng thành công! Mã: ${order.id}`);
      updateUI();
      showPage("orders");
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể đặt hàng"}`);
    }
  })();
}

function displayOrders() {
  (async () => {
    const list = document.getElementById("orders-list");
    if (!currentUser) return (list.innerHTML = '<p class="text-center text-gray-500 py-8">Vui lòng đăng nhập để xem đơn hàng</p>');
    try {
      await refreshOrders(currentUser.name);
    } catch {
      // ignore
    }
    const userOrders = allOrders.filter((o) => o.user === currentUser.name);
    if (userOrders.length === 0) return (list.innerHTML = '<p class="text-center text-gray-500 py-8">Không có đơn hàng nào</p>');

    list.innerHTML = userOrders
      .map(
        (order) => `
    <div class="bg-white rounded-lg shadow p-6">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <div><p class="text-gray-600 text-sm">Mã Đơn Hàng</p><p class="font-bold">${order.id}</p></div>
        <div><p class="text-gray-600 text-sm">Ngày Đặt</p><p class="font-bold">${order.date}</p></div>
        <div><p class="text-gray-600 text-sm">Trạng Thái</p><p class="font-bold ${order.status === "Đã giao" ? "text-green-600" : "text-blue-600"}">${order.status}</p></div>
        <div><p class="text-gray-600 text-sm">Thanh Toán</p><p class="font-bold">${order.paymentMethod === "cod" ? "COD" : order.paymentMethod === "bank" ? "Chuyển khoản" : "Ví"}</p></div>
        <div><p class="text-gray-600 text-sm">Tổng Tiền</p><p class="font-bold text-purple-600">${money(order.total)}</p></div>
      </div>
      ${order.status === "Chờ xác nhận" ? `<div class="flex gap-2"><button onclick="cancelOrder('${order.id}')" class="py-2 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition">Hủy đơn</button></div>` : ""}
    </div>`
      )
      .join("");

    document.getElementById("user-order-count").textContent = String(userOrders.length);
    document.getElementById("user-total-spent").textContent =
      userOrders.reduce((sum, o) => sum + Number(o.total || 0), 0).toLocaleString("vi-VN") + "đ";
  })();
}

function loadProfile() {
  if (!currentUser) return;
  document.getElementById("profile-name").value = currentUser.name || "";
  document.getElementById("profile-email").value = currentUser.email || "";
  document.getElementById("profile-phone").value = currentUser.phone || "";
  document.getElementById("profile-address").value = currentUser.address || "";
}

function updateProfile(event) {
  event.preventDefault();
  if (!currentUser) return;
  currentUser.name = document.getElementById("profile-name").value.trim();
  currentUser.phone = document.getElementById("profile-phone").value.trim();
  currentUser.address = document.getElementById("profile-address").value.trim();
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  updateAuthUI();
  addNotification("✅ Cập nhật thông tin cá nhân thành công!");
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  try {
    const result = await apiJson("/api/auth/login/", {
      method: "POST",
      body: { email, password },
    });
    currentUser = result.user;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateAuthUI();
    showPage(currentUser.role === "admin" ? "admin" : "home");
  } catch (err) {
    addNotification(`❌ ${err.message || "Sai email hoặc mật khẩu"}`);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById("register-email").value.trim();
  const name = document.getElementById("register-name").value.trim();
  const password = document.getElementById("register-password").value.trim();
  try {
    const result = await apiJson("/api/auth/register/", {
      method: "POST",
      body: { email, name, password },
    });
    currentUser = result.user;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateAuthUI();
    addNotification(`Chào mừng ${name}! Đăng ký thành công.`);
    showPage("home");
  } catch (err) {
    addNotification(`❌ ${err.message || "Đăng ký thất bại"}`);
  }
}

function logout() {
  currentUser = null;
  cart = [];
  wishlist = [];
  localStorage.removeItem("currentUser");
  updateAuthUI();
  addNotification("Đã đăng xuất thành công.");
  showPage("home");
}

function showAdminTab(tab) {
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.add("hidden"));
  document.getElementById("admin-" + tab + "-tab").classList.remove("hidden");
  if (tab === "dashboard") updateAdminDashboard();
  else if (tab === "products") updateAdminProducts();
  else if (tab === "categories") updateAdminCategories();
  else if (tab === "orders") updateAdminOrders();
  else if (tab === "users") updateAdminUsers();
  else if (tab === "reviews") updateAdminReviews();
  else if (tab === "promotions") updateAdminPromotions();
}

function updateAdminDashboard() {
  (async () => {
    try {
      await refreshOrders();
      await refreshProducts();
    } catch {
      // ignore
    }

    document.getElementById("admin-total-products").textContent = String(allProducts.length);
    document.getElementById("admin-total-orders").textContent = String(allOrders.length);
    document.getElementById("admin-total-users").textContent = String(allUsers.length);
    document.getElementById("admin-total-revenue").textContent =
      allOrders.reduce((sum, o) => sum + Number(o.total || 0), 0).toLocaleString("vi-VN") + "đ";

    const top = [...allProducts].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0)).slice(0, 5);
    document.getElementById("top-products").innerHTML = top
      .map(
        (p) =>
          `<div class="flex justify-between items-center pb-2 border-b"><div><p class="font-bold">${p.name}</p><p class="text-sm text-gray-500">Rating: ${Number(p.rating || 0).toFixed(1)} ⭐</p></div><p class="font-bold">${money(discountedPrice(p))}</p></div>`
      )
      .join("");

    const out = allProducts.filter((p) => Number(p.stock || 0) === 0).length;
    const low = allProducts.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 10).length;
    const instock = allProducts.filter((p) => Number(p.stock || 0) > 10).length;
    document.getElementById("out-of-stock-count").textContent = String(out);
    document.getElementById("low-stock-count").textContent = String(low);
    document.getElementById("in-stock-count").textContent = String(instock);
  })();
}

function adminAddProduct() {
  (async () => {
    const name = document.getElementById("admin-product-name").value.trim();
    const price = parseFloat(document.getElementById("admin-product-price").value);
    const stock = parseInt(document.getElementById("admin-product-stock").value, 10);
    const category = document.getElementById("admin-product-category").value;
    if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) return addNotification("❌ Vui lòng nhập đầy đủ thông tin");

    try {
      await apiJson("/api/products", {
        method: "POST",
        body: {
          name,
          price,
          stock,
          category,
          image: "🎁",
          rating: 0,
          reviews: 0,
          description: "Sản phẩm mới",
          isSale: false,
          discount: 0,
          isFlashSale: false,
          tags: "",
        },
      });
      await refreshProducts();
      document.getElementById("admin-product-name").value = "";
      document.getElementById("admin-product-price").value = "";
      document.getElementById("admin-product-stock").value = "";
      addNotification("✅ Thêm sản phẩm thành công!");
      updateAdminProducts();
      updateUI();
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể thêm sản phẩm"}`);
    }
  })();
}

function adminSubmitProduct() {
  if (adminEditingProductId) return adminUpdateProduct(adminEditingProductId);
  return adminAddProduct();
}

function adminEditProduct(id) {
  const p = allProducts.find((x) => x.backendId === id);
  if (!p) return;
  adminEditingProductId = id;
  document.getElementById("admin-product-name").value = String(p.name || "");
  document.getElementById("admin-product-price").value = String(Number(p.price || 0) || "");
  document.getElementById("admin-product-stock").value = String(Number(p.stock || 0) || "");
  if (p.category) document.getElementById("admin-product-category").value = String(p.category);

  const submitBtn = document.getElementById("admin-product-submit");
  if (submitBtn) submitBtn.textContent = "Lưu";
  const cancelBtn = document.getElementById("admin-product-cancel");
  if (cancelBtn) cancelBtn.classList.remove("hidden");
}

function adminCancelEditProduct() {
  adminEditingProductId = null;
  document.getElementById("admin-product-name").value = "";
  document.getElementById("admin-product-price").value = "";
  document.getElementById("admin-product-stock").value = "";

  const submitBtn = document.getElementById("admin-product-submit");
  if (submitBtn) submitBtn.textContent = "Thêm";
  const cancelBtn = document.getElementById("admin-product-cancel");
  if (cancelBtn) cancelBtn.classList.add("hidden");
}

function adminUpdateProduct(id) {
  (async () => {
    const base = allProducts.find((x) => x.backendId === id);
    if (!base) return addNotification("❌ Không tìm thấy sản phẩm để sửa");

    const name = document.getElementById("admin-product-name").value.trim();
    const price = parseFloat(document.getElementById("admin-product-price").value);
    const stock = parseInt(document.getElementById("admin-product-stock").value, 10);
    const category = document.getElementById("admin-product-category").value;
    if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) return addNotification("❌ Vui lòng nhập đầy đủ thông tin");

    const updated = { ...base, name, price, stock, category };
    try {
      await apiJson(`/api/products/${encodeURIComponent(id)}`, { method: "PUT", body: updated });
      await refreshProducts();
      addNotification("✅ Cập nhật sản phẩm thành công!");
      adminCancelEditProduct();
      syncCategoryOptionsFromProducts();
      updateAdminProducts();
      updateUI();
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể cập nhật sản phẩm"}`);
    }
  })();
}

function adminDeleteProduct(id) {
  (async () => {
    try {
      await apiJson(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshProducts();
      wishlist = wishlist.filter((w) => w.backendId !== id);
      cart = cart.filter((c) => c.backendId !== id);
      addNotification("✅ Xóa sản phẩm thành công!");
      updateAdminProducts();
      updateUI();
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể xóa sản phẩm"}`);
    }
  })();
}

function updateAdminProducts() {
  const list = document.getElementById("admin-products-list");
  list.innerHTML = `
    <table class="w-full">
      <tr class="bg-gray-100 border-b">
        <th class="px-4 py-2 text-left">Tên</th><th class="px-4 py-2 text-left">Giá</th><th class="px-4 py-2 text-left">Danh Mục</th><th class="px-4 py-2 text-left">Tồn Kho</th><th class="px-4 py-2 text-left">Đánh Giá</th><th class="px-4 py-2 text-center">Hành Động</th>
      </tr>
      ${allProducts
        .map(
          (p) =>
            `<tr class="border-b hover:bg-gray-50">
              <td class="px-4 py-2">${p.name}</td>
              <td class="px-4 py-2">${money(discountedPrice(p))}</td>
              <td class="px-4 py-2">${p.category}</td>
              <td class="px-4 py-2">${Number(p.stock || 0)}</td>
              <td class="px-4 py-2">⭐ ${Number(p.rating || 0).toFixed(1)}</td>
              <td class="px-4 py-2 text-center">
                <div class="flex gap-3 justify-center">
                  <button onclick="adminEditProduct('${p.backendId}')" class="text-blue-600 hover:text-blue-800 font-bold">Sửa</button>
                  <button onclick="adminDeleteProduct('${p.backendId}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button>
                </div>
              </td>
            </tr>`
        )
        .join("")}
    </table>`;
}

function adminSubmitCategory() {
  if (adminEditingCategory) return adminRenameCategory(adminEditingCategory);
  return adminAddCategory();
}

function adminAddCategory() {
  (async () => {
    const name = document.getElementById("admin-category-name").value.trim();
    if (!name) return;

    const current = Array.isArray(siteConfig.categories) ? siteConfig.categories.map((c) => String(c || "").trim()).filter(Boolean) : [];
    if (!current.includes(name)) current.push(name);

    try {
      await saveConfig({ categories: current });
      document.getElementById("admin-category-name").value = "";
      syncCategoryOptionsFromProducts();
      addNotification("✅ Thêm danh mục thành công!");
      updateAdminCategories();
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể thêm danh mục"}`);
    }
  })();
}

function adminEditCategory(cat) {
  adminEditingCategory = String(cat || "");
  document.getElementById("admin-category-name").value = adminEditingCategory;
  const submitBtn = document.getElementById("admin-category-submit");
  if (submitBtn) submitBtn.textContent = "Lưu";
  const cancelBtn = document.getElementById("admin-category-cancel");
  if (cancelBtn) cancelBtn.classList.remove("hidden");
}

function adminCancelEditCategory() {
  adminEditingCategory = null;
  document.getElementById("admin-category-name").value = "";
  const submitBtn = document.getElementById("admin-category-submit");
  if (submitBtn) submitBtn.textContent = "Thêm";
  const cancelBtn = document.getElementById("admin-category-cancel");
  if (cancelBtn) cancelBtn.classList.add("hidden");
}

function adminRenameCategory(oldCat) {
  (async () => {
    const oldName = String(oldCat || "").trim();
    const newName = document.getElementById("admin-category-name").value.trim();
    if (!oldName || !newName) return;
    if (oldName === newName) return adminCancelEditCategory();

    const cfgCats = Array.isArray(siteConfig.categories) ? siteConfig.categories.map((c) => String(c || "").trim()).filter(Boolean) : [];
    const exists = new Set([...cfgCats, ...categories].map((c) => String(c || "").trim()).filter(Boolean));
    if (exists.has(newName)) return addNotification("❌ Danh mục mới đã tồn tại");

    try {
      const affected = allProducts.filter((p) => String(p.category || "") === oldName);
      for (const p of affected) {
        await apiJson(`/api/products/${encodeURIComponent(p.__backendId)}`, { method: "PUT", body: { ...p, category: newName } });
      }

      const nextCats = cfgCats.map((c) => (c === oldName ? newName : c));
      if (!nextCats.includes(newName)) nextCats.push(newName);
      await saveConfig({ categories: nextCats });

      await refreshProducts();
      syncCategoryOptionsFromProducts();
      updateAdminCategories();
      updateAdminProducts();
      adminCancelEditCategory();
      addNotification(`✅ Đã đổi danh mục “${oldName}” → “${newName}” (${affected.length} sản phẩm)`);
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể sửa danh mục"}`);
    }
  })();
}

function updateAdminCategories() {
  const list = document.getElementById("admin-categories-list");
  list.innerHTML = `
    <table class="w-full">
      <tr class="bg-gray-100 border-b"><th class="px-4 py-2 text-left">Danh Mục</th><th class="px-4 py-2 text-center">Sản Phẩm</th><th class="px-4 py-2 text-center">Hành Động</th></tr>
      ${categories
        .map((cat) => {
          const cnt = allProducts.filter((p) => p.category === cat).length;
          return `<tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-2">${cat}</td>
            <td class="px-4 py-2 text-center">${cnt}</td>
            <td class="px-4 py-2 text-center">
              <div class="flex gap-3 justify-center">
                <button onclick="adminEditCategory('${cat}')" class="text-blue-600 hover:text-blue-800 font-bold">Sửa</button>
                <button onclick="deleteCategory('${cat}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button>
              </div>
            </td>
          </tr>`;
        })
        .join("")}
    </table>`;
}

function deleteCategory(cat) {
  (async () => {
    const name = String(cat || "").trim();
    if (!name) return;
    const cnt = allProducts.filter((p) => String(p.category || "") === name).length;
    const ok = cnt > 0 ? confirm(`Danh mục “${name}” đang có ${cnt} sản phẩm. Xóa sẽ chuyển các sản phẩm về “Khác”. Bạn có chắc?`) : confirm(`Bạn có chắc muốn xóa danh mục “${name}”?`);
    if (!ok) return;

    try {
      const affected = allProducts.filter((p) => String(p.category || "") === name);
      for (const p of affected) {
        await apiJson(`/api/products/${encodeURIComponent(p.__backendId)}`, { method: "PUT", body: { ...p, category: "Khác" } });
      }

      const cfgCats = Array.isArray(siteConfig.categories) ? siteConfig.categories.map((c) => String(c || "").trim()).filter(Boolean) : [];
      const nextCats = cfgCats.filter((c) => c !== name);
      await saveConfig({ categories: nextCats });

      await refreshProducts();
      syncCategoryOptionsFromProducts();
      updateAdminCategories();
      updateAdminProducts();
      addNotification(`✅ Đã xóa danh mục “${name}”`);
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể xóa danh mục"}`);
    }
  })();
}

function updateAdminOrders() {
  (async () => {
    try {
      await refreshOrders();
    } catch {
      // ignore
    }
    const list = document.getElementById("admin-orders-list");
    list.innerHTML = `
    <table class="w-full text-sm">
      <tr class="bg-gray-100 border-b sticky top-0"><th class="px-4 py-2 text-left">Mã Đơn</th><th class="px-4 py-2 text-left">Khách</th><th class="px-4 py-2 text-left">Ngày</th><th class="px-4 py-2 text-left">Tổng</th><th class="px-4 py-2 text-left">Trạng Thái</th><th class="px-4 py-2 text-center">Hành Động</th></tr>
      ${allOrders
        .map(
          (order, idx) =>
            `<tr class="border-b hover:bg-gray-50"><td class="px-4 py-2">${order.id}</td><td class="px-4 py-2">${order.user}</td><td class="px-4 py-2">${order.date}</td><td class="px-4 py-2">${money(order.total)}</td><td class="px-4 py-2"><select onchange="updateOrderStatus(${idx}, this.value)" class="px-2 py-1 border rounded text-xs"><option value="Đang xử lý" ${order.status === "Đang xử lý" ? "selected" : ""}>Đang xử lý</option><option value="Đã giao" ${order.status === "Đã giao" ? "selected" : ""}>Đã giao</option><option value="Hủy" ${order.status === "Hủy" ? "selected" : ""}>Hủy</option></select></td><td class="px-4 py-2 text-center"><button onclick="viewOrderDetails(${idx})" class="text-blue-600 hover:text-blue-800 font-bold text-xs">Xem</button></td></tr>`
        )
        .join("")}
    </table>`;
  })();
}

function updateOrderStatus(idx, status) {
  allOrders[idx].status = status;
  addNotification(`✅ Cập nhật trạng thái đơn hàng thành: ${status}`);
  updateAdminOrders();
}

function viewOrderDetails(idx) {
  const order = allOrders[idx];
  alert(
    `📋 CHI TIẾT ĐƠN HÀNG\n\nMã: ${order.id}\nKhách: ${order.user}\nNgày: ${order.date}\nTrạng thái: ${order.status}\nTổng: ${money(order.total)}\n\nSản phẩm:\n${order.items.map((i) => `• ${i.name} x${i.quantity}`).join("\n")}`
  );
}

function updateAdminUsers() {
  const list = document.getElementById("admin-users-list");
  list.innerHTML = `
    <table class="w-full text-sm">
      <tr class="bg-gray-100 border-b"><th class="px-4 py-2 text-left">Tên</th><th class="px-4 py-2 text-left">Email</th><th class="px-4 py-2 text-left">Điện Thoại</th><th class="px-4 py-2 text-left">Địa Chỉ</th></tr>
      ${allUsers.map((u) => `<tr class="border-b hover:bg-gray-50"><td class="px-4 py-2">${u.name}</td><td class="px-4 py-2">${u.email}</td><td class="px-4 py-2">${u.phone || "-"}</td><td class="px-4 py-2">${u.address || "-"}</td></tr>`).join("")}
    </table>`;
}

function updateAdminReviews() {
  document.getElementById("admin-reviews-list").innerHTML = '<p class="p-6 text-gray-500">Chưa triển khai module đánh giá.</p>';
}

function adminAddCoupon() {
  (async () => {
    const code = document.getElementById("admin-coupon-code").value.trim();
    const discount = parseInt(document.getElementById("admin-coupon-discount").value, 10);
    const maxUse = parseInt(document.getElementById("admin-coupon-max-use").value, 10);
    if (!code || !Number.isFinite(discount) || !Number.isFinite(maxUse)) return;
    try {
      await apiJson("/api/coupons", { method: "POST", body: { code, discount, maxUse, used: 0 } });
      await refreshCoupons();
      document.getElementById("admin-coupon-code").value = "";
      document.getElementById("admin-coupon-discount").value = "";
      document.getElementById("admin-coupon-max-use").value = "";
      addNotification("✅ Thêm mã giảm giá thành công!");
      updateAdminPromotions();
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể thêm mã giảm giá"}`);
    }
  })();
}

function adminAddFlashSale() {
  const productId = document.getElementById("flash-sale-product").value;
  const discount = parseInt(document.getElementById("flash-sale-discount").value, 10);
  const qty = parseInt(document.getElementById("flash-sale-qty").value, 10);
  if (!productId || !Number.isFinite(discount) || !Number.isFinite(qty)) return;
  const product = allProducts.find((p) => p.__backendId === productId);
  if (!product) return;
  product.isFlashSale = true;
  product.isSale = true;
  product.discount = Math.max(0, Math.min(100, discount));
  allFlashSales.push({ productId, discount: product.discount, qty, started: new Date(), endTime: new Date(Date.now() + 60 * 60 * 1000) });
  flashSaleEndMs = Date.now() + 60 * 60 * 1000;
  addNotification("✅ Bắt đầu flash sale thành công!");
  updateAdminPromotions();
  displayFlashSale();
  apiJson(`/api/products/${encodeURIComponent(productId)}`, { method: "PUT", body: product }).catch(() => {});
}

function updateAdminPromotions() {
  const select = document.getElementById("flash-sale-product");
  select.innerHTML = allProducts.map((p) => `<option value="${p.__backendId}">${p.name}</option>`).join("");

  document.getElementById("admin-coupons-list").innerHTML = `
    <table class="w-full text-sm border rounded overflow-hidden">
      <tr class="bg-gray-100 border-b"><th class="px-4 py-2 text-left">Mã</th><th class="px-4 py-2 text-left">% Giảm</th><th class="px-4 py-2 text-left">Dùng/Tối Đa</th></tr>
      ${allCoupons.map((c) => `<tr class="border-b"><td class="px-4 py-2 font-bold">${c.code}</td><td class="px-4 py-2">${c.discount}%</td><td class="px-4 py-2">${c.used}/${c.maxUse}</td></tr>`).join("")}
    </table>`;

  document.getElementById("admin-flashsales-list").innerHTML = `
    <table class="w-full text-sm border rounded overflow-hidden">
      <tr class="bg-gray-100 border-b"><th class="px-4 py-2 text-left">Sản Phẩm</th><th class="px-4 py-2 text-left">% Giảm</th><th class="px-4 py-2 text-left">Còn</th></tr>
      ${allFlashSales
        .map((s) => {
          const p = allProducts.find((x) => x.__backendId === s.productId);
          return `<tr class="border-b"><td class="px-4 py-2">${p ? p.name : "N/A"}</td><td class="px-4 py-2">${s.discount}%</td><td class="px-4 py-2">${s.qty}</td></tr>`;
        })
        .join("")}
    </table>`;
}

function toggleChatbox() {
  const chatWindow = document.getElementById("chatbox-window");
  chatWindow.classList.toggle("hidden");
  if (!chatWindow.classList.contains("hidden")) document.getElementById("chat-input").focus();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function saveChatHistory() {
  try {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory.slice(-200)));
  } catch {
    // ignore
  }
}

function loadChatHistory() {
  try {
    const raw = localStorage.getItem("chatHistory");
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) chatHistory = parsed.slice(-200);
  } catch {
    chatHistory = [];
  }

  try {
    const raw = localStorage.getItem("compareList");
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) compareList = parsed.filter((x) => typeof x === "string").slice(-3);
  } catch {
    compareList = [];
  }

  if (!chatHistory.length) return;
  const messagesDiv = document.getElementById("chat-messages");
  if (!messagesDiv) return;
  messagesDiv.innerHTML = "";
  for (const m of chatHistory) {
    addChatMessage(m.sender, m.text, { html: !!m.html, persist: false });
  }
}

function addChatMessage(sender, text, { html = false, persist = true } = {}) {
  const messagesDiv = document.getElementById("chat-messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = "flex gap-3 " + (sender === "user" ? "justify-end" : "");
  const safe = html ? String(text || "") : escapeHtml(text);
  messageDiv.innerHTML =
    sender === "user"
      ? `<div class="bg-purple-600 text-white rounded-lg p-3 shadow-sm max-w-xs"><p class="text-sm break-words">${safe}</p></div>`
      : `<div class="text-2xl">🤖</div><div class="bg-white rounded-lg p-3 shadow-sm max-w-xs"><div class="text-sm text-gray-700 break-words">${safe}</div></div>`;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  if (persist) {
    chatHistory.push({ sender, text: String(text || ""), html: !!html, ts: Date.now() });
    if (chatHistory.length > 200) chatHistory = chatHistory.slice(-200);
    saveChatHistory();
  }
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAge(text) {
  const s = normalizeText(text);
  // "bé 5 tuổi", "5 tuoi"
  const m1 = s.match(/(\d{1,2})\s*(tuoi|t)\b/);
  if (m1) return { years: Number(m1[1]) };
  // "12 tháng", "12 thang"
  const m2 = s.match(/(\d{1,2})\s*(thang)\b/);
  if (m2) return { months: Number(m2[1]) };
  return null;
}

function extractBudgetVnd(text) {
  const s = normalizeText(text);
  // 100k / 200k
  const mk = s.match(/(\d{1,4})\s*k\b/);
  if (mk) return Number(mk[1]) * 1000;

  // 1tr / 2tr
  const mtr = s.match(/(\d{1,2})\s*(tr|trieu)\b/);
  if (mtr) return Number(mtr[1]) * 1000000;

  // 100000 / 100.000 / 100,000
  const mnum = String(text || "").match(/(\d{1,3}([.,]\d{3})+|\d{5,})/);
  if (mnum) {
    const v = mnum[1].replace(/[.,]/g, "");
    const n = Number(v);
    if (Number.isFinite(n) && n >= 10000) return n;
  }
  return null;
}

function getProductDeepLink(id) {
  try {
    return `${location.origin}/?product=${encodeURIComponent(id)}`;
  } catch {
    return `/?product=${encodeURIComponent(id)}`;
  }
}

function chatOpenProduct(id) {
  try {
    viewProduct(id);
    const el = document.getElementById("chatbox-window");
    if (el && el.classList.contains("hidden")) el.classList.remove("hidden");
  } catch {
    // ignore
  }
}

function findProductsByText(query, limit = 5) {
  const q = normalizeText(query);
  if (!q) return [];

  // match by id
  const exactById = (allProducts || []).find((p) => normalizeText(p.__backendId) === q);
  if (exactById) return [exactById];

  const scored = (allProducts || [])
    .map((p) => {
      const name = normalizeText(p.name);
      const cat = normalizeText(p.category);
      let score = 0;
      if (name === q) score += 100;
      if (name.includes(q)) score += 50;
      if (cat.includes(q)) score += 10;
      score += Number(p.rating || 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);

  return scored;
}

function formatProductListHtml(items, { showCompare = true } = {}) {
  if (!items.length) return "<div>Không tìm thấy sản phẩm phù hợp.</div>";
  return `
    <div class="space-y-2">
      ${items
        .map((p) => {
          const link = getProductDeepLink(p.__backendId);
          const price = money(discountedPrice(p));
          return `
            <div class="border rounded-lg p-2 bg-gray-50">
              <div class="font-semibold">${escapeHtml(p.name)}</div>
              <div class="text-xs text-gray-600">${escapeHtml(p.category || "")} • ${price} • ⭐ ${Number(p.rating || 0).toFixed(1)}</div>
              <div class="mt-2 flex gap-2 flex-wrap">
                <button class="px-2 py-1 text-xs bg-purple-600 text-white rounded" onclick="chatOpenProduct('${p.__backendId}')">Xem</button>
                <a class="px-2 py-1 text-xs bg-gray-200 rounded" href="${link}" target="_blank" rel="noopener">Link</a>
                ${showCompare ? `<button class="px-2 py-1 text-xs bg-blue-600 text-white rounded" onclick="chatAddCompare('${p.__backendId}')">So sánh</button>` : ""}
              </div>
            </div>`;
        })
        .join("")}
    </div>`;
}

function chatAddCompare(id) {
  const p = (allProducts || []).find((x) => x.__backendId === id);
  if (!p) return;
  if (!compareList.includes(id)) compareList.push(id);
  if (compareList.length > 3) compareList = compareList.slice(-3);
  try {
    localStorage.setItem("compareList", JSON.stringify(compareList));
  } catch {
    // ignore
  }
  addChatMessage("bot", `Đã thêm vào so sánh: ${p.name}. Gõ "so sánh" để xem bảng so sánh.`, { html: false });
}

function chatCompareNow() {
  const items = compareList.map((id) => (allProducts || []).find((p) => p.__backendId === id)).filter(Boolean);
  if (items.length < 2) return { text: "Bạn cần chọn ít nhất 2 sản phẩm để so sánh. Bạn có thể gõ: 'so sánh <tên sản phẩm A> và <tên sản phẩm B>' hoặc bấm nút So sánh ở từng sản phẩm.", html: false };

  const rows = items
    .map((p) => {
      const link = getProductDeepLink(p.__backendId);
      return `
        <tr class="border-b">
          <td class="px-3 py-2 font-semibold">${escapeHtml(p.name)}</td>
          <td class="px-3 py-2">${escapeHtml(p.category || "")}</td>
          <td class="px-3 py-2">${money(discountedPrice(p))}</td>
          <td class="px-3 py-2">⭐ ${Number(p.rating || 0).toFixed(1)}</td>
          <td class="px-3 py-2">${Number(p.stock || 0)}</td>
          <td class="px-3 py-2"><a class="text-purple-700 underline" href="${link}" target="_blank" rel="noopener">Mở</a></td>
        </tr>`;
    })
    .join("");

  return {
    html: true,
    text: `
      <div class="font-semibold mb-2">Bảng so sánh</div>
      <div class="overflow-x-auto">
        <table class="text-xs w-full">
          <tr class="bg-gray-100 border-b">
            <th class="px-3 py-2 text-left">Sản phẩm</th>
            <th class="px-3 py-2 text-left">Danh mục</th>
            <th class="px-3 py-2 text-left">Giá</th>
            <th class="px-3 py-2 text-left">Rating</th>
            <th class="px-3 py-2 text-left">Tồn</th>
            <th class="px-3 py-2 text-left">Link</th>
          </tr>
          ${rows}
        </table>
      </div>
      <div class="mt-2 text-xs text-gray-600">Gõ "xóa so sánh" để xoá danh sách so sánh.</div>`,
  };
}

function getUpsellSuggestions(product) {
  const cat = normalizeText(product?.category);
  const related = (allProducts || [])
    .filter((p) => p.__backendId !== product.__backendId)
    .filter((p) => (cat ? normalizeText(p.category) === cat : true))
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 2);

  const hints = [];
  if (cat.includes("xe")) hints.push("Gợi ý kèm: pin dự phòng/ sạc (nếu dùng pin), hoặc thêm 1 xe nhỏ để bé chơi cùng bạn.");
  if (cat.includes("xep") || cat.includes("xếp")) hints.push("Gợi ý kèm: thêm 1 bộ xếp hình nhỏ để mở rộng mô hình.");
  if (cat.includes("gau") || cat.includes("gấu")) hints.push("Gợi ý kèm: túi quà + thiệp để tặng sinh nhật.");

  return { related, hints };
}

function suggestProducts({ maxPrice, category } = {}) {
  const items = (allProducts || [])
    .filter((p) => (category ? normalizeText(p.category).includes(normalizeText(category)) : true))
    .filter((p) => (maxPrice ? discountedPrice(p) <= maxPrice : true))
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
    .slice(0, 3);
  if (!items.length) return "";
  return items.map((p) => `• ${p.name} (${money(discountedPrice(p))})`).join("\n");
}

function getChatbotResponse(message) {
  const raw = String(message || "").trim();
  const msg = normalizeText(raw);

  // Commands: history / compare
  if (msg === "xoa lich su" || msg === "xoa lich su chat") {
    chatHistory = [];
    try {
      localStorage.removeItem("chatHistory");
    } catch {
      // ignore
    }
    return { text: "Đã xóa lịch sử chat.", html: false };
  }
  if (msg === "xoa so sanh" || msg === "bo so sanh") {
    compareList = [];
    try {
      localStorage.removeItem("compareList");
    } catch {
      // ignore
    }
    return { text: "Đã xóa danh sách so sánh.", html: false };
  }
  if (msg === "so sanh" || msg === "compare") {
    return chatCompareNow();
  }

  // Find product
  if (msg.startsWith("tim ") || msg.startsWith("tim san pham") || msg.includes("tim san pham")) {
    const q = raw.replace(/^tìm\s+sản\s+phẩm\s*/i, "").replace(/^tim\s+san\s+pham\s*/i, "").replace(/^tìm\s*/i, "").replace(/^tim\s*/i, "").trim();
    const items = findProductsByText(q || msg, 5);
    return { html: true, text: `<div class="font-semibold mb-2">Kết quả tìm kiếm</div>${formatProductListHtml(items)}` };
  }

  // Suggest product
  if (msg.startsWith("goi y") || msg.startsWith("gợi ý") || msg.includes("goi y san pham") || msg.includes("gợi ý sản phẩm")) {
    const budget = extractBudgetVnd(raw);
    const items = (allProducts || [])
      .filter((p) => (budget ? discountedPrice(p) <= budget : true))
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 5);
    return {
      html: true,
      text: `<div class="font-semibold mb-2">Gợi ý sản phẩm${budget ? ` trong ngân sách ${money(budget)}` : ""}</div>${formatProductListHtml(items)}`,
    };
  }

  // Upsell / add-on suggestions
  if (msg.startsWith("upsell") || msg.startsWith("mua ") || msg.startsWith("them ") || msg.startsWith("thêm ")) {
    const q = raw.replace(/^upsell\s*/i, "").replace(/^mua\s*/i, "").replace(/^them\s*/i, "").replace(/^thêm\s*/i, "").trim();
    const p = findProductsByText(q, 1)[0];
    if (!p) {
      return { text: "Bạn muốn mình upsell cho sản phẩm nào? (gõ tên hoặc mã sản phẩm)", html: false };
    }
    const { related, hints } = getUpsellSuggestions(p);
    const relatedHtml = related.length ? formatProductListHtml(related, { showCompare: false }) : "<div>Chưa có sản phẩm liên quan để gợi ý.</div>";
    return {
      html: true,
      text: `<div class="font-semibold mb-2">Gợi ý mua kèm cho: ${escapeHtml(p.name)}</div>${hints.length ? `<div class="text-xs text-gray-700 mb-2">${escapeHtml(hints.join(" "))}</div>` : ""}${relatedHtml}`,
    };
  }

  // Compare by text: "so sánh A và B"
  if (msg.startsWith("so sanh") || msg.startsWith("so sánh")) {
    const cleaned = raw.replace(/^so\s*s[aá]nh\s*/i, "").trim();
    const parts = cleaned.split(/\s+va\s+|\s+v[ớo]i\s+|&|,/i).map((x) => x.trim()).filter(Boolean);
    const picks = parts.slice(0, 3).map((q) => findProductsByText(q, 1)[0]).filter(Boolean);
    compareList = picks.map((p) => p.__backendId);
    try {
      localStorage.setItem("compareList", JSON.stringify(compareList));
    } catch {
      // ignore
    }
    return chatCompareNow();
  }

  // Send product link
  if (msg.includes("gui link") || msg.includes("gửi link") || msg.includes("link san pham") || msg.includes("link sản phẩm")) {
    const q = raw.replace(/gửi link|gui link|link sản phẩm|link san pham/gi, "").trim();
    const p = findProductsByText(q, 1)[0];
    if (!p) return { text: "Bạn muốn link sản phẩm nào? (gõ tên hoặc mã sản phẩm)", html: false };
    const link = getProductDeepLink(p.__backendId);
    return { html: true, text: `Link sản phẩm: <a class="text-purple-700 underline" href="${link}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>` };
  }

  // Quick intents
  if (msg.includes("agent") || msg.includes("ho tro") || msg.includes("lien he")) {
    return 'Bạn có thể bấm nút "👤 Gọi agent" bên dưới để được hỗ trợ trực tiếp.';
  }
  if (msg.includes("don hang") || msg.includes("order")) {
    return currentUser ? 'Bạn có thể xem đơn hàng tại mục "Đơn Hàng".' : "Vui lòng đăng nhập để xem đơn hàng của bạn.";
  }
  if (msg.includes("khuyen mai") || msg.includes("giam gia") || msg.includes("sale") || msg.includes("flash")) {
    return `Hiện có ${allCoupons.length} mã giảm giá hoạt động. Bạn nhập mã ở trang "Giỏ Hàng" → ô "Mã Giảm Giá".`;
  }
  if (msg.includes("ship") || msg.includes("giao hang") || msg.includes("van chuyen")) {
    return "Hiện tại web demo đang tính phí giao hàng cố định 30.000đ/đơn. Nếu bạn cho mình tỉnh/thành, mình tư vấn phương án giao phù hợp.";
  }

  // Nhóm 1: Thông tin sản phẩm & chất lượng
  const productInfoRules = [
    { keys: ["abs", "pp", "nhua", "chat lieu"], answer: "Để trả lời đúng (ABS/PP/nhựa tái chế/gỗ/vải), bạn cho mình tên sản phẩm (hoặc ảnh/mã) nhé." },
    { keys: ["cr", "chung chi"], answer: "Về chứng chỉ an toàn CR: bạn gửi tên/mã sản phẩm để mình kiểm tra thông tin theo lô hàng/nhà sản xuất nhé." },
    { keys: ["son", "do go", "goc nuoc"], answer: "Đồ chơi gỗ nên dùng sơn gốc nước/không độc hại và bề mặt mịn. Bạn cho mình tên/mã sản phẩm để mình xác nhận loại sơn/chất liệu." },
    { keys: ["ngam", "hay ngam", "an toan nhat"], answer: "Bé hay ngậm đồ chơi: ưu tiên đồ chơi 1 khối, không chi tiết nhỏ, vật liệu an toàn, bo tròn cạnh. Bạn cho mình độ tuổi bé và loại đồ chơi bạn định mua nhé." },
    { keys: [ "manh ghep", "chi tiet", "bao nhieu manh"], answer: "Bạn cho mình tên/mã bộ Lego/xếp hình để mình báo chính xác số mảnh và độ tuổi phù hợp nhé." },
    { keys: ["kich thuoc", "lap xong", "bao nhieu cm"], answer: "Bạn gửi tên/mã sản phẩm để mình cung cấp kích thước sau khi lắp (cm) chính xác nhé." },
    { keys: ["pin", "aa", "aaa"], answer: "Bạn cho mình tên/mã sản phẩm để mình kiểm tra dùng pin AA hay AAA và có kèm pin trong hộp không nhé." },
    { keys: ["kem pin", "co pin"], answer: "Tuỳ mẫu có kèm pin hoặc không. Bạn gửi tên/mã sản phẩm để mình trả lời chính xác nhé." },
    { keys: ["chinh hang", "noi dia", "trung quoc", "hang gi"], answer: "Bạn gửi giúp mình tên/mã sản phẩm để mình xác nhận nguồn gốc/hãng (chính hãng hay nội địa) và thông tin bảo hành." },
    { keys: ["co nhac", "nhac", "tieng anh", "tieng viet"], answer: "Bạn gửi tên/mã sản phẩm có nhạc để mình kiểm tra có nhạc không và ngôn ngữ (Anh/Việt) nhé." },
    { keys: ["may thang", "bao nhieu thang", "tham nhac"], answer: "Bạn cho mình độ tuổi bé (mấy tháng) để mình tư vấn thảm nhạc/phát triển giác quan phù hợp và an toàn nhé." },
    { keys: ["xe dieu khien", "tam", "phat song", "met"], answer: "Xe điều khiển: tầm phát sóng tuỳ mẫu. Bạn gửi tên/mã xe để mình báo số mét và loại điều khiển (RF/Bluetooth) nhé." },
    { keys: ["dat nan", "kho", "kho cung"], answer: "Đất nặn: tuỳ loại có khô theo thời gian. Bạn cho mình tên/loại đất nặn để mình hướng dẫn bảo quản (đậy kín, hộp zip) nhé." },
    { keys: ["bup be", "thay quan ao", "chai toc"], answer: "Búp bê đa phần thay quần áo và chải tóc được (tuỳ tóc sợi/tóc cấy). Bạn gửi mẫu búp bê để mình xác nhận phụ kiện đi kèm nhé." },
    { keys: ["robot", "biet noi", "cam bien lui", "cam bien"], answer: "Robot: tuỳ mẫu có nói/cảm biến. Bạn gửi tên/mã robot để mình kiểm tra tính năng (nói, tránh vật cản, cảm biến lùi) nhé." },
    { keys: ["piano", "cam ung luc", "phim nang", "dien tu"], answer: "Đàn Piano điện của bạn có tính năng Touch Response (gõ mạnh kêu to, gõ nhẹ kêu nhỏ). Bạn có cần hướng dẫn kết nối App học đàn không?" },
    { keys: ["rubik", "nam cham", "tron", "speedcube"], answer:"Nếu là dòng Speedcube có nam châm, xoay sẽ rất mượt. Bạn đang dùng Rubik 3x3 hay các khối biến thể khác?" },
    { keys: ["gau bong", "rung long", "rut long"], answer: "Gấu bông: ưu tiên vải mềm, may chắc, ít rụng lông. Bạn gửi mẫu bạn đang xem để mình tư vấn loại vải và cách vệ sinh." },
    { keys: ["bang ve", "dien tu", "xoa tung phan"], answer: "Bảng vẽ điện tử: tuỳ mẫu có xoá từng phần hoặc xoá toàn bộ. Bạn gửi tên/mã bảng vẽ để mình xác nhận nhé." },
    { keys: ["hoc so", "chu cai", "so va chu"], answer: "Nếu mục tiêu học số/chữ cái: bạn cho mình độ tuổi bé để mình gợi ý bộ thẻ học/đồ chơi giáo dục phù hợp nhé." },
    { keys: ["khung kim loai", "diecast", "hop kim","metal structure"], answer: "Các mẫu Gundam cao cấp có khung xương bằng hợp kim (diecast). Bạn cần kiểm tra chi tiết kim loại cho mẫu mecha nào?" },
  ];

  for (const r of productInfoRules) {
    if (r.keys.some((k) => msg.includes(k))) return r.answer;
  }

  // Nhóm 2: Tư vấn quà tặng & độ tuổi
  const age = extractAge(raw);
  const budget = extractBudgetVnd(raw);
  if (msg.includes("qua") || msg.includes("tang") || msg.includes("sinh nhat") || msg.includes("noel") || msg.includes("trung thu") || msg.includes("1/6")) {
    if (age?.years === 1) return "Bé 1 tuổi: gợi ý đồ chơi xếp chồng, thả khối, sách vải, đồ chơi âm thanh nhẹ (an toàn, ít chi tiết nhỏ). Bạn muốn bé trai hay bé gái và ngân sách bao nhiêu?";
    if (age?.years === 3) return "Bé 3 tuổi: gợi ý đồ chơi vận động nhẹ, xếp hình đơn giản, đồ chơi nhập vai (bếp, bác sĩ), xe kéo. Bạn thích bé vận động hay chơi trí tuệ?";
    if (age?.years === 5) return "Bé 5 tuổi: gợi ý búp bê/phụ kiện, đồ chơi nấu ăn, bộ xếp hình nâng cao, boardgame đơn giản. Bạn nói giúp bé thích chủ đề nào (công chúa/siêu nhân/xe cộ/âm nhạc)?";
    if (age?.years && age.years >= 6) return `Bé ${age.years} tuổi: gợi ý STEM/boardgame/xếp hình theo sở thích. Bạn cho mình sở thích và ngân sách để mình chốt 3 lựa chọn phù hợp nhất nhé.`;
    return "Bạn cho mình độ tuổi của bé (mấy tuổi/mấy tháng) + sở thích + ngân sách, mình gợi ý quà đúng ý ngay.";
  }

  if (msg.includes("be gai") && msg.includes("5") && msg.includes("tuoi")) return "Bé gái 5 tuổi thường thích búp bê/phụ kiện hoặc đồ chơi nhập vai (nấu ăn). Nếu bé thích chăm sóc/đóng vai: chọn búp bê; nếu thích bắt chước người lớn: chọn bộ nấu ăn.";
  if (msg.includes("be trai") && msg.includes("3") && msg.includes("tuoi") && (msg.includes("van dong") || msg.includes("the thao")))
    return "Bé trai 3 tuổi: gợi ý xe chòi chân, bóng/đồ chơi ném bắt, xe kéo, hầm chui. Bạn muốn chơi trong nhà hay ngoài trời?";
  if (msg.includes("stem") && (msg.includes("8") || msg.includes("8 tuoi"))) return "STEM cho bé 8 tuổi: nên chọn bộ thí nghiệm đơn giản, lắp ráp theo hướng dẫn từng bước. Bạn cho mình bé thích khoa học hay lắp ráp để mình gợi ý đúng.";
  if (msg.includes("boardgame") || msg.includes("co vua") || msg.includes("tro choi ban")) return "Boardgame cho bé 6 tuổi: ưu tiên luật đơn giản, ván ngắn (10–20 phút), chơi 2–4 người. Bạn cho mình số người chơi và độ tuổi để mình gợi ý.";
  if (msg.includes("sieu nhan")) return "Bạn thích siêu nhân chủ đề nào (Marvel/DC/siêu anh hùng robot)? Bạn gửi từ khoá hoặc ảnh để mình gợi ý mẫu gần nhất trong shop.";
  if (msg.includes("kinh hien vi") || msg.includes("ong nhom")) return "Bé thích khám phá thiên nhiên: kính hiển vi phù hợp quan sát chi tiết (lá, côn trùng), ống nhòm phù hợp quan sát xa (chim, cảnh). Nếu bé hay chơi ngoài trời → ống nhòm; thích thí nghiệm trong nhà → kính hiển vi.";
  if (msg.includes("song sinh")) return "Song sinh (1 trai 1 gái): gợi ý 1 bộ chơi chung (boardgame, xếp hình) + 2 món nhỏ theo sở thích riêng. Bạn cho mình độ tuổi để mình gợi ý cụ thể.";
  if (msg.includes("duoi") && msg.includes("100k")) {
    const sug = suggestProducts({ maxPrice: 100000 });
    return sug ? `Gợi ý dưới 100k:\n${sug}\nBạn muốn quà cho bé mấy tuổi?` : "Bạn cho mình độ tuổi bé, mình sẽ gợi ý vài món dưới 100k phù hợp.";
  }

  // Nhóm 3: Giá cả & khuyến mãi
  if (msg.includes("ma giam gia") || msg.includes("voucher") || msg.includes("code")) {
    const m = raw.match(/\[([A-Z0-9_-]{3,})\]/i);
    const code = m ? m[1] : null;
    return code
      ? `Bạn nhập mã ${code} ở trang "Giỏ Hàng" → ô "Mã Giảm Giá" rồi bấm "Áp Dụng".`
      : 'Bạn nhập mã ở trang "Giỏ Hàng" → ô "Mã Giảm Giá" rồi bấm "Áp Dụng".';
  }
  if (msg.includes("dong gia")) return "Bạn cho mình mức đồng giá bạn muốn (ví dụ 99k/199k). Mình sẽ gợi ý các sản phẩm phù hợp trong shop.";
  if (msg.includes("shopee") || msg.includes("lazada")) return "Giá trên sàn có thể khác do chương trình/voucher từng kênh. Bạn gửi link hoặc tên sản phẩm để mình kiểm tra giá đúng giúp bạn.";
  if (msg.includes("vip") || msg.includes("thanh vien")) return "Chương trình VIP phụ thuộc chính sách shop. Bạn để lại số điện thoại/email, mình ghi nhận để admin tư vấn ưu đãi theo hạng thành viên.";
  if (msg.includes("tra gop")) return "Trả góp: hiện web demo chưa tích hợp. Nếu bạn cần, mình có thể hướng dẫn phương án thanh toán/chia đơn phù hợp.";
  if (msg.includes("qua tang kem") || msg.includes("gift")) return "Quà tặng kèm thường áp dụng theo chương trình. Bạn cho mình giá trị đơn dự kiến và món bạn mua, mình kiểm tra xem có quà tặng kèm không nhé.";
  if (msg.includes("xa kho") || msg.includes("black friday")) return "Đợt xả kho/sale lớn thường vào dịp lễ lớn (Black Friday, Noel, Tết). Bạn muốn mình báo khi có chương trình không?";
  if (msg.includes("mua 2") || msg.includes("mua hai")) return "Mua 2 bộ: tuỳ chương trình sẽ có giảm thêm/áp mã. Bạn cho mình tên sản phẩm và số lượng để mình tính giá tốt nhất.";
  if (msg.includes("mien phi ship") || msg.includes("freeship")) return "Freeship hiện chưa cấu hình theo ngưỡng trong web demo. Bạn cho mình địa chỉ nhận, mình tư vấn phí và ưu đãi nếu có.";
  if (msg.includes("phi ship") && msg.includes("50")) return "Hỗ trợ 50% phí ship: tuỳ chương trình. Bạn cho mình địa chỉ nhận + giá trị đơn để mình kiểm tra ưu đãi.";
  if (msg.includes("gia le") || msg.includes("chiet khau")) return "Giá hiển thị là giá bán lẻ; nếu có khuyến mãi sẽ áp qua mã giảm giá hoặc flash sale. Bạn muốn mình kiểm tra giá cuối cho món nào?";
  if (msg.includes("mua kem") || msg.includes("deal soc") || msg.includes("phu kien")) return "Deal phụ kiện (pin/hộp): bạn cho mình món chính đang mua, mình sẽ gợi ý phụ kiện phù hợp và ưu đãi (nếu có).";
  if (msg.includes("gia") || msg.includes("duoi") || msg.includes("100k") || msg.includes("ngan sach")) {
    if (budget) {
      const sug = suggestProducts({ maxPrice: budget });
      return sug ? `Gợi ý trong ngân sách ${money(budget)}:\n${sug}\nBạn mua cho bé mấy tuổi và thích chủ đề gì?` : "Bạn cho mình độ tuổi bé và chủ đề (xe/xếp hình/gấu bông…), mình gợi ý trong ngân sách nhé.";
    }
    return "Bạn cho mình ngân sách (vd: dưới 100k/200k/500k) + độ tuổi bé, mình sẽ lọc vài sản phẩm phù hợp trong shop.";
  }
  if (msg.includes("si") || msg.includes("mua si") || msg.includes("so luong lon")) {
    return "Mua số lượng lớn: bạn cho mình số lượng dự kiến và danh sách món (hoặc loại đồ chơi), mình sẽ báo chính sách giá tốt theo số lượng.";
  }

  // Nhóm 4: Đặt hàng & Thanh toán
  const orderPayRules = [
    { keys: ["huy don", "huy"], answer: "Bạn gửi giúp mình mã đơn (ORD-xxxx) và lý do hủy, mình sẽ hướng dẫn xử lý nhé." },
    { keys: ["dat coc"], answer: "Thông thường không cần đặt cọc với COD; với đơn giá trị lớn có thể cần xác nhận. Bạn cho mình giá trị đơn dự kiến để mình tư vấn." },
    { keys: ["chuyen khoan", "ngan hang"], answer: "Chuyển khoản: hiện web demo chưa hiển thị số tài khoản cố định. Bạn để lại yêu cầu, mình sẽ nhờ admin gửi thông tin ngân hàng." },
    { keys: ["momo", "zalopay", "shopeepay", "vi dien tu"], answer: "Ví điện tử: trong web demo bạn có thể chọn 'Ví điện tử' ở Giỏ Hàng. Nếu bạn cần ví cụ thể (Momo/ZaloPay), mình ghi nhận để shop hỗ trợ." },
    { keys: ["the tin dung", "credit"], answer: "Thẻ tín dụng khi nhận hàng: tuỳ đơn vị vận chuyển. Hiện demo chưa hỗ trợ. Bạn muốn COD hay chuyển khoản/ ví?" },
    { keys: ["dat thanh cong", "xac nhan"], answer: "Khi đặt hàng thành công, hệ thống sẽ tạo mã đơn (ORD-xxxx) và bạn xem lại trong mục 'Đơn Hàng'." },
    { keys: ["hoa don", "vat"], answer: "Hóa đơn VAT: bạn cho mình thông tin công ty và mã số thuế, mình sẽ chuyển admin hỗ trợ xuất hóa đơn." },
    { keys: ["nham dia chi", "sua dia chi"], answer: "Bạn gửi mã đơn + địa chỉ đúng, mình sẽ hướng dẫn cập nhật (nếu đơn chưa giao cho shipper thì sửa được)." },
    { keys: ["toi da", "max", "bao nhieu bo"], answer: "Số lượng tối đa tuỳ tồn kho. Bạn cho mình tên sản phẩm và số lượng muốn mua để mình kiểm tra tồn." },
    { keys: ["zalo"], answer: "Xác nhận qua Zalo: hiện demo chưa tích hợp tự động. Bạn để lại số Zalo, shop có thể liên hệ xác nhận." },
    { keys: ["uu tien", "giao nhanh"], answer: "Thanh toán trước có thể giúp xử lý nhanh hơn tuỳ đơn. Bạn cho mình khu vực nhận để mình tư vấn phương án giao." },
    { keys: ["dat ho"], answer: "Đặt hộ: bạn chỉ cần nhập thông tin người nhận, còn bạn thanh toán trước. Bạn muốn COD hay chuyển khoản/ ví?" },
    { keys: ["loi thanh toan"], answer: "Nếu web báo lỗi thanh toán: bạn thử đổi phương thức (COD) hoặc tải lại trang. Nếu vẫn lỗi, gửi giúp mình ảnh màn hình lỗi." },
    { keys: ["gop don"], answer: "Gộp đơn: bạn gửi 2 mã đơn hoặc danh sách món, mình sẽ hướng dẫn gộp để tối ưu phí ship (nếu còn kịp xử lý)." },
    { keys: ["giu hang", "2 ngay"], answer: "Giữ hàng 2 ngày: bạn cho mình tên sản phẩm + số lượng, mình sẽ ghi chú để shop giữ (tuỳ tồn kho)." },
  ];
  for (const r of orderPayRules) {
    if (r.keys.some((k) => msg.includes(k))) return r.answer;
  }

  // Nhóm 5: Vận chuyển & giao nhận
  const shippingRules = [
    { keys: ["hoa toc", "grab", "ahamove"], answer: "Giao hỏa tốc: thường 1–3 giờ trong nội thành (tuỳ khoảng cách). Bạn cho mình địa chỉ nhận để mình tư vấn." },
    { keys: ["ha noi", "tp hcm", "may ngay"], answer: "Hà Nội nhận từ TP.HCM thường 2–5 ngày (tuỳ đơn vị vận chuyển). Bạn cho mình quận/huyện để ước tính sát hơn." },
    { keys: ["kiem tra hang", "xem hang"], answer: "Kiểm tra hàng: tuỳ chính sách đơn vị giao. Bạn có thể yêu cầu 'được kiểm tra' khi nhận. Nếu shipper không cho xem, bạn chụp ảnh kiện hàng và liên hệ shop để hỗ trợ." },
    { keys: ["dong goi", "kin dao", "che ten"], answer: "Shop có thể đóng gói kín/che tên sản phẩm. Bạn nhắn 'đóng gói kín' khi đặt hàng nhé." },
    { keys: ["de vo", "boc xop", "chong soc"], answer: "Hàng dễ vỡ: shop sẽ bọc chống sốc (xốp nổ/đệm). Bạn cho mình sản phẩm nào dễ vỡ để mình ghi chú đóng gói kỹ." },
    { keys: ["buu cuc"], answer: "Nhận tại bưu cục: tuỳ đơn vị vận chuyển. Bạn cho mình khu vực và đơn vị bạn muốn (GHN/GHTK/VNPost) để mình tư vấn." },
    { keys: ["luan chuyen"], answer: "Trạng thái 'Đang luân chuyển' lâu: bạn gửi mã đơn/mã vận đơn, mình hướng dẫn cách kiểm tra và escalte hỗ trợ." },
    { keys: ["goi truoc"], answer: "Shipper thường sẽ gọi trước khi giao. Bạn có thể ghi chú 'gọi trước khi giao' ở phần thông tin nhận hàng." },
    { keys: ["doi so dien thoai"], answer: "Đổi số điện thoại nhận: bạn gửi mã đơn + số mới, mình hướng dẫn cập nhật (nếu chưa phát hàng)." },
    { keys: ["chu nhat", "ngay le"], answer: "Giao Chủ nhật/ngày lễ: tuỳ khu vực và đơn vị vận chuyển. Bạn cho mình địa chỉ nhận để mình kiểm tra khả năng giao." },
    { keys: ["vung sau", "vung xa", "huyen", "xa"], answer: "Phí ship vùng sâu/vùng xa: tuỳ đơn vị. Bạn cho mình địa chỉ cụ thể để ước tính phí." },
    { keys: ["hen gio", "gio hanh chinh"], answer: "Hẹn giao giờ hành chính: bạn ghi chú khung giờ mong muốn, shipper sẽ cố gắng giao theo ghi chú." },
    { keys: ["ma van don", "van don"], answer: "Mã vận đơn: bạn gửi mã đơn (ORD-xxxx), mình sẽ hướng dẫn cách lấy thông tin theo dõi (trong demo hiện chưa hiển thị tự động)." },
    { keys: ["that lac", "mat hang"], answer: "Nếu thất lạc: bạn gửi mã đơn/mã vận đơn + thời điểm, shop sẽ làm việc với vận chuyển để xử lý (gửi lại/hoàn tiền tuỳ trường hợp)." },
  ];
  for (const r of shippingRules) {
    if (r.keys.some((k) => msg.includes(k))) return r.answer;
  }

  // Nhóm 6: Bảo hành & khiếu nại
  const warrantyRules = [
    { keys: ["loi ky thuat", "khong len dien"], answer: "Hàng lỗi kỹ thuật: bạn gửi mã đơn + video/ảnh lỗi, shop sẽ hướng dẫn đổi mới/bảo hành tuỳ sản phẩm." },
    { keys: ["doi tra", "bao nhieu ngay"], answer: "Đổi trả: tuỳ chính sách từng sản phẩm. Bạn gửi mã đơn + sản phẩm để mình hướng dẫn thời gian/điều kiện đổi trả." },
    { keys: ["thieu manh", "thieu phu kien"], answer: "Thiếu mảnh/phụ kiện: bạn chụp ảnh và gửi mã đơn, shop sẽ hỗ trợ gửi bù nếu xác nhận thiếu." },
    { keys: ["phi van chuyen", "bao hanh"], answer: "Phí vận chuyển bảo hành: tuỳ lỗi do nhà sản xuất hay do sử dụng. Bạn gửi tình trạng để shop tư vấn chi tiết." },
    { keys: ["het han bao hanh", "sua"], answer: "Hết hạn bảo hành: shop có thể hỗ trợ sửa/bán linh kiện tuỳ loại. Bạn gửi sản phẩm và lỗi để mình kiểm tra khả năng hỗ trợ." },
    { keys: ["lam qua", "khong thich", "doi mau"], answer: "Mua làm quà: đổi mẫu phụ thuộc tình trạng nguyên hộp/chưa sử dụng. Bạn gửi mã đơn để shop kiểm tra điều kiện đổi." },
    { keys: ["hoan tien 100"], answer: "Hoàn tiền 100% thường áp dụng khi lỗi nghiêm trọng do nhà sản xuất/không thể đổi. Bạn gửi mã đơn + bằng chứng để shop xử lý." },
    { keys: ["trung tam bao hanh", "tinh"], answer: "Trung tâm bảo hành: tuỳ hãng. Bạn gửi tên sản phẩm/hãng để mình hướng dẫn nơi bảo hành phù hợp." },
    { keys: ["video khui hang"], answer: "Video khui hàng giúp xử lý nhanh khi thiếu/ lỗi. Nếu không có video, bạn vẫn gửi ảnh chi tiết, shop sẽ hỗ trợ theo trường hợp." },
    { keys: ["tra loi cham", "sang den chieu"], answer: "Xin lỗi bạn vì chậm phản hồi. Bạn gửi lại mã đơn hoặc vấn đề cụ thể, mình ưu tiên hỗ trợ ngay nhé." },
    { keys: ["linh kien", "thay the"], answer: "Linh kiện thay thế: tuỳ sản phẩm. Bạn gửi tên sản phẩm và linh kiện cần, mình kiểm tra khả năng cung cấp." },
    { keys: ["pin sac", "chai"], answer: "Pin sạc bị chai: bạn gửi mẫu pin/đồ chơi dùng pin để mình tư vấn loại pin/sạc thay thế phù hợp." },
    { keys: ["hop nat", "mop hop"], answer: "Hộp bị móp/nát: bạn chụp ảnh kiện hàng và bên trong. Shop sẽ hỗ trợ theo mức độ ảnh hưởng (đổi/giảm/đền bù) tuỳ trường hợp." },
    { keys: ["quy trinh gui tra", "gui tra"], answer: "Quy trình gửi trả: bạn gửi mã đơn + lý do, shop sẽ cung cấp địa chỉ nhận trả và hướng dẫn đóng gói/đơn vị gửi." },
    { keys: ["thai do shipper"], answer: "Khiếu nại shipper: bạn gửi mã đơn + thời gian giao + mô tả, shop sẽ phản hồi với đơn vị vận chuyển để xử lý." },
  ];
  for (const r of warrantyRules) {
    if (r.keys.some((k) => msg.includes(k))) return r.answer;
  }

  // Default
  return "Bạn muốn hỏi về: chất liệu & độ tuổi, tư vấn quà tặng, mã giảm giá, đặt hàng/thanh toán, vận chuyển hay bảo hành? (Bạn gửi thêm độ tuổi bé hoặc tên sản phẩm để mình trả lời chính xác hơn.)";
}

function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  addChatMessage("user", message);
  input.value = "";
  setTimeout(() => {
    const res = getChatbotResponse(message);
    if (typeof res === "string") addChatMessage("bot", res, { html: false });
    else addChatMessage("bot", res.text, { html: !!res.html });
  }, 300);
}

function handleChatKeypress(event) {
  if (event.key === "Enter") sendChatMessage();
}

function sendQuickMessage(message) {
  addChatMessage("user", message);
  setTimeout(() => {
    const res = getChatbotResponse(message);
    if (typeof res === "string") addChatMessage("bot", res, { html: false });
    else addChatMessage("bot", res.text, { html: !!res.html });
  }, 300);
}

function requestAgent() {
  addChatMessage("user", "Tôi muốn nói chuyện với agent");
  setTimeout(() => {
    addChatMessage("bot", "👤 Đang kết nối bạn với agent hỗ trợ...");
    setTimeout(() => {
      addChatMessage("bot", "Agent sẽ sớm trả lời bạn. Cảm ơn đã chờ!");
      addNotification("✅ Agent sẽ liên hệ bạn trong ít phút.");
    }, 800);
  }, 300);
}

function updateUI() {
  document.getElementById("cart-count").textContent = String(cart.reduce((sum, i) => sum + Number(i.quantity || 0), 0));
  document.getElementById("user-wishlist-count").textContent = String(wishlist.length);
  if (currentPage === "cart") displayCart();
  if (currentPage === "home") displayProducts(allProducts.slice(0, 8));
  if (currentPage === "wishlist") displayWishlist();
}

function tickCountdown() {
  const el = document.getElementById("countdown");
  if (!el) return;
  const left = Math.max(0, flashSaleEndMs - Date.now());
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  el.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function seedData() {
  allProducts = [
    { backendId: "p1", name: "Bộ Xếp Hình Lego Classic", price: 299000, category: "Xếp Hình", image: "🧱", stock: 50, rating: 4.8, reviews: 125, description: "Bộ xếp hình Lego cơ bản với 500 mảnh đa sắc màu", isSale: false, discount: 0, isFlashSale: true, tags: "bán chạy" },
    { backendId: "p2", name: "Xe Điều Khiển Tốc Độ", price: 189000, category: "Xe", image: "🏎️", stock: 30, rating: 4.6, reviews: 98, description: "Xe điều khiển từ xa 4 bánh, tốc độ tối đa 50km/h", isSale: true, discount: 15, isFlashSale: false, tags: "phổ biến" },
    { backendId: "p3", name: "Búp Bê Công Chúa", price: 249000, category: "Búp Bê", image: "👸", stock: 25, rating: 4.9, reviews: 156, description: "Búp bê công chúa với đầy đủ trang phục và phụ kiện", isSale: false, discount: 0, isFlashSale: false, tags: "bán chạy" },
    { backendId: "p4", name: "Bộ Thí Nghiệm Khoa Học", price: 359000, category: "Khoa Học", image: "🔬", stock: 20, rating: 4.7, reviews: 87, description: "Bộ thí nghiệm khoa học với 50 bài tập thú vị", isSale: false, discount: 0, isFlashSale: false, tags: "" },
    { backendId: "p5", name: "Xếp Hình 3D Toà Nhà", price: 189000, category: "Xếp Hình", image: "🏢", stock: 40, rating: 4.5, reviews: 64, description: "Xếp hình 3D tòa nhà nổi tiếng thế giới", isSale: true, discount: 10, isFlashSale: false, tags: "phổ biến" },
    { backendId: "p6", name: "Drone Tí Hon", price: 199000, category: "Xe", image: "🚁", stock: 15, rating: 4.4, reviews: 76, description: "Drone mini điều khiển từ xa có camera HD", isSale: true, discount: 20, isFlashSale: true, tags: "bán chạy" },
  ];

  // normalize seed ids for legacy code
  allProducts = allProducts.map((p) => ({ ...p, __backendId: p.__backendId || p.backendId }));

  allCoupons = [
    { code: "WELCOME10", discount: 10, maxUse: 100, used: 0 },
    { code: "SUMMER20", discount: 20, maxUse: 50, used: 0 },
    { code: "FLASH50", discount: 50, maxUse: 10, used: 0 },
  ];
}

function applyConfig() {
  document.getElementById("site-name").textContent = defaultConfig.site_name;
  document.getElementById("hero-title").textContent = defaultConfig.hero_title;
  document.getElementById("hero-subtitle").textContent = defaultConfig.hero_subtitle;
}

function loadSavedUser() {
  const saved = localStorage.getItem("currentUser");
  if (!saved) return;
  try {
    currentUser = JSON.parse(saved);
  } catch {
    currentUser = null;
  }
}

async function init() {
  applyConfig();
  try {
    await loadInitialData();
  } catch {
    seedData();
  }
  try {
    await refreshBanners();
  } catch {}
  loadSavedUser();
  updateAuthUI();
  showPage("home");
  tickCountdown();
  setInterval(tickCountdown, 1000);
}

// --- Extensions: persistence-backed config + extra admin tabs (Content/Reports) ---

const fixedDefaultConfig = {
  site_name: "ToyLand",
  hero_title: "Thế Giới Đồ Chơi Kỳ Diệu",
  hero_subtitle: "Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em",
  site_email: "contact@toystore.com",
  site_phone: "1900-1234",
  site_address: "123 Phố Huế, Hoàn Kiếm, Hà Nội",
  footer_text: "© 2026 ToyLand - Cửa hàng đồ chơi uy tín hàng đầu",
  categories: ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học", "Khác"],
};

let siteConfig = { ...fixedDefaultConfig };

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

function displayWishlist() {
  const container = document.getElementById("wishlist-items");
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = '<p class="col-span-full text-center text-gray-500">Vui lòng đăng nhập để xem danh sách yêu thích</p>';
    return;
  }
  if (wishlist.length === 0) {
    container.innerHTML = '<p class="col-span-full text-center text-gray-500">Danh sách yêu thích trống</p>';
    return;
  }
  container.innerHTML = wishlist
    .map(
      (p) => `
      <div class="toy-card bg-white rounded-lg shadow overflow-hidden">
        <div class="h-56 bg-gradient-to-br from-purple-100 to-pink-100 text-center flex items-center justify-center overflow-hidden">
          ${renderProductImage(p, { size: "md", fit: "cover" })}
        </div>
        <div class="p-4">
          <h3 class="font-bold text-lg mb-2">${p.name}</h3>
          <p class="text-purple-600 font-bold text-lg mb-4">${money(discountedPrice(p))}</p>
          <div class="flex gap-2">
            <button onclick="addToCart('${p.__backendId}')" class="flex-1 py-2 btn-primary text-white rounded text-sm">Thêm Vào Giỏ</button>
            <button onclick="removeFromWishlist('${p.__backendId}')" class="py-2 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition">Xóa</button>
          </div>
        </div>
      </div>`
    )
    .join("");
}

function viewProduct(id) {
  const product = allProducts.find((p) => p.__backendId === id);
  if (!product) return;

  const detail = document.getElementById("product-detail-content");
  const priceNow = discountedPrice(product);
  detail.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div class="p-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg text-center flex items-center justify-center relative">
        ${renderProductImage(product, { size: "xl" })}
        ${product.isSale ? `<span class="absolute top-4 right-4 badge-sale text-white px-3 py-2 rounded font-bold">-${product.discount}%</span>` : ""}
      </div>
      <div>
        <h1 class="text-3xl font-bold mb-4">${product.name}</h1>
        <div class="mb-4">
          <span class="star-rating text-2xl">★ ${Number(product.rating || 0).toFixed(1)}</span>
          <span class="text-gray-500 ml-2">(${Number(product.reviews || 0)} đánh giá)</span>
        </div>
        <div class="mb-6">
          ${product.discount ? `<p class="text-gray-400 line-through text-lg">${money(product.price)}</p>` : ""}
          <p class="text-4xl font-bold text-purple-600">${money(priceNow)}</p>
        </div>
        <p class="text-gray-600 mb-6">${product.description || ""}</p>
        <p class="text-gray-700 mb-6">Còn hàng: <span class="font-bold text-green-600">${Number(product.stock || 0)}</span></p>
        <div class="mb-6">
          <label class="block text-sm font-medium mb-2">Số Lượng</label>
          <input type="number" id="detail-quantity" value="1" min="1" max="${Number(product.stock || 0)}" class="px-4 py-2 border rounded-lg w-20 focus:outline-none focus:ring-2 focus:ring-purple-500">
        </div>
        <div class="flex gap-2 mb-4">
          <button onclick="addToCartFromDetail('${id}')" class="flex-1 py-3 btn-primary text-white rounded-lg font-bold">🛒 Thêm Vào Giỏ</button>
          <button onclick="addToWishlist('${id}')" class="py-3 px-6 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200 transition">❤️ Yêu Thích</button>
        </div>
        <button onclick="showPage('products')" class="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-bold">Tiếp Tục Mua</button>
      </div>
    </div>`;
  showPage("product-detail");
}

function applyConfig() {
  const nameEl = document.getElementById("site-name");
  const heroTitleEl = document.getElementById("hero-title");
  const heroSubtitleEl = document.getElementById("hero-subtitle");
  if (nameEl) nameEl.textContent = siteConfig.site_name || fixedDefaultConfig.site_name;
  if (heroTitleEl) heroTitleEl.textContent = siteConfig.hero_title || fixedDefaultConfig.hero_title;
  if (heroSubtitleEl) heroSubtitleEl.textContent = siteConfig.hero_subtitle || fixedDefaultConfig.hero_subtitle;
}

async function refreshConfigSafe() {
  try {
    const cfg = (await apiJson("/api/config")) || {};
    siteConfig = { ...fixedDefaultConfig, ...(cfg || {}) };
  } catch {
    siteConfig = { ...fixedDefaultConfig };
  }
}

function populateContentForm() {
  const bt = document.getElementById("banner-title");
  const bd = document.getElementById("banner-desc");
  const sn = document.getElementById("site-info-name");
  const se = document.getElementById("site-info-email");
  const sp = document.getElementById("site-info-phone");
  const sa = document.getElementById("site-info-address");
  const sf = document.getElementById("site-info-footer");
  if (bt) bt.value = siteConfig.hero_title || "";
  if (bd) bd.value = siteConfig.hero_subtitle || "";
  if (sn) sn.value = siteConfig.site_name || "";
  if (se) se.value = siteConfig.site_email || "";
  if (sp) sp.value = siteConfig.site_phone || "";
  if (sa) sa.value = siteConfig.site_address || "";
  if (sf) sf.value = siteConfig.footer_text || "";
}

async function saveConfig(updates) {
  siteConfig = { ...siteConfig, ...(updates || {}) };
  const saved = await apiJson("/api/config", { method: "PUT", body: siteConfig });
  siteConfig = { ...fixedDefaultConfig, ...(saved || {}) };
  applyConfig();
  populateContentForm();
}

function saveBannerContent() {
  (async () => {
    try {
      await saveConfig({
        hero_title: (document.getElementById("banner-title")?.value || "").trim(),
        hero_subtitle: (document.getElementById("banner-desc")?.value || "").trim(),
      });
      addNotification("✅ Cập nhật banner thành công!");
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể lưu banner"}`);
    }
  })();
}

function saveSiteInfo() {
  (async () => {
    try {
      await saveConfig({
        site_name: (document.getElementById("site-info-name")?.value || "").trim(),
        site_email: (document.getElementById("site-info-email")?.value || "").trim(),
        site_phone: (document.getElementById("site-info-phone")?.value || "").trim(),
        site_address: (document.getElementById("site-info-address")?.value || "").trim(),
        footer_text: (document.getElementById("site-info-footer")?.value || "").trim(),
      });
      addNotification("✅ Lưu thông tin website thành công!");
    } catch (err) {
      addNotification(`❌ ${(err && err.message) || "Không thể lưu thông tin website"}`);
    }
  })();
}

function parseOrderDate(d) {
  const m = String(d || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const dt = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function normalizeStatus(s) {
  return String(s || "").trim().toLowerCase();
}

function updateAdminReports() {
  (async () => {
    try {
      await refreshOrders();
      await refreshProducts();
    } catch {
      // ignore
    }

    const today = new Date();
    const isSameDay = (a, b) =>
      a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    const totalRevenue = allOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const todayRevenue = allOrders
      .filter((o) => isSameDay(parseOrderDate(o.date), today))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const monthRevenue = allOrders
      .filter((o) => {
        const dt = parseOrderDate(o.date);
        return dt && dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth();
      })
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const avgRevenue = allOrders.length ? Math.floor(totalRevenue / allOrders.length) : 0;

    const rt = document.getElementById("revenue-today");
    const rm = document.getElementById("revenue-month");
    const ry = document.getElementById("revenue-year");
    const ra = document.getElementById("revenue-avg");
    if (rt) rt.textContent = money(todayRevenue);
    if (rm) rm.textContent = money(monthRevenue);
    if (ry) ry.textContent = money(totalRevenue);
    if (ra) ra.textContent = money(avgRevenue);

    const totalOrders = allOrders.length;
    const processing = allOrders.filter((o) => normalizeStatus(o.status) === "đang xử lý").length;
    const shipped = allOrders.filter((o) => normalizeStatus(o.status) === "đã giao").length;
    const cancelled = allOrders.filter((o) => normalizeStatus(o.status) === "hủy").length;
    const completion = totalOrders ? Math.floor((shipped / totalOrders) * 100) : 0;

    const ot = document.getElementById("order-total");
    const op = document.getElementById("order-processing");
    const os = document.getElementById("order-shipped");
    const oc = document.getElementById("order-cancelled");
    const ocomp = document.getElementById("order-completion");
    if (ot) ot.textContent = String(totalOrders);
    if (op) op.textContent = String(processing);
    if (os) os.textContent = String(shipped);
    if (oc) oc.textContent = String(cancelled);
    if (ocomp) ocomp.textContent = `${completion}%`;

    const topSelling = [...allProducts]
      .sort((a, b) => Number(b.reviews || 0) * Number(b.rating || 0) - Number(a.reviews || 0) * Number(a.rating || 0))
      .slice(0, 10);
    const topEl = document.getElementById("top-selling-products");
    if (topEl) {
      topEl.innerHTML = `
        <table class="w-full text-sm">
          <tr class="bg-gray-100 border-b">
            <th class="px-4 py-2 text-left">Sản Phẩm</th>
            <th class="px-4 py-2 text-left">Giá</th>
            <th class="px-4 py-2 text-left">Đánh Giá</th>
            <th class="px-4 py-2 text-left">Nhận Xét</th>
            <th class="px-4 py-2 text-left">Tồn Kho</th>
          </tr>
          ${topSelling
            .map(
              (p) => `
            <tr class="border-b hover:bg-gray-50">
              <td class="px-4 py-2">
                <div class="flex items-center gap-3">
                  ${renderProductThumb(p)}
                  <span class="font-medium">${escapeHtml(getProductDisplayName(p))}</span>
                </div>
              </td>
              <td class="px-4 py-2">${money(discountedPrice(p))}</td>
              <td class="px-4 py-2">⭐ ${Number(p.rating || 0).toFixed(1)}</td>
              <td class="px-4 py-2">${Number(p.reviews || 0)}</td>
              <td class="px-4 py-2 ${Number(p.stock || 0) === 0 ? "text-red-600 font-bold" : "text-green-600"}">${Number(p.stock || 0)}</td>
            </tr>`
            )
            .join("")}
        </table>`;
    }

    const outStock = allProducts.filter((p) => Number(p.stock || 0) === 0);
    const lowStock = allProducts.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 10);
    const normalStock = allProducts.filter((p) => Number(p.stock || 0) > 10 && Number(p.stock || 0) <= 50);
    const excessStock = allProducts.filter((p) => Number(p.stock || 0) > 50);

    const io = document.getElementById("inventory-out-stock");
    const il = document.getElementById("inventory-low-stock");
    const inn = document.getElementById("inventory-normal-stock");
    const ie = document.getElementById("inventory-excess-stock");
    if (io) io.textContent = String(outStock.length);
    if (il) il.textContent = String(lowStock.length);
    if (inn) inn.textContent = String(normalStock.length);
    if (ie) ie.textContent = String(excessStock.length);

    const invEl = document.getElementById("inventory-list");
    if (invEl) {
      invEl.innerHTML = `
        <table class="w-full text-sm">
          <tr class="bg-gray-100 border-b">
            <th class="px-4 py-2 text-left">Sản Phẩm</th>
            <th class="px-4 py-2 text-left">Tồn Kho</th>
            <th class="px-4 py-2 text-left">Trạng Thái</th>
          </tr>
          ${allProducts
            .map((p) => {
              const stock = Number(p.stock || 0);
              let status = "Dôi dư";
              let color = "text-green-600";
              if (stock === 0) {
                status = "Hết";
                color = "text-red-600";
              } else if (stock <= 10) {
                status = "Sắp hết";
                color = "text-orange-600";
              } else if (stock <= 50) {
                status = "Vừa phải";
                color = "text-yellow-600";
              }
              return `
              <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-2">
                  <div class="flex items-center gap-3">
                    ${renderProductThumb(p)}
                    <span class="font-medium">${escapeHtml(getProductDisplayName(p))}</span>
                  </div>
                </td>
                <td class="px-4 py-2 font-bold">${stock}</td>
                <td class="px-4 py-2 font-bold ${color}">${status}</td>
              </tr>`;
            })
            .join("")}
        </table>`;
    }

    // Charts (Chart.js) - only in Reports tab
    if (typeof window !== "undefined" && window.Chart) {
      const chartStore = (window.__adminReportCharts ||= {});
      const destroyChart = (key) => {
        const ch = chartStore[key];
        if (ch && typeof ch.destroy === "function") ch.destroy();
        delete chartStore[key];
      };

      const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true } },
        },
      };

      // 1) Line chart - revenue by day in current month
      destroyChart("revenueLine");
      const revenueCanvas = document.getElementById("chart-revenue-line");
      if (revenueCanvas) {
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
        const revenueByDay = Array.from({ length: daysInMonth }, () => 0);
        for (const o of allOrders) {
          const dt = parseOrderDate(o.date);
          if (!dt) continue;
          if (dt.getFullYear() !== today.getFullYear() || dt.getMonth() !== today.getMonth()) continue;
          const idx = dt.getDate() - 1;
          revenueByDay[idx] += Number(o.total || 0);
        }

        chartStore.revenueLine = new window.Chart(revenueCanvas.getContext("2d"), {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Doanh thu (đ)",
                data: revenueByDay,
                borderColor: "#a855f7",
                backgroundColor: "rgba(168,85,247,0.18)",
                pointBackgroundColor: "#ec4899",
                pointRadius: 2,
                tension: 0.35,
                fill: true,
              },
            ],
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              title: { display: true, text: "Doanh thu theo ngày trong tháng hiện tại" },
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => money(ctx.parsed.y),
                },
              },
            },
            scales: {
              y: { ticks: { callback: (v) => (Number(v) ? `${Number(v).toLocaleString("vi-VN")}đ` : "0đ") } },
              x: { title: { display: true, text: "Ngày" } },
            },
          },
        });
      }

      // 2) Pie chart - order status ratio
      destroyChart("orderStatusPie");
      const statusCanvas = document.getElementById("chart-order-status-pie");
      if (statusCanvas) {
        chartStore.orderStatusPie = new window.Chart(statusCanvas.getContext("2d"), {
          type: "pie",
          data: {
            labels: ["Đang xử lý", "Đã giao", "Hủy"],
            datasets: [
              {
                data: [processing, shipped, cancelled],
                backgroundColor: ["#a855f7", "#ec4899", "#ef4444"],
                borderColor: "#ffffff",
                borderWidth: 2,
              },
            ],
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              title: { display: true, text: "Tỉ lệ đơn hàng theo trạng thái" },
            },
          },
        });
      }

      // 3) Bar chart - Top 5 products (reviews * rating)
      destroyChart("topProductsBar");
      const topCanvas = document.getElementById("chart-top-products-bar");
      if (topCanvas) {
        const top5 = [...allProducts]
          .sort((a, b) => Number(b.reviews || 0) * Number(b.rating || 0) - Number(a.reviews || 0) * Number(a.rating || 0))
          .slice(0, 5);
        const labels = top5.map((p) => {
          const name = String(getProductDisplayName(p) || "").trim();
          return name.length > 22 ? name.slice(0, 22) + "…" : name;
        });
        const scores = top5.map((p) => Number(p.reviews || 0) * Number(p.rating || 0));

        chartStore.topProductsBar = new window.Chart(topCanvas.getContext("2d"), {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Điểm bán chạy (reviews × rating)",
                data: scores,
                backgroundColor: "rgba(236,72,153,0.55)",
                borderColor: "#ec4899",
                borderWidth: 2,
                borderRadius: 8,
              },
            ],
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              title: { display: true, text: "Top 5 sản phẩm bán chạy nhất" },
              legend: { display: false },
            },
            scales: {
              x: { ticks: { maxRotation: 0, minRotation: 0 }, grid: { display: false } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      // 4) Doughnut chart - inventory ratio
      destroyChart("stockDoughnut");
      const stockCanvas = document.getElementById("chart-stock-doughnut");
      if (stockCanvas) {
        chartStore.stockDoughnut = new window.Chart(stockCanvas.getContext("2d"), {
          type: "doughnut",
          data: {
            labels: ["Hết hàng", "Sắp hết", "Vừa phải", "Dôi dư"],
            datasets: [
              {
                data: [outStock.length, lowStock.length, normalStock.length, excessStock.length],
                backgroundColor: ["#ef4444", "#f59e0b", "#a855f7", "#22c55e"],
                borderColor: "#ffffff",
                borderWidth: 2,
              },
            ],
          },
          options: {
            ...baseOptions,
            plugins: {
              ...baseOptions.plugins,
              title: { display: true, text: "Tỉ lệ tồn kho" },
            },
            cutout: "62%",
          },
        });
      }
    }
  })();
}

function showAdminTab(tab) {
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.add("hidden"));
  const el = document.getElementById("admin-" + tab + "-tab");
  if (el) el.classList.remove("hidden");

  if (tab === "dashboard") updateAdminDashboard();
  else if (tab === "products") updateAdminProducts();
  else if (tab === "categories") updateAdminCategories();
  else if (tab === "orders") updateAdminOrders();
  else if (tab === "users") updateAdminUsers();
  else if (tab === "reviews") updateAdminReviews();
  else if (tab === "promotions") updateAdminPromotions();
  else if (tab === "content") {
    populateContentForm();
  } else if (tab === "reports") {
    updateAdminReports();
  }
}

function updateAdminOrders() {
  (async () => {
    try {
      await refreshOrders();
    } catch {
      // ignore
    }
    const list = document.getElementById("admin-orders-list");
    if (!list) return;
    list.innerHTML = `
      <table class="w-full text-sm">
        <tr class="bg-gray-100 border-b sticky top-0">
          <th class="px-4 py-2 text-left">Mã Đơn</th>
          <th class="px-4 py-2 text-left">Khách</th>
          <th class="px-4 py-2 text-left">Ngày</th>
          <th class="px-4 py-2 text-left">Tổng</th>
          <th class="px-4 py-2 text-left">Trạng Thái</th>
          <th class="px-4 py-2 text-center">Hành Động</th>
        </tr>
        ${allOrders
          .map(
            (order, idx) => `
          <tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-2">${order.id}</td>
            <td class="px-4 py-2">${order.user}</td>
            <td class="px-4 py-2">${order.date}</td>
            <td class="px-4 py-2">${money(order.total)}</td>
            <td class="px-4 py-2">
              <select onchange="updateOrderStatus(${idx}, this.value)" class="px-2 py-1 border rounded text-xs">
                <option value="Đang xử lý" ${order.status === "Đang xử lý" ? "selected" : ""}>Đang xử lý</option>
                <option value="Đã giao" ${order.status === "Đã giao" ? "selected" : ""}>Đã giao</option>
                <option value="Hủy" ${order.status === "Hủy" ? "selected" : ""}>Hủy</option>
              </select>
            </td>
            <td class="px-4 py-2 text-center">
              <button onclick="viewOrderDetails(${idx})" class="text-blue-600 hover:text-blue-800 font-bold text-xs">Xem</button>
            </td>
          </tr>`
          )
          .join("")}
      </table>`;
  })();
}

function updateOrderStatus(idx, status) {
  allOrders[idx].status = status;
  addNotification(`✅ Cập nhật trạng thái đơn hàng thành: ${status}`);
  updateAdminOrders();
}

function syncCategoryOptionsFromProducts() {
  const productCats = (allProducts || []).map((p) => String(p.category || "").trim()).filter(Boolean);
  const cfgCats = Array.isArray(siteConfig.categories) ? siteConfig.categories.map((c) => String(c || "").trim()).filter(Boolean) : [];
  const set = new Set([...cfgCats, ...productCats, "Khác"].filter(Boolean));
  const cats = Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  if (cats.length) categories = cats;

  const filter = document.getElementById("category-filter");
  if (filter) {
    const current = filter.value || "";
    filter.innerHTML = `<option value="">Tất Cả</option>${cats.map((c) => `<option value="${c}">${c}</option>`).join("")}`;
    filter.value = current;
  }

  const adminSel = document.getElementById("admin-product-category");
  if (adminSel) {
    const current = adminSel.value || "";
    adminSel.innerHTML = cats.map((c) => `<option value="${c}">${c}</option>`).join("");
    if (current) adminSel.value = current;
  }
}

async function init() {
  categories = Array.isArray(fixedDefaultConfig.categories) ? [...fixedDefaultConfig.categories] : ["Khác"];
  await refreshConfigSafe();
  applyConfig();

  try {
    await loadInitialData();
  } catch {
    seedData();
  }
  await refreshBanners();
  syncCategoryOptionsFromProducts();
  loadChatHistory();

  loadSavedUser();
  updateAuthUI();
  showPage("home");
  tickCountdown();
  setInterval(tickCountdown, 1000);
}

init();

