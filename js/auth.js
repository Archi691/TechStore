import { 
  auth, 
  db,
  doc,
  getDoc,
  setDoc,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  updateProfile
} from "./firebase.js";
import { initCart, showToast } from "./cart.js";

let currentUser = null;
let isAdminUser = false;

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Check if active user is administrator
 */
export function getIsAdmin() {
  return isAdminUser;
}

/**
 * Initialize Firebase Auth state listener
 */
export function initAuthListener(onUserChangeCallback) {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user) {
      // Check admin status from Firestore users doc or email pattern
      isAdminUser = await checkIfUserIsAdmin(user);

      updateHeaderAuthUI(user);
      showUserAccountNav(true, isAdminUser);
      initCart(user);
      showToast(`С возвращением, ${user.displayName || user.email}!`, "success");
    } else {
      isAdminUser = false;
      updateHeaderAuthUI(null);
      showUserAccountNav(false, false);
      initCart(null);
    }

    if (typeof onUserChangeCallback === "function") {
      onUserChangeCallback(user, isAdminUser);
    }
  });
}

/**
 * Admin detection helper — роль проверяется только в Firestore
 */
async function checkIfUserIsAdmin(user) {
  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists() && userSnap.data().role === "admin") {
      return true;
    }
  } catch (e) {
    console.warn("[Auth] Не удалось прочитать роль из Firestore:", e);
  }
  return false;
}

/**
 * Register User with Email & Password
 */
export async function registerUser(name, email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName: name });

    // Всегда 'customer' — роль admin выдаётся вручную через Firebase Console
    const role = "customer";

    // Save profile into Firestore `users` collection (ignore Firestore errors so registration still succeeds)
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: role,
        createdAt: new Date().toISOString()
      });
    } catch (firestoreErr) {
      console.warn("[Auth] Не удалось сохранить профиль в Firestore:", firestoreErr.code, firestoreErr.message);
    }

    closeAuthModal();
    return { success: true, user };
  } catch (error) {
    console.error("[Auth] Ошибка регистрации:", error.code, error.message);
    const errorMsg = translateAuthError(error.code);
    return { success: false, error: errorMsg };
  }
}

/**
 * Login User with Email & Password
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    closeAuthModal();
    return { success: true, user: userCredential.user };
  } catch (error) {
    const errorMsg = translateAuthError(error.code);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send Password Reset Email
 */
export async function resetUserPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Ссылка для сброса пароля отправлена на ваш email", "info");
    closeAuthModal();
    return { success: true };
  } catch (error) {
    const errorMsg = translateAuthError(error.code);
    return { success: false, error: errorMsg };
  }
}

/**
 * Sign Out
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    showToast("Вы успешно вышли из системы", "info");
    location.hash = "#catalog";
  } catch (error) {
    showToast("Ошибка при выходе из системы", "error");
  }
}

/**
 * Update UI for Auth state in Header
 */
function updateHeaderAuthUI(user) {
  const authBtnText = document.getElementById("auth-btn-text");
  const accountEmail = document.getElementById("account-user-email");

  if (user) {
    if (authBtnText) {
      authBtnText.textContent = user.displayName || user.email.split("@")[0];
    }
    if (accountEmail) {
      accountEmail.textContent = `Пользователь: ${user.email} (ID: ${user.uid.slice(0, 8)}...)`;
    }
  } else {
    if (authBtnText) {
      authBtnText.textContent = "Войти";
    }
    if (accountEmail) {
      accountEmail.textContent = "Не авторизован";
    }
  }
}

/**
 * Show/Hide navigation items based on role
 */
function showUserAccountNav(isLoggedIn, isAdmin) {
  const navAccount = document.getElementById("nav-account");
  const navAdmin = document.getElementById("nav-admin");
  const mobNavAccount = document.getElementById("mobile-nav-account");
  const mobNavAdmin = document.getElementById("mobile-nav-admin");

  if (navAccount) navAccount.classList.toggle("hidden", !isLoggedIn);
  if (mobNavAccount) mobNavAccount.classList.toggle("hidden", !isLoggedIn);

  if (navAdmin) navAdmin.classList.toggle("hidden", !isAdmin);
  if (mobNavAdmin) mobNavAdmin.classList.toggle("hidden", !isAdmin);
}

/**
 * Helper to close auth modal
 */
function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.remove("active");
}

/**
 * Friendly Russian translation of Firebase auth errors
 */
function translateAuthError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный email или пароль.";
    case "auth/email-already-in-use":
      return "Пользователь с таким email уже зарегистрирован.";
    case "auth/weak-password":
      return "Пароль слишком простой (минимум 6 символов).";
    case "auth/invalid-email":
      return "Некорректный формат адреса электронной почты.";
    case "auth/too-many-requests":
      return "Слишком много неудачных попыток входа. Попробуйте позже.";
    case "auth/operation-not-allowed":
      return "Вход через email/пароль не включён в настройках Firebase. Включите Email/Password в Authentication → Sign-in method.";
    case "auth/configuration-not-found":
    case "auth/project-not-found":
      return "Конфигурация Firebase не найдена. Проверьте настройки проекта.";
    case "auth/network-request-failed":
      return "Ошибка сети. Проверьте подключение к интернету.";
    case "auth/internal-error":
      return "Внутренняя ошибка Firebase. Попробуйте позже.";
    default:
      return `Ошибка авторизации (${code || 'unknown'}). Проверьте консоль браузера (F12).`;
  }
}
