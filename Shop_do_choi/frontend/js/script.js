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

let flashSaleEndMs = Date.now() + 60 * 60 * 1000;

const defaultConfig = {
  site_name: "ToyLand Pro",
  hero_title: "Thế Giới Đồ Chơi Kỳ Diệu",
  hero_subtitle: "Khám phá hàng ngàn sản phẩm đồ chơi chất lượng cao cho trẻ em",
};

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

function renderProductImage(p, { size = "md" } = {}) {
  const src = String((p && p.image) || "").trim();
  const name = String((p && p.name) || "Sản phẩm");
  const isUrl = src.startsWith("/media/") || /\.(png|jpe?g|webp)$/i.test(src);

  if (isUrl) {
    const h = size === "lg" ? "h-64" : size === "xl" ? "h-80" : "h-40";
    return `<img src="${src}" alt="${name}" class="w-full ${h} object-contain" loading="lazy" />`;
  }

  return `<div class="${size === "xl" ? "text-8xl" : size === "lg" ? "text-7xl" : "text-6xl"}">${src || "🎁"}</div>`;
}

function createProductCard(p) {
  const priceNow = discountedPrice(p);
  return `
    <div class="toy-card bg-white rounded-lg shadow overflow-hidden">
      <div class="p-4 bg-gradient-to-br from-purple-100 to-pink-100 text-center relative flex items-center justify-center">
        ${renderProductImage(p, { size: "md" })}
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
          <button onclick="viewProduct('${p.__backendId}')" class="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 transition">Chi Tiết</button>
          <button onclick="addToWishlist('${p.__backendId}')" class="py-2 px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition">❤️</button>
          <button onclick="addToCart('${p.__backendId}')" class="flex-1 py-2 btn-primary text-white rounded">Thêm</button>
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
    options.body = JSON.stringify(body);
  }
  const res = await fetch(path, options);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error((payload && payload.error) || res.statusText);
  if (payload && payload.ok === false) throw new Error(payload.error || "Request failed");
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

async function refreshProducts() {
  allProducts = (await apiJson("/api/products")) || [];
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
  const product = allProducts.find((p) => p.__backendId === id);
  if (!product) return;
  if (!wishlist.some((w) => w.__backendId === id)) {
    wishlist.push(product);
    addNotification(`${product.name} đã được thêm vào danh sách yêu thích!`);
  } else {
    addNotification("Sản phẩm này đã có trong danh sách yêu thích.");
  }
  updateUI();
}

function removeFromWishlist(id) {
  wishlist = wishlist.filter((w) => w.__backendId !== id);
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
  const product = allProducts.find((p) => p.__backendId === id);
  if (!product) return;
  const existing = cart.find((i) => i.__backendId === id);
  if (existing) existing.quantity++;
  else cart.push({ ...product, quantity: 1 });
  updateUI();
}

function addToCartFromDetail(id) {
  const qty = parseInt(document.getElementById("detail-quantity").value || "1", 10) || 1;
  const product = allProducts.find((p) => p.__backendId === id);
  if (!product) return;
  const existing = cart.find((i) => i.__backendId === id);
  if (existing) existing.quantity += qty;
  else cart.push({ ...product, quantity: qty });
  addNotification(`${product.name} x${qty} đã được thêm vào giỏ hàng`);
  updateUI();
  showPage("cart");
}

function updateCartItem(id, quantity) {
  const item = cart.find((i) => i.__backendId === id);
  if (!item) return;
  item.quantity = parseInt(quantity, 10);
  if (item.quantity <= 0) cart = cart.filter((i) => i.__backendId !== id);
  updateUI();
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.__backendId !== id);
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
          <td class="py-4"><span class="text-3xl mr-3">${item.image || "🎁"}</span>${item.name}</td>
          <td class="text-center">${money(pNow)}</td>
          <td class="text-center">
            <input type="number" value="${item.quantity}" min="1" onchange="updateCartItem('${item.__backendId}', this.value)" class="w-16 px-2 py-1 border rounded text-center">
          </td>
          <td class="text-center font-bold">${money(pNow * item.quantity)}</td>
          <td class="text-center"><button onclick="removeFromCart('${item.__backendId}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button></td>
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
      const order = await apiJson("/api/orders", {
        method: "POST",
        body: {
          user: currentUser.name,
          items: JSON.parse(JSON.stringify(cart)),
          paymentMethod,
          discount,
        },
      });
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

function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const name = email.split("@")[0] || "User";
  currentUser = { email, name, phone: "", address: "" };
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  updateAuthUI();
  showPage(email === "admin@toystore.com" ? "admin" : "home");
}

function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById("register-email").value.trim();
  const name = document.getElementById("register-name").value.trim();
  currentUser = { email, name, phone: "", address: "" };
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  allUsers.push(currentUser);
  updateAuthUI();
  addNotification(`Chào mừng ${name}! Đăng ký thành công.`);
  showPage("home");
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

function adminDeleteProduct(id) {
  (async () => {
    try {
      await apiJson(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshProducts();
      wishlist = wishlist.filter((w) => w.__backendId !== id);
      cart = cart.filter((c) => c.__backendId !== id);
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
            `<tr class="border-b hover:bg-gray-50"><td class="px-4 py-2">${p.name}</td><td class="px-4 py-2">${money(discountedPrice(p))}</td><td class="px-4 py-2">${p.category}</td><td class="px-4 py-2">${Number(p.stock || 0)}</td><td class="px-4 py-2">⭐ ${Number(p.rating || 0).toFixed(1)}</td><td class="px-4 py-2 text-center"><button onclick="adminDeleteProduct('${p.__backendId}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button></td></tr>`
        )
        .join("")}
    </table>`;
}

function adminAddCategory() {
  const name = document.getElementById("admin-category-name").value.trim();
  if (!name) return;
  if (!categories.includes(name)) categories.push(name);
  document.getElementById("admin-category-name").value = "";
  addNotification("✅ Thêm danh mục thành công!");
  updateAdminCategories();
}

function updateAdminCategories() {
  const list = document.getElementById("admin-categories-list");
  list.innerHTML = `
    <table class="w-full">
      <tr class="bg-gray-100 border-b"><th class="px-4 py-2 text-left">Danh Mục</th><th class="px-4 py-2 text-center">Sản Phẩm</th><th class="px-4 py-2 text-center">Hành Động</th></tr>
      ${categories
        .map((cat) => {
          const cnt = allProducts.filter((p) => p.category === cat).length;
          return `<tr class="border-b hover:bg-gray-50"><td class="px-4 py-2">${cat}</td><td class="px-4 py-2 text-center">${cnt}</td><td class="px-4 py-2 text-center"><button onclick="deleteCategory('${cat}')" class="text-red-600 hover:text-red-800 font-bold">Xóa</button></td></tr>`;
        })
        .join("")}
    </table>`;
}

function deleteCategory(cat) {
  categories = categories.filter((c) => c !== cat);
  updateAdminCategories();
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

function addChatMessage(sender, text) {
  const messagesDiv = document.getElementById("chat-messages");
  const messageDiv = document.createElement("div");
  messageDiv.className = "flex gap-3 " + (sender === "user" ? "justify-end" : "");
  messageDiv.innerHTML =
    sender === "user"
      ? `<div class="bg-purple-600 text-white rounded-lg p-3 shadow-sm max-w-xs"><p class="text-sm">${text}</p></div>`
      : `<div class="text-2xl">🤖</div><div class="bg-white rounded-lg p-3 shadow-sm max-w-xs"><p class="text-sm text-gray-700">${text}</p></div>`;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function getChatbotResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes("tìm") || msg.includes("sản phẩm")) return "Bạn muốn tìm loại đồ chơi nào? (Xếp Hình, Xe, Búp Bê, Khoa Học)";
  if (msg.includes("đơn hàng") || msg.includes("order")) return currentUser ? 'Bạn có thể xem đơn hàng tại mục "Đơn Hàng".' : "Vui lòng đăng nhập để xem đơn hàng của bạn.";
  if (msg.includes("khuyến mãi") || msg.includes("giảm giá") || msg.includes("sale") || msg.includes("flash")) return `Hiện có ${allCoupons.length} mã giảm giá hoạt động!`;
  if (msg.includes("giao hàng") || msg.includes("ship")) return "Chúng tôi giao hàng toàn quốc! Phí giao hàng là 30.000đ.";
  return "Bạn muốn tìm sản phẩm, theo dõi đơn hàng, hỏi về khuyến mãi, hay gọi agent?";
}

function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  addChatMessage("user", message);
  input.value = "";
  setTimeout(() => addChatMessage("bot", getChatbotResponse(message)), 300);
}

function handleChatKeypress(event) {
  if (event.key === "Enter") sendChatMessage();
}

function sendQuickMessage(message) {
  addChatMessage("user", message);
  setTimeout(() => addChatMessage("bot", getChatbotResponse(message)), 300);
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
    { __backendId: "p1", name: "Bộ Xếp Hình Lego Classic", price: 299000, category: "Xếp Hình", image: "🧱", stock: 50, rating: 4.8, reviews: 125, description: "Bộ xếp hình Lego cơ bản với 500 mảnh đa sắc màu", isSale: false, discount: 0, isFlashSale: true, tags: "bán chạy" },
    { __backendId: "p2", name: "Xe Điều Khiển Tốc Độ", price: 189000, category: "Xe", image: "🏎️", stock: 30, rating: 4.6, reviews: 98, description: "Xe điều khiển từ xa 4 bánh, tốc độ tối đa 50km/h", isSale: true, discount: 15, isFlashSale: false, tags: "phổ biến" },
    { __backendId: "p3", name: "Búp Bê Công Chúa", price: 249000, category: "Búp Bê", image: "👸", stock: 25, rating: 4.9, reviews: 156, description: "Búp bê công chúa với đầy đủ trang phục và phụ kiện", isSale: false, discount: 0, isFlashSale: false, tags: "bán chạy" },
    { __backendId: "p4", name: "Bộ Thí Nghiệm Khoa Học", price: 359000, category: "Khoa Học", image: "🔬", stock: 20, rating: 4.7, reviews: 87, description: "Bộ thí nghiệm khoa học với 50 bài tập thú vị", isSale: false, discount: 0, isFlashSale: false, tags: "" },
    { __backendId: "p5", name: "Xếp Hình 3D Toà Nhà", price: 189000, category: "Xếp Hình", image: "🏢", stock: 40, rating: 4.5, reviews: 64, description: "Xếp hình 3D tòa nhà nổi tiếng thế giới", isSale: true, discount: 10, isFlashSale: false, tags: "phổ biến" },
    { __backendId: "p6", name: "Drone Tí Hon", price: 199000, category: "Xe", image: "🚁", stock: 15, rating: 4.4, reviews: 76, description: "Drone mini điều khiển từ xa có camera HD", isSale: true, discount: 20, isFlashSale: true, tags: "bán chạy" },
  ];

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
        <div class="p-4 bg-gradient-to-br from-purple-100 to-pink-100 text-center flex items-center justify-center">
          ${renderProductImage(p, { size: "md" })}
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
              <td class="px-4 py-2">${p.image || "🎁"} ${p.name}</td>
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
                <td class="px-4 py-2">${p.image || "🎁"} ${p.name}</td>
                <td class="px-4 py-2 font-bold">${stock}</td>
                <td class="px-4 py-2 font-bold ${color}">${status}</td>
              </tr>`;
            })
            .join("")}
        </table>`;
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
  const set = new Set((allProducts || []).map((p) => String(p.category || "").trim()).filter(Boolean));
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
  categories = ["Xếp Hình", "Xe", "Búp Bê", "Khoa Học"];
  await refreshConfigSafe();
  applyConfig();

  try {
    await loadInitialData();
  } catch {
    seedData();
  }
  syncCategoryOptionsFromProducts();

  loadSavedUser();
  updateAuthUI();
  showPage("home");
  tickCountdown();
  setInterval(tickCountdown, 1000);
}

init();

