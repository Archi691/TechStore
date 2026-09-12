import { db, collection, getDocs } from "./firebase.js";
import { addToCart } from "./cart.js";

// Active state for products state management
let allProducts = [];
let filteredProducts = [];
let activeCategory = "all";
let searchKeyword = "";
let priceMin = null;
let priceMax = null;
let stockOnly = false;
let promoOnly = false;
let currentSort = "popular";

/**
 * Format price to Kazakh Tenge currency string
 */
export function formatPrice(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 ₸";
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0
  }).format(Math.round(amount));
  return `${formatted} ₸`;
}

/**
 * Fetch products strictly from Cloud Firestore `products` collection
 */
export async function loadProducts() {
  const gridContainer = document.getElementById("products-grid");
  const countText = document.getElementById("products-count-text");

  if (!gridContainer) return;

  // Show Skeleton Loaders while fetching
  gridContainer.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton" style="height: 180px;"></div>
      <div class="skeleton" style="height: 16px; width: 40%;"></div>
      <div class="skeleton" style="height: 22px; width: 90%;"></div>
      <div class="skeleton" style="height: 36px; width: 100%; margin-top: auto;"></div>
    </div>
  `).join("");

  if (countText) countText.textContent = "Загрузка товаров из Cloud Firestore...";

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const fetched = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      fetched.push({
        id: doc.id,
        ...data,
        price: Number(data.price) || 0,
        oldPrice: data.oldPrice ? Number(data.oldPrice) : null,
        rating: Number(data.rating) || 5.0,
        discount: data.discount || (data.oldPrice ? Math.round((1 - data.price / data.oldPrice) * 100) : 0),
        inStock: data.stock === true || data.stock === "true" || data.inStock === true
      });
    });

    allProducts = fetched;
    applyFiltersAndRender();
  } catch (error) {
    console.error("Ошибка при загрузке товаров из Firestore:", error);
    gridContainer.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3 class="empty-title">Ошибка загрузки данных из Firestore</h3>
        <p class="empty-desc">Не удалось получить список товаров. Проверьте подключение к интернету или правила доступа Firestore.</p>
        <button type="button" class="btn btn-primary btn-sm" onclick="location.reload()">Повторить попытку</button>
      </div>
    `;
    if (countText) countText.textContent = "Ошибка загрузки";
  }
}

/**
 * Filter and sort products according to user state
 */
export function applyFiltersAndRender() {
  const gridContainer = document.getElementById("products-grid");
  const countText = document.getElementById("products-count-text");

  if (!gridContainer) return;

  filteredProducts = allProducts.filter(product => {
    // Category filter
    if (activeCategory !== "all" && product.category !== activeCategory) {
      return false;
    }

    // Search keyword filter
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase().trim();
      const nameMatch = product.name?.toLowerCase().includes(kw);
      const catMatch = product.category?.toLowerCase().includes(kw);
      const descMatch = product.description?.toLowerCase().includes(kw);
      if (!nameMatch && !catMatch && !descMatch) return false;
    }

    // Price range min
    if (priceMin !== null && product.price < priceMin) {
      return false;
    }

    // Price range max
    if (priceMax !== null && product.price > priceMax) {
      return false;
    }

    // Stock only filter
    if (stockOnly && !product.inStock) {
      return false;
    }

    // Promo/discount only filter
    if (promoOnly && (!product.oldPrice || product.oldPrice <= product.price)) {
      return false;
    }

    return true;
  });

  // Sorting
  filteredProducts.sort((a, b) => {
    switch (currentSort) {
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "discount":
        return (b.discount || 0) - (a.discount || 0);
      case "newest":
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      case "popular":
      default:
        return (b.rating || 0) - (a.rating || 0);
    }
  });

  // Update counter
  if (countText) {
    countText.textContent = `Показано ${filteredProducts.length} товаров из ${allProducts.length}`;
  }

  // Render empty state if no products found
  if (filteredProducts.length === 0) {
    if (allProducts.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m21 21-4.3-4.3"/><circle cx="11" cy="11" r="8"/></svg>
          <h3 class="empty-title">В базе Firestore пока нет товаров</h3>
          <p class="empty-desc">Вы можете заполнить базу первоначальным каталогом электроники в 1 клик в панели администратора.</p>
          <a href="#admin" class="btn btn-primary" id="empty-state-admin-btn">Перейти в админ-панель</a>
        </div>
      `;
    } else {
      gridContainer.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <h3 class="empty-title">Ничего не найдено</h3>
          <p class="empty-desc">Попробуйте изменить параметры поиска или сбросить фильтры.</p>
          <button type="button" class="btn btn-outline" id="empty-reset-filters-btn">Сбросить все фильтры</button>
        </div>
      `;
      const resetBtn = document.getElementById("empty-reset-filters-btn");
      if (resetBtn) resetBtn.addEventListener("click", resetAllFilters);
    }
    return;
  }

  // Render Product Cards Grid
  gridContainer.innerHTML = filteredProducts.map(product => renderProductCardHTML(product)).join("");
}

