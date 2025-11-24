// ====== script.js ======

// ====== Firebase Config ======
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
const auth = firebase.auth();

let currentUser = null;
let currentNick = "";
let currentAvatar = "";
let activeChat = null;
let chatUsers = [];

// ====== ЭЛЕМЕНТЫ ======
const elLogin = document.getElementById("login");
const elApp = document.getElementById("app");
const elNickname = document.getElementById("nickname");
const elAvatarInput = document.getElementById("avatarInput");
const elUsers = document.getElementById("users");
const elChatList = document.getElementById("chatList");
const elSearch = document.getElementById("search");
const elMessages = document.getElementById("messages");
const elChatWith = document.getElementById("chatWith");
const elMsgInput = document.getElementById("msgInput");
const sidebarEl = document.querySelector(".sidebar");

// Для смены аватарки в любое время
const avatarChangeInput = document.getElementById("avatarChangeInput");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");

// ====== АВТОРИЗАЦИЯ ======
auth.onAuthStateChanged(async user => {
  if (!user) {
    auth.signInAnonymously().catch(err => console.error(err));
    return;
  }
  currentUser = user.uid;

  // Проверяем локальные данные
  const storedNick = localStorage.getItem("nick");
  const storedAvatar = localStorage.getItem("avatarUrl");

  if (storedNick && storedAvatar) {
    currentNick = storedNick;
    currentAvatar = storedAvatar;

    await db.ref("users/" + currentUser).set({
      nick: currentNick,
      avatarUrl: currentAvatar,
      online: true
    });

    showApp();
    loadUsers();
    loadOnlineStatus();
    loadChatList();
  } else {
    showLogin();
  }

  window.addEventListener("beforeunload", () => {
    if(currentUser) db.ref("users/" + currentUser + "/online").set(false);
  });
});

// ====== ЛОГИН ======
async function saveNickname() {
  const nick = elNickname.value.trim();
  if (!nick) return alert("Введите ник!");

  const file = elAvatarInput.files[0];

  let avatarUrl = localStorage.getItem("avatarUrl") || "";

  if (file) {
    const ext = file.name.split(".").pop();
    if (!["png","jpg","jpeg"].includes(ext.toLowerCase())) return alert("Только PNG/JPG!");
    const ref = storage.ref(`avatars/${currentUser}_${Date.now()}.${ext}`);
    const task = await ref.put(file);
    avatarUrl = await task.ref.getDownloadURL();
  } else if (!avatarUrl) {
    avatarUrl = "https://via.placeholder.com/40?text=U";
  }

  currentNick = nick;
  currentAvatar = avatarUrl;

  await db.ref("users/" + currentUser).set({
    nick: currentNick,
    avatarUrl: currentAvatar,
    online: true
  });

  localStorage.setItem("nick", currentNick);
  localStorage.setItem("avatarUrl", currentAvatar);

  showApp();
  loadUsers();
  loadChatList();
}
window.saveNickname = saveNickname;

// ====== Смена аватарки в любое время ======
changeAvatarBtn.onclick = () => avatarChangeInput.click();

avatarChangeInput.onchange = async () => {
  const file = avatarChangeInput.files[0];
  if(!file) return;

  const ext = file.name.split(".").pop();
  if (!["png","jpg","jpeg"].includes(ext.toLowerCase())) return alert("Только PNG/JPG!");

  const ref = storage.ref(`avatars/${currentUser}_${Date.now()}.${ext}`);
  const task = await ref.put(file);
  const avatarUrl = await task.ref.getDownloadURL();

  currentAvatar = avatarUrl;
  localStorage.setItem("avatarUrl", avatarUrl);

  await db.ref("users/" + currentUser).update({avatarUrl});
  loadUsers();
  renderChatList();
}

// ====== UI ======
function showApp() { elLogin.style.display = "none"; elApp.style.display = "flex"; }
function showLogin() { elLogin.style.display = "flex"; elApp.style.display = "none"; }

// ====== СПИСОК ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ======
function loadUsers() {
  db.ref("users").on("value", snap => {
    const users = snap.val() || {};
    elUsers.innerHTML = "";
    Object.keys(users).forEach(uid => {
      if (uid === currentUser) return;
      const user = users[uid];

      const div = document.createElement("div");
      div.className = "user";

      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";

      const img = document.createElement("img");
      img.src = user.avatarUrl || "https://via.placeholder.com/40?text=U";
      img.onerror = () => { img.src = "https://via.placeholder.com/40?text=U"; };
      wrapper.appendChild(img);

      const status = document.createElement("div");
      status.className = "status " + (user.online ? "online" : "offline");
      wrapper.appendChild(status);

      div.appendChild(wrapper);

      const span = document.createElement("span");
      span.textContent = user.nick || "NoName";
      div.appendChild(span);

      const btn = document.createElement("button");
      updateChatButton(uid, btn);

      btn.onclick = (e)=>{
        e.stopPropagation();
        toggleChatUser(uid);
        updateChatButton(uid, btn);
      }
      div.appendChild(btn);

      elUsers.appendChild(div);
    });
  });
}

