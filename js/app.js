import { 
  loadProducts, 
  setActiveCategory, 
  setSearchKeyword, 
  setPriceFilter, 
  setStockOnly, 
  setPromoOnly, 
  setSort, 
  resetAllFilters, 
  openProductDetailModal,
  getProductById
} from "./products.js";
import { addToCart, clearCart, showToast } from "./cart.js";
import { 
  initAuthListener, 
  loginUser, 
  registerUser, 
  resetUserPassword, 
  logoutUser,
  getCurrentUser,
  getIsAdmin
} from "./auth.js";
import { 
  seedInitialFirestoreCatalog, 
  renderAdminProductsTable, 
  renderAdminOrdersTable, 
  openEditProductModal, 
  saveAdminProductForm 
} from "./admin.js";
import { placeOrder, renderUserOrderHistory } from "./orders.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initial Load of Products from Cloud Firestore
  loadProducts();

  // 2. Initialize Firebase Auth Observer
  initAuthListener((user, isAdmin) => {
    handleNavigation(location.hash || "#catalog");
    if (isAdmin && !location.hash.includes("admin")) {
      renderAdminProductsTable();
    }
  });

  // 3. Navigation & Hash Router
  window.addEventListener("hashchange", () => {
    handleNavigation(location.hash);
  });
  handleNavigation(location.hash || "#catalog");

  // 4. Sticky Header Scroll Effect
  window.addEventListener("scroll", () => {
    const header = document.getElementById("header");
    if (header) {
      header.classList.toggle("scrolled", window.scrollY > 10);
    }
  });

  // 5. Setup All UI Event Listeners
  setupHeaderEvents();
  setupFilterEvents();
  setupProductGridEvents();
  setupModalEvents();
  setupAuthFormEvents();
  setupCartEvents();
  setupCheckoutEvents();
  setupAdminEvents();
});

/**
 * Handle View Switching based on URL Hash
 */
function handleNavigation(hash) {
  const currentHash = hash.replace("#", "") || "catalog";
  
  const catalogSec = document.getElementById("catalog-section");
  const categoriesSec = document.querySelector(".categories-section");
  const accountSec = document.getElementById("account-section");
  const adminSec = document.getElementById("admin-section");

  // Update Nav Links Active States
  document.querySelectorAll(".nav-link").forEach(link => {
    const target = link.dataset.nav;
    link.classList.toggle("active", target === currentHash);
  });

  // Hide All Major View Containers
  if (accountSec) accountSec.classList.add("hidden");
  if (adminSec) adminSec.classList.add("hidden");

  if (currentHash === "account") {
    if (accountSec) accountSec.classList.remove("hidden");
    if (categoriesSec) categoriesSec.style.display = "none";
    if (catalogSec) catalogSec.style.display = "none";
    renderUserOrderHistory();
  } else if (currentHash === "admin") {
    if (getIsAdmin()) {
      if (adminSec) adminSec.classList.remove("hidden");
      if (categoriesSec) categoriesSec.style.display = "none";
      if (catalogSec) catalogSec.style.display = "none";
      renderAdminProductsTable();
      renderAdminOrdersTable();
    } else {
      showToast("Доступ в админ-панель ограничен", "error");
      location.hash = "#catalog";
    }
  } else if (currentHash === "promotions") {
    if (categoriesSec) categoriesSec.style.display = "block";
    if (catalogSec) catalogSec.style.display = "block";
    setPromoOnly(true);
    const promoCheck = document.getElementById("promo-only-checkbox");
    if (promoCheck) promoCheck.checked = true;
    window.scrollTo({ top: catalogSec.offsetTop - 80, behavior: 'smooth' });
  } else {
    // Default Catalog View
    if (categoriesSec) categoriesSec.style.display = "block";
    if (catalogSec) catalogSec.style.display = "block";
  }
}

/**
 * Setup Header & Search Event Listeners
 */
function setupHeaderEvents() {
  const globalSearch = document.getElementById("global-search-input");
  const mobileSearch = document.getElementById("mobile-search-input");
  const clearSearchBtn = document.getElementById("search-clear-btn");

  let searchTimeout = null;
  const handleSearchInput = (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      setSearchKeyword(e.target.value);
    }, 200);
  };

  if (globalSearch) globalSearch.addEventListener("input", handleSearchInput);
  if (mobileSearch) mobileSearch.addEventListener("input", handleSearchInput);

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (globalSearch) globalSearch.value = "";
      if (mobileSearch) mobileSearch.value = "";
      setSearchKeyword("");
    });
  }

  // Mobile Drawer Toggle
  const mobTrigger = document.getElementById("mobile-menu-trigger");
  const mobOverlay = document.getElementById("mobile-nav-overlay");
  const mobClose = document.getElementById("mobile-nav-close");

  if (mobTrigger && mobOverlay) {
    mobTrigger.addEventListener("click", () => mobOverlay.classList.add("active"));
  }
  if (mobClose && mobOverlay) {
    mobClose.addEventListener("click", () => mobOverlay.classList.remove("active"));
  }
  if (mobOverlay) {
    mobOverlay.querySelectorAll(".mobile-nav-item").forEach(item => {
      item.addEventListener("click", () => mobOverlay.classList.remove("active"));
    });
  }

  // Reset category button in header
  const resetCatBtn = document.getElementById("reset-cat-btn");
  if (resetCatBtn) resetCatBtn.addEventListener("click", resetAllFilters);
}

