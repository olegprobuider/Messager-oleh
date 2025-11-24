// ==== Firebase config (вставь сюда свой!) ====
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

let currentUser = null;
let chatUser = null;


// ===========================
//      ЛОГИН (НИК)
// ===========================
function saveNickname() {
  const nick = document.getElementById("nickname").value.trim();
  if (!nick) return alert("Введите ник!");

  firebase.auth().signInAnonymously().then(user => {
    currentUser = user.user.uid;

    db.ref("users/" + currentUser).set({ nick });

    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "flex";

    loadUsers();
  });
}


// ===========================
//     ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ
// ===========================
function loadUsers() {
  db.ref("users").on("value", snapshot => {
    const users = snapshot.val() || {};
    const list = document.getElementById("users");

    list.innerHTML = "";

    Object.keys(users).forEach(id => {
      if (id === currentUser) return;

      const div = document.createElement("div");
      div.className = "user";
      div.textContent = users[id].nick;

      div.onclick = () => openChat(id, users[id].nick);

      list.appendChild(div);
    });
  });
}


// ===========================
//     ПОИСК ПОЛЬЗОВАТЕЛЕЙ
// ===========================
function searchUsers() {
  const text = document.getElementById("search").value.toLowerCase();

  document.querySelectorAll(".user").forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(text)
      ? "block"
      : "none";
  });
}


// ===========================
//      ОТКРЫТЬ ЧАТ
// ===========================
function openChat(id, nick) {
  chatUser = id;

  document.getElementById("chatWith").textContent = "Чат с " + nick;

  db.ref("messages/" + getChatId()).on("value", snap => {
    const msgs = snap.val() || {};
    const box = document.getElementById("messages");

    box.innerHTML = "";

    Object.values(msgs).forEach(m => {
      const div = document.createElement("div");
      div.textContent = `${m.fromNick}: ${m.text}`;
      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}


// Chat ID (для приватного чата)
function getChatId() {
  return currentUser < chatUser
    ? currentUser + "_" + chatUser
    : chatUser + "_" + currentUser;
}


// ===========================
//     ОТПРАВКА СООБЩЕНИЯ
// ===========================
function sendMessage() {
  const txt = document.getElementById("msgInput").value.trim();
  if (!txt || !chatUser) return;

  db.ref("users/" + currentUser).once("value").then(snap => {
    const nick = snap.val().nick;

    db.ref("messages/" + getChatId()).push({
      from: currentUser,
      fromNick: nick,
      text: txt,
      time: Date.now()
    });

    document.getElementById("msgInput").value = "";
  });
}
