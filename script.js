// ====== script.js ======

// ====== ВСТАВЬ СВОЙ firebaseConfig (он уже тут) ======
const firebaseConfig = {
  apiKey: "AIzaSyDbF1Xi9ajCcLj6MfJQEhkhedOnkeo8aO8",
  authDomain: "messager-v2.firebaseapp.com",
  databaseURL: "https://messager-v2-default-rtdb.firebaseio.com",
  projectId: "messager-v2",
  storageBucket: "messager-v2.firebasestorage.app",
  messagingSenderId: "715324115354",
  appId: "1:715324115354:web:40df5fe73cf89fdb451223",
  measurementId: "G-C4K7787PDP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

let currentUser = null;   // uid
let currentNick = "";     // ник текущего пользователя
let currentAvatar = "";   // url аватарки текущего пользователя
let chatUser = null;      // uid собеседника (выбранный чат)
let chatUserNick = "";    // ник собеседника

// ====== ЭЛЕМЕНТЫ ======
const elLogin = document.getElementById("login");
const elApp = document.getElementById("app");
const elNickname = document.getElementById("nickname");
const elAvatarInput = document.getElementById("avatarInput");
const elUsers = document.getElementById("users");
const elSearch = document.getElementById("search");
const elMessages = document.getElementById("messages");
const elChatWith = document.getElementById("chatWith");
const elMsgInput = document.getElementById("msgInput");
const sidebarEl = document.querySelector(".sidebar");

// ====== УТИЛЫ ======
function showApp() {
  elLogin.style.display = "none";
  elApp.style.display = "flex";
}
function showLogin() {
  elLogin.style.display = "flex";
  elApp.style.display = "none";
}

// ====== АВТОРИЗАЦИЯ И СОХРАНЕНИЕ НИКА ======
// Смотрим состояние аутентификации
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // пользователь есть — сохраняем ID и загружаем профиль
    currentUser = user.uid;
    loadMyProfile().then(() => {
      showApp();
      loadUsers(); // слушаем список пользователей
    });
  } else {
    // Нет авторизации — попытаемся автоматически войти анонимно
    // (если в localStorage есть ник — создадим профиль после входа)
    firebase.auth().signInAnonymously().catch(err => {
      console.error("Ошибка анонимного входа:", err);
    });
  }
});

// ====== ЗАГРУЗКА И СОХРАНЕНИЕ ПРОФИЛЯ (НИК + АВА) ======
async function loadMyProfile() {
  // Проверяем есть ли профиль в БД
  const snap = await db.ref("users/" + currentUser).once("value");
  const data = snap.val();

  // Если профиль в БД есть — используем его
  if (data) {
    currentNick = data.nick || localStorage.getItem("nick") || "";
    currentAvatar = data.avatarUrl || localStorage.getItem("avatarUrl") || "";
    // Сохраняем локально
    if (currentNick) localStorage.setItem("nick", currentNick);
    if (currentAvatar) localStorage.setItem("avatarUrl", currentAvatar);
    elNickname.value = currentNick;
  } else {
    // Если профиля нет — если в localStorage есть ник, создаём профиль автоматически
    const savedNick = localStorage.getItem("nick");
    const savedAvatar = localStorage.getItem("avatarUrl");

    if (savedNick) {
      // создаём профиль в БД (без файла, если нет)
      await db.ref("users/" + currentUser).set({
        nick: savedNick,
        avatarUrl: savedAvatar || ""
      });
      currentNick = savedNick;
      currentAvatar = savedAvatar || "";
      elNickname.value = currentNick;
    } else {
      // Показываем логин (пользователь должен ввести ник)
      showLogin();
    }
  }
}

// ====== КНОПКА "Войти" на странице логина ======
async function saveNickname() {
  const nick = elNickname.value.trim();
  if (!nick) return alert("Введите ник!");

  // Если выбрана аватарка файл — загружаем его
  const file = elAvatarInput.files && elAvatarInput.files[0];

  // Если нет текущего аутентифицированного юзера — убедимся, что он есть
  if (!currentUser) {
    // если ещё не авторизован, попытаемся залогиниться анонимно
    const trySign = await firebase.auth().signInAnonymously();
    currentUser = trySign.user.uid;
  }

  let avatarUrl = "";

  if (file) {
    // загружаем в storage: avatars/{uid}_{timestamp}
    const ext = file.name.split(".").pop();
    const ref = storage.ref(`avatars/${currentUser}_${Date.now()}.${ext}`);
    const task = await ref.put(file);
    avatarUrl = await task.ref.getDownloadURL();
  } else {
    // если локально сохранилась аватарка — используем её
    avatarUrl = localStorage.getItem("avatarUrl") || "";
  }

  // записываем профиль в базе
  await db.ref("users/" + currentUser).set({
    nick: nick,
    avatarUrl: avatarUrl
  });

  // сохраняем локально
  localStorage.setItem("nick", nick);
  if (avatarUrl) localStorage.setItem("avatarUrl", avatarUrl);

  currentNick = nick;
  currentAvatar = avatarUrl;

  showApp();
  loadUsers();
}