/**
 * Setup Sidebar & Category Filters Listeners
 */
function setupFilterEvents() {
  // Category cards in main page
  const catGrid = document.getElementById("categories-grid");
  if (catGrid) {
    catGrid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-category]");
      if (card) {
        setActiveCategory(card.dataset.category);
      }
    });
  }

  // Category list in sidebar
  const catList = document.getElementById("filter-categories-list");
  if (catList) {
    catList.addEventListener("click", (e) => {
      const item = e.target.closest("[data-cat]");
      if (item) {
        setActiveCategory(item.dataset.cat);
      }
    });
  }

  // Price inputs
  const priceMinInput = document.getElementById("price-min");
  const priceMaxInput = document.getElementById("price-max");

  const handlePriceChange = () => {
    setPriceFilter(priceMinInput ? priceMinInput.value : null, priceMaxInput ? priceMaxInput.value : null);
  };

  if (priceMinInput) priceMinInput.addEventListener("input", handlePriceChange);
  if (priceMaxInput) priceMaxInput.addEventListener("input", handlePriceChange);

  // Checkboxes
  const stockCheck = document.getElementById("stock-only-checkbox");
  if (stockCheck) stockCheck.addEventListener("change", (e) => setStockOnly(e.target.checked));

  const promoCheck = document.getElementById("promo-only-checkbox");
  if (promoCheck) promoCheck.addEventListener("change", (e) => setPromoOnly(e.target.checked));

  // Sort Select
  const sortSelect = document.getElementById("sort-select");
  if (sortSelect) sortSelect.addEventListener("change", (e) => setSort(e.target.value));

  // Clear filters button
  const clearFiltersBtn = document.getElementById("clear-filters-btn");
  if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", resetAllFilters);
}

/**
 * Setup Event Delegation on Products Grid (Card Clicks & Add to Cart)
 */
function setupProductGridEvents() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  grid.addEventListener("click", (e) => {
    // Add to cart button
    const cartBtn = e.target.closest(".add-to-cart-btn");
    if (cartBtn) {
      e.stopPropagation();
      const id = cartBtn.dataset.id;
      const product = getProductById(id);
      if (product) addToCart(product, 1);
      return;
    }

    // Open detail modal on image, title or card body
    const detailTrigger = e.target.closest('[data-action="open-detail"]');
    if (detailTrigger) {
      openProductDetailModal(detailTrigger.dataset.id);
      return;
    }

    const card = e.target.closest(".product-card");
    if (card && !e.target.closest("button")) {
      openProductDetailModal(card.dataset.id);
    }
  });
}

/**
 * Setup Cart Drawer Event Listeners
 */
function setupCartEvents() {
  const trigger = document.getElementById("cart-drawer-trigger");
  const overlay = document.getElementById("cart-drawer-overlay");
  const closeBtn = document.getElementById("cart-drawer-close");
  const clearBtn = document.getElementById("clear-cart-btn");
  const checkoutTriggerBtn = document.getElementById("checkout-trigger-btn");

  if (trigger && overlay) {
    trigger.addEventListener("click", () => overlay.classList.add("active"));
  }
  if (closeBtn && overlay) {
    closeBtn.addEventListener("click", () => overlay.classList.remove("active"));
  }
  if (clearBtn) {
    clearBtn.addEventListener("click", clearCart);
  }
  if (checkoutTriggerBtn) {
    checkoutTriggerBtn.addEventListener("click", () => {
      if (overlay) overlay.classList.remove("active");
      const checkoutModal = document.getElementById("checkout-modal");
      if (checkoutModal) checkoutModal.classList.add("active");
    });
  }
}

/**
 * Setup Modal Overlays Backdrop & Close Buttons
 */
function setupModalEvents() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  });

  document.querySelectorAll(".modal-close").forEach(closeBtn => {
    closeBtn.addEventListener("click", () => {
      const modal = closeBtn.closest(".modal-overlay");
      if (modal) modal.classList.remove("active");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active, .drawer-overlay.active").forEach(el => {
        el.classList.remove("active");
      });
    }
  });
}

/**
 * Setup Authentication Dialog Forms & Tabs
 */
