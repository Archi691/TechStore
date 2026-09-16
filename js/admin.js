import { 
  db, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from "./firebase.js";
import { formatPrice, loadProducts, getCategoryName } from "./products.js";
import { showToast } from "./cart.js";

/**
 * Initial dataset for 1-click seeding into Cloud Firestore `products` collection
 */
const initialSeedProducts = [
  {
    name: "Смартфон TechPhone 15 Pro Max 256GB",
    category: "smartphones",
    description: "Флагманский смартфон с титановым корпусом, дисплеем Super Retina XDR 120 Гц и камерой 48 МП с 5x оптическим зумом.",
    price: 649990,
    oldPrice: 719990,
    discount: 10,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80"
    ],
    rating: 4.9,
    stock: true,
    specifications: "Дисплей: 6.7 OLED 120Гц, Процессор: A17 Pro 3нм, Память: 256 ГБ, Аккумулятор: 4422 мАч",
    createdAt: new Date()
  },
  {
    name: "Ноутбук UltraBook Pro 16 M3 Max",
    category: "laptops",
    description: "Профессиональный ноутбук для разработчиков, дизайнеров и видеомонтажёров. Дисплей Liquid Retina XDR и до 22 часов работы.",
    price: 899990,
    oldPrice: 999990,
    discount: 10,
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&auto=format&fit=crop&q=80"
    ],
    rating: 5.0,
    stock: true,
    specifications: "Экран: 16.2 Mini-LED 120Гц, CPU: 16 ядер, RAM: 36 ГБ, SSD: 1 ТБ",
    createdAt: new Date()
  },
  {
    name: "Игровой ПК CyberStation RTX 4080 Super",
    category: "computers",
    description: "Мощный игровой системный блок с кастомным жидкостным охлаждением и RGB-подсветкой. Готов к 4K геймингу.",
    price: 949990,
    oldPrice: 999990,
    discount: 5,
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80"
    ],
    rating: 4.8,
    stock: true,
    specifications: "Видеокарта: RTX 4080 Super 16GB, CPU: i9-14900K, RAM: 64GB DDR5, SSD: 2TB NVMe",
    createdAt: new Date()
  },
  {
    name: "Видеокарта GeForce RTX 4090 24GB Gaming",
    category: "components",
    description: "Флагманский графический процессор для сверхтребовательных игр и генеративных нейросетей.",
    price: 799990,
    oldPrice: null,
    discount: 0,
    image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80",
    images: ["https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&auto=format&fit=crop&q=80"],
    rating: 4.9,
    stock: true,
    specifications: "Видеопамять: 24 ГБ GDDR6X, Шина: 384 бит, Разъемы: HDMI 2.1, 3x DisplayPort 1.4a",
    createdAt: new Date()
  },
  {
    name: "Монитор Curved OLED 34\" 240Hz Gaming",
    category: "monitors",
    description: "Изогнутый OLED монитор с потрясающим контрастом, мгновенным откликом 0.03 мс и частотой 240 Гц.",
    price: 449990,
    oldPrice: 499990,
    discount: 10,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80",
    images: ["https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80"],
    rating: 4.9,
    stock: true,
    specifications: "Диагональ: 34 дюйма, Разрешение: 3440x1440 UWQHD, Панель: Quantum Dot OLED, Отклик: 0.03 мс",
    createdAt: new Date()
  },
  {
    name: "Механическая клавиатура Wireless RGB Pro",
    category: "peripherals",
    description: "Беспроводная клавиатура с возможностью горячей замены переключателей (Hot-Swap) и шумоизоляцией.",
    price: 54990,
    oldPrice: 64990,
    discount: 15,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80",
    images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80"],
    rating: 4.7,
    stock: true,
    specifications: "Свитчи: Gateron Yellow Lubricated, Подключение: 2.4GHz / Bluetooth / Type-C, Аккумулятор: 4000 мАч",
    createdAt: new Date()
  },
  {
    name: "Игровая гарнитура Surround 7.1 Wireless",
    category: "gaming",
    description: "Игровая гарнитура с объёмным звуком 7.1, микрофоном с шумоподавлением и мягкими амбушюрами с охлаждающим гелем.",
    price: 69990,
    oldPrice: 79990,
    discount: 13,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80"],
    rating: 4.8,
    stock: true,
    specifications: "Динамики: 50 мм Неодимовые, Диапазон: 12 - 28000 Гц, Время работы: до 50 часов",
    createdAt: new Date()
  },
  {
    name: "Быстрое зарядное устройство GaN 100W Dual Port",
    category: "accessories",
    description: "Компактный сетевой адаптер на основе нитрида галлия (GaN) для одновременной зарядки ноутбука и смартфона.",
    price: 19990,
    oldPrice: 24990,
    discount: 20,
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80",
    images: ["https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80"],
    rating: 4.9,
    stock: true,
    specifications: "Мощность: 100 Вт, Порты: 2x USB-C Power Delivery 3.0, 1x USB-A QC 4.0",
    createdAt: new Date()
  }
];