// ====== Кнопка + / - ======
function updateChatButton(uid, btn){
  if(chatUsers.includes(uid)){
    btn.textContent = "-";
    btn.classList.add("remove");
  } else {
    btn.textContent = "+";
    btn.classList.remove("remove");
  }
}

// ====== Добавление/удаление пользователя в список чатов ======
function toggleChatUser(uid) {
  if(chatUsers.includes(uid)){
    chatUsers = chatUsers.filter(u=>u!==uid);
  } else {
    chatUsers.push(uid);
  }
  renderChatList();
}
window.toggleChatUser = toggleChatUser;

// ====== ПОИСК ======
function searchUsers() {
  const text = elSearch.value.toLowerCase();
  document.querySelectorAll(".user").forEach(div=>{
    const name = div.textContent.toLowerCase();
    div.style.display = name.includes(text) ? "flex" : "none";
  });
}
window.searchUsers = searchUsers;

// ====== СПИСОК ЧАТОВ ======
function renderChatList(){
  elChatList.innerHTML = "";
  chatUsers.forEach(uid=>{
    db.ref("users/"+uid).once("value").then(snap=>{
      const u = snap.val();
      const div = document.createElement("div");
      div.className = "chatUser";

      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      const img = document.createElement("img");
      img.src = u.avatarUrl || "https://via.placeholder.com/40?text=U";
      img.onerror = () => { img.src = "https://via.placeholder.com/40?text=U"; };
      wrapper.appendChild(img);

      const status = document.createElement("div");
      status.className = "status " + (u.online ? "online" : "offline");
      wrapper.appendChild(status);

      div.appendChild(wrapper);

      const span = document.createElement("span");
      span.textContent = u.nick || "NoName";
      div.appendChild(span);

      div.onclick = ()=> openChat(uid, u.nick);
      elChatList.appendChild(div);
    });
  });
}

// ====== Загрузка списка чатов и online ======
function loadChatList(){
  db.ref("users").on("value", snap=>{
    renderChatList();
    loadUsers();
  });
}

// ====== Открыть чат ======
function openChat(uid, nick){
  activeChat = uid;
  elChatWith.textContent = "Чат с "+nick;
  db.ref("messages/"+getChatId()).off();
  db.ref("messages/"+getChatId()).on("value", snap=>{
    renderMessages(snap.val() || {});
  });
}
window.openChat = openChat;

// ====== CHAT ID ======
function getChatId(){
  if(!currentUser || !activeChat) return null;
  return currentUser<activeChat ? currentUser+"_"+activeChat : activeChat+"_"+currentUser;
}

// ====== Рендер сообщений ======
function renderMessages(msgs){
  elMessages.innerHTML = "";
  const arr = Object.values(msgs).sort((a,b)=> (a.time||0)-(b.time||0));
  arr.forEach(m=>{
    const div = document.createElement("div");
    div.className = "msg";
    if(m.from===currentUser) div.classList.add("myMsg");

    const img = document.createElement("img");
    img.src = m.fromAvatar || "https://via.placeholder.com/35?text=U";
    img.onerror = () => { img.src = "https://via.placeholder.com/35?text=U"; };

    const body = document.createElement("div");
    body.className = "msgBody";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (m.fromNick||"User")+" · "+(new Date(m.time||Date.now())).toLocaleString();

    const text = document.createElement("div");
    text.className = "text";
    text.textContent = m.text||"";

    body.appendChild(meta);
    body.appendChild(text);

    if(m.from===currentUser){
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

// ====== Отправка сообщения ======
async function sendMessage(){
  const txt = elMsgInput.value.trim();
  if(!txt) return;
  if(!activeChat) return alert("Выберите чат");

  const snap = await db.ref("users/"+currentUser).once("value");
  const me = snap.val() || {};
  const chatId = getChatId();

  await db.ref("messages/"+chatId).push({
    from: currentUser,
    fromNick: me.nick || currentNick,
    fromAvatar: me.avatarUrl || currentAvatar,
    text: txt,
    time: Date.now()
  });

  elMsgInput.value = "";
}
window.sendMessage = sendMessage;

// ====== Обновление online ======
function loadOnlineStatus(){
  db.ref("users").on("value", snap=>{
    renderChatList();
    loadUsers();
  });
}

// ====== Мобильная адаптация ======
function openSidebarMobile(){ if(!sidebarEl) return; sidebarEl.style.left="0"; }
function closeSidebarMobile(){ if(!sidebarEl) return; sidebarEl.style.left="-100%"; }
window.openSidebarMobile = openSidebarMobile;
window.closeSidebarMobile = closeSidebarMobile;

document.addEventListener("click",(e)=>{
  if(window.innerWidth>700) return;
  if(!sidebarEl) return;
  if(!sidebarEl.contains(e.target) && !e.target.closest(".topBar")){
    closeSidebarMobile();
  }
});