function setupAuthFormEvents() {
  const authTrigger = document.getElementById("auth-modal-trigger");
  const authModal = document.getElementById("auth-modal");
  
  if (authTrigger && authModal) {
    authTrigger.addEventListener("click", () => {
      const user = getCurrentUser();
      if (user) {
        location.hash = "#account";
      } else {
        authModal.classList.add("active");
      }
    });
  }

  // Tabs Switcher
  const loginTab = document.getElementById("auth-tab-login");
  const regTab = document.getElementById("auth-tab-register");
  const resetTab = document.getElementById("auth-tab-reset");

  const loginForm = document.getElementById("login-form");
  const regForm = document.getElementById("register-form");
  const resetForm = document.getElementById("reset-form");
  const modalTitle = document.getElementById("auth-modal-title");
  const errorAlert = document.getElementById("auth-error-alert");

  const switchAuthTab = (target) => {
    if (errorAlert) errorAlert.classList.add("hidden");

    [loginTab, regTab, resetTab].forEach(t => t && t.classList.remove("active"));
    [loginForm, regForm, resetForm].forEach(f => f && f.classList.add("hidden"));

    if (target === "login") {
      if (loginTab) loginTab.classList.add("active");
      if (loginForm) loginForm.classList.remove("hidden");
      if (modalTitle) modalTitle.textContent = "Вход в аккаунт";
    } else if (target === "register") {
      if (regTab) regTab.classList.add("active");
      if (regForm) regForm.classList.remove("hidden");
      if (modalTitle) modalTitle.textContent = "Регистрация аккаунта";
    } else if (target === "reset") {
      if (resetTab) resetTab.classList.add("active");
      if (resetForm) resetForm.classList.remove("hidden");
      if (modalTitle) modalTitle.textContent = "Восстановление пароля";
    }
  };

  if (loginTab) loginTab.addEventListener("click", () => switchAuthTab("login"));
  if (regTab) regTab.addEventListener("click", () => switchAuthTab("register"));
  if (resetTab) resetTab.addEventListener("click", () => switchAuthTab("reset"));

  // Login Form Submit
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;

      const res = await loginUser(email, pass);
      if (!res.success && errorAlert) {
        errorAlert.textContent = res.error;
        errorAlert.classList.remove("hidden");
      }
    });
  }

  // Register Form Submit
  if (regForm) {
    regForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name").value;
      const email = document.getElementById("reg-email").value;
      const pass = document.getElementById("reg-password").value;

      const res = await registerUser(name, email, pass);
      if (!res.success && errorAlert) {
        errorAlert.textContent = res.error;
        errorAlert.classList.remove("hidden");
      }
    });
  }

  // Reset Form Submit
  if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("reset-email").value;
      const res = await resetUserPassword(email);
      if (!res.success && errorAlert) {
        errorAlert.textContent = res.error;
        errorAlert.classList.remove("hidden");
      }
    });
  }

  // Logout Button in Profile
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logoutUser);
}

/**
 * Setup Checkout Form Events
 */
function setupCheckoutEvents() {
  const checkoutForm = document.getElementById("checkout-form");
  if (!checkoutForm) return;

  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("checkout-name").value.trim();
    const phone = document.getElementById("checkout-phone").value.trim();
    const address = document.getElementById("checkout-address").value.trim();
    const payment = checkoutForm.querySelector('input[name="payment"]:checked')?.value || "card";

    await placeOrder({ name, phone, address, paymentMethod: payment });
  });
}

/**
 * Setup Admin Panel Events (CRUD & Seed Data)
 */
function setupAdminEvents() {
  // 1-Click Seed DB Button
  const seedBtn = document.getElementById("seed-db-btn");
  if (seedBtn) seedBtn.addEventListener("click", seedInitialFirestoreCatalog);

  // Add product button
  const addProdBtn = document.getElementById("add-product-btn");
  if (addProdBtn) addProdBtn.addEventListener("click", () => openEditProductModal(null));

  // Admin form submit
  const adminForm = document.getElementById("admin-product-form");
  if (adminForm) adminForm.addEventListener("submit", saveAdminProductForm);

  // Admin Tabs (Products vs Orders)
  const tabProdBtn = document.getElementById("admin-tab-products");
  const tabOrdersBtn = document.getElementById("admin-tab-orders");
  const viewProd = document.getElementById("admin-products-view");
  const viewOrders = document.getElementById("admin-orders-view");

  if (tabProdBtn && tabOrdersBtn) {
    tabProdBtn.addEventListener("click", () => {
      tabProdBtn.classList.add("active");
      tabOrdersBtn.classList.remove("active");
      if (viewProd) viewProd.classList.remove("hidden");
      if (viewOrders) viewOrders.classList.add("hidden");
      renderAdminProductsTable();
    });

    tabOrdersBtn.addEventListener("click", () => {
      tabOrdersBtn.classList.add("active");
      tabProdBtn.classList.remove("active");
      if (viewOrders) viewOrders.classList.remove("hidden");
      if (viewProd) viewProd.classList.add("hidden");
      renderAdminOrdersTable();
    });
  }
}