/**
 * Render single product card HTML snippet
 */
function renderProductCardHTML(product) {
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const imageFallback = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80";

  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-badge-group">
        ${hasDiscount ? `<span class="badge badge-orange">-${discountPercent}%</span>` : ''}
        ${!product.inStock ? `<span class="badge badge-danger">Нет на складе</span>` : `<span class="badge badge-green">В наличии</span>`}
      </div>

      <div class="product-img-wrapper" data-action="open-detail" data-id="${product.id}">
        <img src="${product.image || imageFallback}" 
             alt="${product.name}" 
             class="product-img"
             loading="lazy"
             onerror="this.src='${imageFallback}'">
      </div>

      <span class="product-category">${getCategoryName(product.category)}</span>
      <h3 class="product-title" data-action="open-detail" data-id="${product.id}">${product.name}</h3>

      <div class="product-rating">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>${product.rating || '5.0'}</span>
        <span class="rating-count">(отзывов: ${Math.floor(Math.random() * 40) + 5})</span>
      </div>

      <p class="product-specs-summary">${product.specifications || product.description || ''}</p>

      <div class="product-footer">
        <div class="product-price-box">
          <span class="card-price">${formatPrice(product.price)}</span>
          ${hasDiscount ? `<span class="card-old-price">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>
        <button type="button" 
                class="btn btn-primary btn-sm add-to-cart-btn" 
                data-id="${product.id}"
                ${!product.inStock ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          В корзину
        </button>
      </div>
    </div>
  `;
}

/**
 * Open Product Detail Modal
 */
export function openProductDetailModal(productId) {
  const product = getProductById(productId);
  if (!product) return;

  const modal = document.getElementById("product-detail-modal");
  const modalBody = document.getElementById("modal-detail-body");
  if (!modal || !modalBody) return;

  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  const discountPercent = hasDiscount ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const imageFallback = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80";

  // Related products from same category
  const related = allProducts.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);

  const imagesList = product.images && Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || imageFallback, imageFallback];

  modalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-gallery">
        <img id="detail-main-img-view" src="${imagesList[0]}" alt="${product.name}" class="detail-main-img" onerror="this.src='${imageFallback}'">
        <div class="detail-thumbnails">
          ${imagesList.map((img, idx) => `
            <img src="${img}" class="thumb-img ${idx === 0 ? 'active' : ''}" data-src="${img}" onerror="this.src='${imageFallback}'">
          `).join("")}
        </div>
      </div>

      <div class="detail-info">
        <div class="flex items-center gap-2" style="margin-bottom: 0.5rem;">
          <span class="badge badge-gray">${getCategoryName(product.category)}</span>
          ${hasDiscount ? `<span class="badge badge-orange">Скидка -${discountPercent}%</span>` : ''}
          ${product.inStock ? `<span class="badge badge-green">В наличии</span>` : `<span class="badge badge-danger">Нет в наличии</span>`}
        </div>

        <h2 class="detail-title">${product.name}</h2>

        <div class="product-rating" style="margin-bottom: 1rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>${product.rating || '5.0'}</span>
          <span class="rating-count">(отзывов: 24)</span>
        </div>

        <div class="detail-price-row">
          <span class="detail-price">${formatPrice(product.price)}</span>
          ${hasDiscount ? `<span class="card-old-price" style="font-size: 1.125rem;">${formatPrice(product.oldPrice)}</span>` : ''}
        </div>

        <p style="font-size: 0.9375rem; color: var(--muted-fg); margin-bottom: 1.5rem; line-height: 1.6;">
          ${product.description || 'Высококачественное устройство премиум класса с официальной гарантией от производителя.'}
        </p>

        <div class="flex items-center gap-4" style="margin-bottom: 1.5rem;">
          <label class="form-label" style="margin: 0;">Количество:</label>
          <div class="detail-qty-selector">
            <button type="button" class="qty-btn" id="detail-qty-minus">-</button>
            <input type="number" id="detail-qty-val" class="qty-input" value="1" min="1" max="99" readonly>
            <button type="button" class="qty-btn" id="detail-qty-plus">+</button>
          </div>
        </div>

        <div class="flex gap-3" style="margin-bottom: 2rem;">
          <button type="button" class="btn btn-primary btn-lg" id="detail-add-cart-btn" style="flex: 1;" ${!product.inStock ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            В корзину
          </button>
          <button type="button" class="btn btn-secondary btn-lg" id="detail-buy-now-btn" style="flex: 1;" ${!product.inStock ? 'disabled' : ''}>
            Купить сейчас
          </button>
        </div>

        <div>
          <h4 class="form-label">Характеристики</h4>
          <table class="detail-specs-table">
            <tbody>
              ${(product.specifications || 'Гарантия: 12 месяцев, Состояние: Новое').split(',').map(spec => {
                const parts = spec.split(':');
                if (parts.length >= 2) {
                  return `<tr><td>${parts[0].trim()}</td><td><b>${parts.slice(1).join(':').trim()}</b></td></tr>`;
                }
                return `<tr><td>Параметр</td><td><b>${spec.trim()}</b></td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>

      </div>
    </div>

    ${related.length > 0 ? `
      <div style="margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border);">
        <h3 class="section-title" style="font-size: 1.25rem; margin-bottom: 1.25rem;">Похожие товары</h3>
        <div class="products-grid" style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;">
          ${related.map(rel => renderProductCardHTML(rel)).join("")}
        </div>
      </div>
    ` : ''}
  `;

  // Gallery Thumbnail switcher logic
  modalBody.querySelectorAll(".thumb-img").forEach(thumb => {
    thumb.addEventListener("click", () => {
      modalBody.querySelectorAll(".thumb-img").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
      const mainImg = document.getElementById("detail-main-img-view");
      if (mainImg) mainImg.src = thumb.dataset.src;
    });
  });

  // Quantity adjusters
  const qtyValInput = document.getElementById("detail-qty-val");
  const minusBtn = document.getElementById("detail-qty-minus");
  const plusBtn = document.getElementById("detail-qty-plus");

  if (minusBtn && qtyValInput) {
    minusBtn.addEventListener("click", () => {
      let val = parseInt(qtyValInput.value) || 1;
      if (val > 1) qtyValInput.value = val - 1;
    });
  }

  if (plusBtn && qtyValInput) {
    plusBtn.addEventListener("click", () => {
      let val = parseInt(qtyValInput.value) || 1;
      if (val < 99) qtyValInput.value = val + 1;
    });
  }

  // Add to cart click inside detail modal
  const addCartBtn = document.getElementById("detail-add-cart-btn");
  if (addCartBtn) {
    addCartBtn.addEventListener("click", () => {
      const qty = parseInt(qtyValInput.value) || 1;
      addToCart(product, qty);
    });
  }

  // Buy now click inside detail modal
  const buyNowBtn = document.getElementById("detail-buy-now-btn");
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", () => {
      const qty = parseInt(qtyValInput.value) || 1;
      addToCart(product, qty);
      modal.classList.remove("active");
      // Trigger checkout drawer or dialog
      const checkoutModal = document.getElementById("checkout-modal");
      if (checkoutModal) checkoutModal.classList.add("active");
    });
  }

  modal.classList.add("active");
}