// Делает доступной функцию из index.html
window.saveNickname = saveNickname;

// ====== ЗАГРУЗКА СПИСКА ПОЛЬЗОВАТЕЛЕЙ ======
function loadUsers() {
  db.ref("users").on("value", snapshot => {
    const users = snapshot.val() || {};
    elUsers.innerHTML = "";

    // создаём DOM для каждого пользователя
    Object.keys(users).forEach(uid => {
      // показываем всех, включая себя — но самого себя можно скрыть
      const user = users[uid];
      const div = document.createElement("div");
      div.className = "user";
      div.dataset.uid = uid;

      // аватар
      const img = document.createElement("img");
      img.src = user.avatarUrl || "https://via.placeholder.com/40?text=U";
      img.alt = user.nick || "User";
      img.onerror = () => { img.src = "https://via.placeholder.com/40?text=U"; };

      // текст
      const span = document.createElement("span");
      span.textContent = (user.nick || "NoName") + (uid === currentUser ? " (вы)" : "");

      div.appendChild(img);
      div.appendChild(span);

      // кликабельный — открываем чат, но не с собой
      if (uid !== currentUser) {
        div.onclick = () => openChat(uid, user.nick || "User");
      } else {
        // если это текущий пользователь , позволим кликать для обновления авы/ника
        div.onclick = () => editMyProfile();
      }

      elUsers.appendChild(div);
    });
  });
}

// ====== ПОИСК ПО СПИСКУ ======
function searchUsers() {
  const text = elSearch.value.toLowerCase();
  document.querySelectorAll(".user").forEach(div => {
    const name = div.textContent.toLowerCase();
    div.style.display = name.includes(text) ? "flex" : "none";
  });
}
window.searchUsers = searchUsers;

// ====== ОТКРЫТЬ ЧАТ ======
function openChat(uid, nick) {
  chatUser = uid;
  chatUserNick = nick;
  elChatWith.textContent = "Чат с " + nick;

  // В мобильном режиме скрываем боковую панель
  if (window.innerWidth <= 700) {
    closeSidebarMobile();
  }

  // Подписываемся на сообщения в этом чате
  const chatId = getChatId();
  db.ref("messages/" + chatId).off(); // снимем старую подписку
  db.ref("messages/" + chatId).on("value", snap => {
    const msgs = snap.val() || {};
    renderMessages(msgs);
  });
}
window.openChat = openChat;

function getChatId() {
  if (!currentUser || !chatUser) return null;
  // Стабильный ID — сортируем строки
  return currentUser < chatUser ? currentUser + "_" + chatUser : chatUser + "_" + currentUser;
}

// ====== РЕНДЕР СООБЩЕНИЙ ======
function renderMessages(msgs) {
  elMessages.innerHTML = "";
  // Сортируем по времени
  const arr = Object.values(msgs).sort((a,b) => (a.time||0) - (b.time||0));
  arr.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg";

    const img = document.createElement("img");
    img.src = m.fromAvatar || "https://via.placeholder.com/35?text=U";
    img.alt = m.fromNick || "User";
    img.onerror = () => { img.src = "https://via.placeholder.com/35?text=U"; };

    const body = document.createElement("div");
    body.className = "msgBody";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (m.fromNick || "User") + " · " + (new Date(m.time || Date.now())).toLocaleString();

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = m.text || "";

    body.appendChild(meta);
    body.appendChild(text);

    // если сообщение от меня — выравниваем вправо
    if (m.from === currentUser) {
      div.style.justifyContent = "flex-end";
      // invert order: text then avatar
      div.appendChild(body);
      div.appendChild(img);
    } else {
      div.appendChild(img);
      div.appendChild(body);
    }

    elMessages.appendChild(div);
  });

  elMessages.scrollTop = elMessages.scrollHeight;
}

