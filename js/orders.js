import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where 
} from "./firebase.js";
import { getCartItems, getCartTotal, clearCart, showToast } from "./cart.js";
import { getCurrentUser } from "./auth.js";
import { formatPrice } from "./products.js";

/**
 * Place a new Order and save to Firestore `orders` collection
 */
export async function placeOrder(shippingDetails) {
  const items = getCartItems();
  const totalPrice = getCartTotal();

  if (items.length === 0) {
    showToast("Ваша корзина пуста", "error");
    return { success: false, error: "Корзина пуста" };
  }

  const currentUser = getCurrentUser();

  const orderData = {
    userId: currentUser ? currentUser.uid : "guest",
    customerEmail: currentUser ? currentUser.email : "guest@techshop.ru",
    items: items,
    totalPrice: totalPrice,
    shippingDetails: {
      name: shippingDetails.name,
      phone: shippingDetails.phone,
      address: shippingDetails.address,
      paymentMethod: shippingDetails.paymentMethod || "card"
    },
    status: "Новый",
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, "orders"), orderData);
    const orderId = docRef.id;

    // Clear cart on successful checkout
    clearCart();

    // Close checkout modal
    const checkoutModal = document.getElementById("checkout-modal");
    if (checkoutModal) checkoutModal.classList.remove("active");

    // Close cart drawer if open
    const drawerOverlay = document.getElementById("cart-drawer-overlay");
    if (drawerOverlay) drawerOverlay.classList.remove("active");

    showToast(`Заказ №${orderId.slice(0, 8)} успешно оформлен!`, "success");

    // Refresh history if in account
    if (currentUser) {
      renderUserOrderHistory();
    }

    return { success: true, orderId };
  } catch (error) {
    console.error("Ошибка сохранения заказа в Firestore:", error);
    showToast("Не удалось оформить заказ. Попробуйте еще раз.", "error");
    return { success: false, error: error.message };
  }
}

/**
 * Fetch and Render Customer Order History in Profile Section
 */
export async function renderUserOrderHistory() {
  const container = document.getElementById("orders-history-container");
  if (!container) return;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    container.innerHTML = `<p class="empty-desc">Для просмотра истории заказов необходимо войти в аккаунт.</p>`;
    return;
  }

  container.innerHTML = `<p class="empty-desc">Загрузка заказов из Cloud Firestore...</p>`;

  try {
    const q = query(
      collection(db, "orders"),
      where("userId", "==", currentUser.uid)
    );
    const querySnapshot = await getDocs(q);

    const orders = [];
    querySnapshot.forEach(docSnap => {
      orders.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
          <h4 class="empty-title">У вас пока нет оформленных заказов</h4>
          <p class="empty-desc">После совершения первой покупки данные заказа появятся здесь.</p>
          <a href="#catalog" class="btn btn-primary btn-sm">Перейти в каталог</a>
        </div>
      `;
      return;
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const imageFallback = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80";

    container.innerHTML = orders.map(ord => {
      const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const badgeClass = getStatusBadge(ord.status);

      return `
        <div class="product-card" style="margin-bottom: 1rem; height: auto;">
          <div class="flex items-center justify-between" style="border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <span class="badge ${badgeClass}">${ord.status || 'Новый'}</span>
              <strong style="margin-left: 0.5rem;">Заказ #${ord.id.slice(0, 8)}</strong>
            </div>
            <span style="font-size: 0.8125rem; color: var(--muted-fg);">${formattedDate}</span>
          </div>

          <div class="flex-col gap-2" style="margin-bottom: 1rem;">
            ${(ord.items || []).map(item => `
              <div class="flex items-center justify-between" style="font-size: 0.875rem;">
                <div class="flex items-center gap-2">
                  <img src="${item.image || imageFallback}" alt="${item.name}" style="width: 36px; height: 36px; object-fit: contain; border: 1px solid var(--border); border-radius: 4px;" onerror="this.src='${imageFallback}'">
                  <span>${item.name} <b>x${item.quantity}</b></span>
                </div>
                <span>${formatPrice(item.price * item.quantity)}</span>
              </div>
            `).join("")}
          </div>

          <div class="flex items-center justify-between" style="border-top: 1px solid var(--border); padding-top: 0.75rem;">
            <span style="font-size: 0.875rem; color: var(--muted-fg);">Адрес: ${ord.shippingDetails?.address || 'Доставка курьером'}</span>
            <span style="font-size: 1.125rem; font-weight: 800; color: var(--foreground);">Итого: ${formatPrice(ord.totalPrice)}</span>
          </div>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error("Ошибка загрузки заказов пользователя:", error);
    container.innerHTML = `<p class="form-error">Не удалось загрузить историю заказов.</p>`;
  }
}

/**
 * Helper to style status badges
 */
function getStatusBadge(status) {
  switch (status) {
    case "Новый": return "badge-orange";
    case "В обработке": return "badge-gray";
    case "Отправлен": return "badge-gray";
    case "Доставлен": return "badge-green";
    case "Отменён": return "badge-danger";
    default: return "badge-gray";
  }
}