/**
 * Category translation helper
 */
export function getCategoryName(catKey) {
  const categories = {
    smartphones: "Смартфоны",
    laptops: "Ноутбуки",
    computers: "Компьютеры",
    components: "Комплектующие",
    monitors: "Мониторы",
    peripherals: "Периферия",
    gaming: "Игровые устройства",
    accessories: "Аксессуары"
  };
  return categories[catKey] || catKey || "Электроника";
}

/**
 * Filter State Setters
 */
export function setActiveCategory(categoryKey) {
  activeCategory = categoryKey;
  
  document.querySelectorAll("[data-category]").forEach(el => {
    el.classList.toggle("active", el.dataset.category === categoryKey);
  });
  document.querySelectorAll("[data-cat]").forEach(el => {
    el.classList.toggle("active", el.dataset.cat === categoryKey);
  });

  applyFiltersAndRender();
}

export function setSearchKeyword(query) {
  searchKeyword = query;
  applyFiltersAndRender();
}

export function setPriceFilter(min, max) {
  priceMin = min !== "" && min !== null ? Number(min) : null;
  priceMax = max !== "" && max !== null ? Number(max) : null;
  applyFiltersAndRender();
}

export function setStockOnly(value) {
  stockOnly = value;
  applyFiltersAndRender();
}

export function setPromoOnly(value) {
  promoOnly = value;
  applyFiltersAndRender();
}

export function setSort(sortValue) {
  currentSort = sortValue;
  applyFiltersAndRender();
}

export function resetAllFilters() {
  activeCategory = "all";
  searchKeyword = "";
  priceMin = null;
  priceMax = null;
  stockOnly = false;
  promoOnly = false;
  currentSort = "popular";

  const searchInput = document.getElementById("global-search-input");
  if (searchInput) searchInput.value = "";

  const minInput = document.getElementById("price-min");
  if (minInput) minInput.value = "";

  const maxInput = document.getElementById("price-max");
  if (maxInput) maxInput.value = "";

  const stockCheck = document.getElementById("stock-only-checkbox");
  if (stockCheck) stockCheck.checked = false;

  const promoCheck = document.getElementById("promo-only-checkbox");
  if (promoCheck) promoCheck.checked = false;

  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) sortSelect.value = "popular";

  setActiveCategory("all");
}

export function getAllLoadedProducts() {
  return allProducts;
}

export function getProductById(id) {
  return allProducts.find(p => p.id === id);
}