// ====== ОТПРАВКА СООБЩЕНИЯ ======
async function sendMessage() {
  const txt = elMsgInput.value.trim();
  if (!txt) return;
  if (!chatUser) return alert("Выберите пользователя для чата");

  // Читаем свежий ник/аватар текущего пользователя (вдруг обновили)
  const snap = await db.ref("users/" + currentUser).once("value");
  const me = snap.val() || {};
  const nick = me.nick || localStorage.getItem("nick") || "You";
  const avatarUrl = me.avatarUrl || localStorage.getItem("avatarUrl") || "";

  const chatId = getChatId();
  const ref = db.ref("messages/" + chatId).push();
  await ref.set({
    from: currentUser,
    fromNick: nick,
    fromAvatar: avatarUrl,
    text: txt,
    time: Date.now()
  });

  elMsgInput.value = "";
}
window.sendMessage = sendMessage;

// ====== РЕДАКТИРОВАТЬ СВОЙ ПРОФИЛЬ (из списка юзеров) ======
function editMyProfile() {
  // Показываем форму логина, но оставляем авторизацию
  showLogin();
  // подставляем текущие данные
  elNickname.value = currentNick || localStorage.getItem("nick") || "";
  // если есть сохранённая аватарка — ничего не делаем (file input не заполняется)
}

// ====== МОДАЛЬНОЕ ОТКРЫТИЕ БОКОВОЙ ПАНЕЛИ НА МОБИЛЕ ======
function openSidebarMobile() {
  if (!sidebarEl) return;
  sidebarEl.style.left = "0";
}
function closeSidebarMobile() {
  if (!sidebarEl) return;
  sidebarEl.style.left = "-100%";
}
window.openSidebarMobile = openSidebarMobile;

// Закрыть при клике вне панели (только на мобиле)
document.addEventListener("click", (e) => {
  if (window.innerWidth > 700) return;
  if (!sidebarEl) return;
  if (!sidebarEl.contains(e.target) && !e.target.closest(".topBar")) {
    closeSidebarMobile();
  }
});

// ====== ОБНОВЛЕНИЕ АВАТАРКИ В ЛЮБОЕ ВРЕМЯ (необязательно на логине) ======
elAvatarInput.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!currentUser) return alert("Сначала войдите");

  const ext = file.name.split(".").pop();
  const ref = storage.ref(`avatars/${currentUser}_${Date.now()}.${ext}`);
  const task = await ref.put(file);
  const avatarUrl = await task.ref.getDownloadURL();

  // обновляем профиль в базе и localStorage
  await db.ref("users/" + currentUser).update({ avatarUrl });
  localStorage.setItem("avatarUrl", avatarUrl);
  currentAvatar = avatarUrl;

  // если профиль ещё не имел ника, подставим
  const nick = elNickname.value.trim() || localStorage.getItem("nick") || "";
  if (nick) {
    await db.ref("users/" + currentUser).update({ nick });
    localStorage.setItem("nick", nick);
    currentNick = nick;
  }

  // Обновляем интерфейс списка пользователей (сработает слушатель db.ref users)
  alert("Аватарка загружена");
});

// ====== ПРЕДОТВРАЩЕНИЕ ПОТЕРИ ПОЛЬЗОВАТЕЛЯ ПРИ ВЫХОДЕ/ПЕРЕЗАГРУЗКЕ ======
// При закрытии вкладки не удаляем профиль — чтобы при повторном входе профиль был
window.addEventListener("beforeunload", () => {
  // ничего не удаляем — профиль сохраняем в БД. Если захочешь — можно добавлять флаг online:false
});

// ====== ПОЯСНЕНИЕ: сохраняем ник в localStorage при вводе (чтобы он был при следующем входе)
elNickname.addEventListener("input", () => {
  const v = elNickname.value.trim();
  if (v) localStorage.setItem("nick", v);
});

// ====== ПОДСОЕДИНЕНИЕ UI-ФУНКЦИЙ К window (если нужно вызвать из HTML)
window.openChat = openChat;
window.editMyProfile = editMyProfile;
window.openSidebarMobile = openSidebarMobile;
window.closeSidebarMobile = closeSidebarMobile;

// ====== ЗАПУСК: если уже есть локальный ник — подставим в поле ======
document.addEventListener("DOMContentLoaded", () => {
  const savedNick = localStorage.getItem("nick");
  if (savedNick) elNickname.value = savedNick;
});