/**
 * 1-Click Seed Initial Dataset into Firestore `products` collection
 */
export async function seedInitialFirestoreCatalog() {
  const seedBtn = document.getElementById("seed-db-btn");
  if (seedBtn) {
    seedBtn.disabled = true;
    seedBtn.textContent = "Запись в Firestore...";
  }

  try {
    let addedCount = 0;
    const prodRef = collection(db, "products");

    for (const prod of initialSeedProducts) {
      await addDoc(prodRef, {
        ...prod,
        createdAt: new Date()
      });
      addedCount++;
    }

    showToast(`Успешно добавлено ${addedCount} товаров в Firestore!`, "success");
    await loadProducts();
    await renderAdminProductsTable();
  } catch (error) {
    console.error("Ошибка инициализации Firestore:", error);
    showToast("Не удалось записать данные в Firestore", "error");
  } finally {
    if (seedBtn) {
      seedBtn.disabled = false;
      seedBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
        1-клик инициализация БД
      `;
    }
  }
}

/**
 * Render Admin Products Management Table
 */
export async function renderAdminProductsTable() {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="empty-desc" style="text-align: center;">Загрузка товаров...</td></tr>`;

  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = [];
    querySnapshot.forEach(docSnap => {
      products.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-desc" style="text-align: center; padding: 2rem;">
            В базе Firestore нет товаров. Нажмите "1-клик инициализация БД" или "Добавить товар".
          </td>
        </tr>
      `;
      return;
    }

    const imageFallback = "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=80";

    tbody.innerHTML = products.map(prod => `
      <tr>
        <td>
          <img src="${prod.image || imageFallback}" alt="${prod.name}" class="table-img" onerror="this.src='${imageFallback}'">
        </td>
        <td><b>${prod.name}</b></td>
        <td><span class="badge badge-gray">${getCategoryName(prod.category)}</span></td>
        <td>${formatPrice(prod.price)}</td>
        <td>${prod.oldPrice ? `<span class="badge badge-orange">-${Math.round((1 - prod.price / prod.oldPrice) * 100)}%</span>` : '—'}</td>
        <td>${prod.stock === true || prod.stock === "true" ? `<span class="badge badge-green">В наличии</span>` : `<span class="badge badge-danger">Нет</span>`}</td>
        <td>
          <div class="flex gap-2">
            <button type="button" class="btn btn-outline btn-sm edit-prod-btn" data-id="${prod.id}">Редактировать</button>
            <button type="button" class="btn btn-danger btn-sm delete-prod-btn" data-id="${prod.id}">Удалить</button>
          </div>
        </td>
      </tr>
    `).join("");

    // Attach listeners for Edit & Delete
    tbody.querySelectorAll(".edit-prod-btn").forEach(btn => {
      btn.addEventListener("click", () => openEditProductModal(btn.dataset.id, products));
    });

    tbody.querySelectorAll(".delete-prod-btn").forEach(btn => {
      btn.addEventListener("click", () => deleteProduct(btn.dataset.id));
    });

  } catch (error) {
    console.error("Failed to render admin table:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="form-error">Ошибка загрузки списка товаров из Firestore.</td></tr>`;
  }
}

/**
 * Open Modal for Adding / Editing Product
 */
export function openEditProductModal(productId = null, productsArray = []) {
  const modal = document.getElementById("admin-product-modal");
  const form = document.getElementById("admin-product-form");
  const modalTitle = document.getElementById("admin-product-modal-title");

  if (!modal || !form) return;

  form.reset();
  document.getElementById("prod-id").value = "";

  if (productId) {
    const prod = productsArray.find(p => p.id === productId);
    if (prod) {
      if (modalTitle) modalTitle.textContent = "Редактировать товар";
      document.getElementById("prod-id").value = prod.id;
      document.getElementById("prod-name").value = prod.name || "";
      document.getElementById("prod-category").value = prod.category || "smartphones";
      document.getElementById("prod-stock").value = String(prod.stock !== false);
      document.getElementById("prod-price").value = prod.price || 0;
      document.getElementById("prod-oldprice").value = prod.oldPrice || "";
      document.getElementById("prod-image").value = prod.image || "";
      document.getElementById("prod-description").value = prod.description || "";
      document.getElementById("prod-specs").value = prod.specifications || "";
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Добавить новый товар";
  }

  modal.classList.add("active");
}

/**
 * Handle Admin Product Form Submission (Add or Edit)
 */
export async function saveAdminProductForm(e) {
  e.preventDefault();

  const id = document.getElementById("prod-id").value;
  const name = document.getElementById("prod-name").value.trim();
  const category = document.getElementById("prod-category").value;
  const stock = document.getElementById("prod-stock").value === "true";
  const price = Number(document.getElementById("prod-price").value) || 0;
  const oldPriceVal = document.getElementById("prod-oldprice").value;
  const oldPrice = oldPriceVal ? Number(oldPriceVal) : null;
  const image = document.getElementById("prod-image").value.trim();
  const description = document.getElementById("prod-description").value.trim();
  const specifications = document.getElementById("prod-specs").value.trim();

  const productObject = {
    name,
    category,
    stock,
    price,
    oldPrice,
    discount: oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0,
    image,
    images: [image],
    description,
    specifications,
    rating: 5.0,
    updatedAt: new Date()
  };

  try {
    if (id) {
      // Update
      await updateDoc(doc(db, "products", id), productObject);
      showToast("Товар обновлен в Firestore", "success");
    } else {
      // Create
      productObject.createdAt = new Date();
      await addDoc(collection(db, "products"), productObject);
      showToast("Новый товар добавлен в Firestore", "success");
    }

    const modal = document.getElementById("admin-product-modal");
    if (modal) modal.classList.remove("active");

    await loadProducts();
    await renderAdminProductsTable();
  } catch (error) {
    console.error("Save product error:", error);
    showToast("Ошибка сохранения товара", "error");
  }
}

/**
 * Delete product document from Firestore
 */
async function deleteProduct(id) {
  if (!confirm("Вы уверены, что хотите удалить этот товар из Cloud Firestore?")) return;

  try {
    await deleteDoc(doc(db, "products", id));
    showToast("Товар удален из базы данных", "info");
    await loadProducts();
    await renderAdminProductsTable();
  } catch (error) {
    console.error("Delete product error:", error);
    showToast("Ошибка удаления товара", "error");
  }
}

/**
 * Render Admin Orders Management Table
 */
export async function renderAdminOrdersTable() {
  const tbody = document.getElementById("admin-orders-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="empty-desc" style="text-align: center;">Загрузка заказов клиентов...</td></tr>`;

  try {
    const querySnapshot = await getDocs(collection(db, "orders"));
    const orders = [];
    querySnapshot.forEach(docSnap => {
      orders.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-desc" style="text-align: center; padding: 2rem;">
            Заказов от клиентов пока нет.
          </td>
        </tr>
      `;
      return;
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    tbody.innerHTML = orders.map(ord => {
      const itemsCount = ord.items ? ord.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0;
      const formattedDate = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const statusBadgeClass = getOrderStatusBadgeClass(ord.status);

      return `
        <tr>
          <td><code>#${ord.id.slice(0, 8)}</code></td>
          <td>${formattedDate}</td>
          <td>
            <b>${ord.shippingDetails?.name || 'Клиент'}</b><br>
            <span style="font-size: 0.75rem; color: var(--muted-fg);">${ord.shippingDetails?.phone || ''}</span>
          </td>
          <td>${itemsCount} шт.</td>
          <td><b>${formatPrice(ord.totalPrice)}</b></td>
          <td><span class="badge ${statusBadgeClass}">${ord.status || 'Новый'}</span></td>
          <td>
            <div class="flex gap-2">
              <select class="input-field order-status-select" data-id="${ord.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8125rem;">
                <option value="Новый" ${ord.status === 'Новый' ? 'selected' : ''}>Новый</option>
                <option value="В обработке" ${ord.status === 'В обработке' ? 'selected' : ''}>В обработке</option>
                <option value="Отправлен" ${ord.status === 'Отправлен' ? 'selected' : ''}>Отправлен</option>
                <option value="Доставлен" ${ord.status === 'Доставлен' ? 'selected' : ''}>Доставлен</option>
                <option value="Отменён" ${ord.status === 'Отменён' ? 'selected' : ''}>Отменён</option>
              </select>
              <button type="button" class="btn btn-danger btn-sm delete-order-btn" data-id="${ord.id}">Удалить</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Listeners for order status changes
    tbody.querySelectorAll(".order-status-select").forEach(select => {
      select.addEventListener("change", async (e) => {
        const orderId = select.dataset.id;
        const newStatus = e.target.value;
        await updateOrderStatus(orderId, newStatus);
      });
    });

    tbody.querySelectorAll(".delete-order-btn").forEach(btn => {
      btn.addEventListener("click", () => deleteOrder(btn.dataset.id));
    });

  } catch (error) {
    console.error("Failed to fetch admin orders:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="form-error">Ошибка загрузки списка заказов из Firestore.</td></tr>`;
  }
}

/**
 * Delete order document from Firestore
 */
async function deleteOrder(orderId) {
  if (!confirm(`Вы уверены, что хотите удалить заказ #${orderId.slice(0, 8)} из Cloud Firestore?`)) return;

  try {
    await deleteDoc(doc(db, "orders", orderId));
    showToast("Заказ удален из базы данных", "info");
    await renderAdminOrdersTable();
  } catch (error) {
    console.error("Delete order error:", error);
    showToast("Ошибка удаления заказа", "error");
  }
}

/**
 * Update order status in Firestore
 */
async function updateOrderStatus(orderId, newStatus) {
  try {
    await updateDoc(doc(db, "orders", orderId), {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    showToast(`Статус заказа #${orderId.slice(0, 8)} обновлен на "${newStatus}"`, "success");
    await renderAdminOrdersTable();
  } catch (error) {
    console.error("Order status update error:", error);
    showToast("Не удалось обновить статус заказа", "error");
  }
}

/**
 * Status Badge Style Helper
 */
function getOrderStatusBadgeClass(status) {
  switch (status) {
    case "Новый":
      return "badge-orange";
    case "В обработке":
      return "badge-gray";
    case "Отправлен":
      return "badge-gray";
    case "Доставлен":
      return "badge-green";
    case "Отменён":
      return "badge-danger";
    default:
      return "badge-gray";
  }
}
