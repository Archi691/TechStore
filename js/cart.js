import { db, doc, getDoc, setDoc } from "./firebase.js";
import { formatPrice } from "./products.js";

const CART_STORAGE_KEY = "techshop_cart";
let cartItems = [];
let currentUserId = null;

/**
 * Initialize Cart from LocalStorage or Firestore
 */
export async function initCart(user = null) {
  currentUserId = user ? user.uid : null;

  if (user) {
    // Sync with Firestore user cart
    try {
      const cartDocRef = doc(db, "carts", user.uid);
      const cartSnap = await getDoc(cartDocRef);
      if (cartSnap.exists()) {
        const firestoreCart = cartSnap.data().items || [];
        // Merge local guest items if any existed before login
        const localCart = getLocalCart();
        cartItems = mergeCarts(firestoreCart, localCart);
        saveCartToFirestore();
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        cartItems = getLocalCart();
        if (cartItems.length > 0) {
          saveCartToFirestore();
        }
      }
    } catch (err) {
      console.warn("Ошибка синхронизации корзины с Firestore:", err);
      cartItems = getLocalCart();
    }
  } else {
    cartItems = getLocalCart();
  }

  renderCartUI();
}

/**
 * Get Cart items from LocalStorage
 */
function getLocalCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Persist Cart state (LocalStorage or Firestore)
 */
function persistCart() {
  if (currentUserId) {
    saveCartToFirestore();
  } else {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }
  renderCartUI();
}

/**
 * Save active cart array to Firestore
 */
async function saveCartToFirestore() {
  if (!currentUserId) return;
  try {
    await setDoc(doc(db, "carts", currentUserId), {
      items: cartItems,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("Firestore cart sync error:", e);
  }
}

/**
 * Merge Firestore & LocalStorage items cleanly
 */
function mergeCarts(c1, c2) {
  const map = new Map();
  [...c1, ...c2].forEach(item => {
    if (map.has(item.id)) {
      const existing = map.get(item.id);
      map.set(item.id, { ...existing, quantity: Math.max(existing.quantity, item.quantity) });
    } else {
      map.set(item.id, { ...item });
    }
  });
  return Array.from(map.values());
}

/**
 * Add item to Cart
 */
export function addToCart(product, qty = 1) {
  if (!product || !product.id) return;

  const existingIndex = cartItems.findIndex(i => i.id === product.id);
  if (existingIndex > -1) {
    cartItems[existingIndex].quantity += qty;
  } else {
    cartItems.push({
      id: product.id,
      name: product.name,
      price: Number(product.price) || 0,
      image: product.image,
      category: product.category,
      quantity: qty
    });
  }

  persistCart();
  showToast(`"${product.name}" добавлен в корзину!`, "success");
}

/**
 * Remove item from Cart
 */
export function removeFromCart(productId) {
  cartItems = cartItems.filter(i => i.id !== productId);
  persistCart();
  showToast("Товар удален из корзины", "info");
}

/**
 * Update quantity of item in Cart
 */
export function updateCartQuantity(productId, newQty) {
  const quantity = parseInt(newQty);
  if (isNaN(quantity) || quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  const item = cartItems.find(i => i.id === productId);
  if (item) {
    item.quantity = quantity;
    persistCart();
  }
}

/**
 * Clear Cart
 */
export function clearCart() {
  cartItems = [];
  persistCart();
  showToast("Корзина очищена", "info");
}

/**
 * Get Total Cart Amount
 */
export function getCartTotal() {
  return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

/**
 * Get Total Items Count
 */
export function getCartItemCount() {
  return cartItems.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Get Active Cart Items Array
 */
export function getCartItems() {
  return [...cartItems];
}

/**
 * Render Cart Drawer UI
 */
export function renderCartUI() {
  const badge = document.getElementById("cart-item-count");
  const drawerBody = document.getElementById("cart-drawer-body");
  const qtyTotalEl = document.getElementById("cart-total-qty");
  const subtotalEl = document.getElementById("cart-subtotal-price");
  const totalEl = document.getElementById("cart-total-price");
  const checkoutFinalEl = document.getElementById("checkout-final-price");

  const totalCount = getCartItemCount();
  const totalPrice = getCartTotal();

  if (badge) badge.textContent = totalCount;
  if (qtyTotalEl) qtyTotalEl.textContent = totalCount;
  if (subtotalEl) subtotalEl.textContent = formatPrice(totalPrice);
  if (totalEl) totalEl.textContent = formatPrice(totalPrice);
  if (checkoutFinalEl) checkoutFinalEl.textContent = formatPrice(totalPrice);

  if (!drawerBody) return;

  if (cartItems.length === 0) {
    drawerBody.innerHTML = `
      <div class="empty-state" style="padding: 3rem 1rem;">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
        <h4 class="empty-title" style="font-size: 1.125rem;">В корзине пока ничего нет</h4>
        <p class="empty-desc" style="font-size: 0.875rem;">Исследуйте наш каталог и выберите лучшую технику по отличным ценам.</p>
        <button type="button" class="btn btn-primary btn-sm" id="cart-go-catalog-btn">Перейти в каталог</button>
      </div>
    `;
    const goBtn = document.getElementById("cart-go-catalog-btn");
    if (goBtn) {
      goBtn.addEventListener("click", () => {
        const overlay = document.getElementById("cart-drawer-overlay");
        if (overlay) overlay.classList.remove("active");
        location.hash = "#catalog";
      });
    }
    return;
  }

  const imageFallback = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80";

  drawerBody.innerHTML = cartItems.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <img src="${item.image || imageFallback}" alt="${item.name}" class="cart-item-img" onerror="this.src='${imageFallback}'">
      <div>
        <h4 class="cart-item-title">${item.name}</h4>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
        <div class="detail-qty-selector" style="margin-top: 0.5rem; margin-bottom: 0;">
          <button type="button" class="qty-btn cart-qty-minus" data-id="${item.id}">-</button>
          <input type="number" class="qty-input cart-qty-val" value="${item.quantity}" data-id="${item.id}" readonly>
          <button type="button" class="qty-btn cart-qty-plus" data-id="${item.id}">+</button>
        </div>
      </div>
      <button type="button" class="btn-icon cart-item-remove" data-id="${item.id}" aria-label="Удалить">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join("");

  // Event Listeners for Cart Item actions
  drawerBody.querySelectorAll(".cart-qty-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = cartItems.find(i => i.id === id);
      if (item) updateCartQuantity(id, item.quantity - 1);
    });
  });

  drawerBody.querySelectorAll(".cart-qty-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = cartItems.find(i => i.id === id);
      if (item) updateCartQuantity(id, item.quantity + 1);
    });
  });

  drawerBody.querySelectorAll(".cart-item-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      removeFromCart(btn.dataset.id);
    });
  });
}

/**
 * Simple Toast Notification Helper
 */
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></svg>`
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <div class="toast-content">
      <div class="toast-title">${type === 'success' ? 'Успешно' : type === 'error' ? 'Ошибка' : 'Информация'}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
