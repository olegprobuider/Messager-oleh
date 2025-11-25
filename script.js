// ====== Firebase Init ======
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

let myId = localStorage.getItem("uid");

// ==== Авторегистрация ====
if (!myId) {
    myId = "u" + Date.now();
    localStorage.setItem("uid", myId);

    db.ref("users/" + myId).set({
        name: "Пользователь " + myId.substring(5),
        avatar: "",
        online: true
    });
}

// ==== Онлайн статус ====
db.ref("users/" + myId + "/online").set(true);
window.addEventListener("beforeunload", () => {
    db.ref("users/" + myId + "/online").set(false);
});

// ==== Подгрузить мой профиль ====
db.ref("users/" + myId).on("value", snap => {
    let u = snap.val();
    document.getElementById("myName").textContent = u.name;
    if (u.avatar)
        document.getElementById("myAvatar").src = u.avatar;
});

// ======================
// ===== ГРУППЫ =========
// ======================
const groupListEl = document.getElementById("groupList");

db.ref("groups").on("value", snap => {
    groupListEl.innerHTML = "";
    snap.forEach(g => {
        let d = document.createElement("div");
        d.textContent = g.val().title;
        d.onclick = () => openGroup(g.key);
        groupListEl.appendChild(d);
    });
});

document.getElementById("btnCreateGroup").onclick = () => {
    let title = prompt("Название группы:");
    if (!title) return;

    let id = db.ref("groups").push().key;

    db.ref("groups/" + id).set({
        title,
        created: myId
    });
};

// Поиск групп
document.getElementById("groupSearch").oninput = function () {
    let text = this.value.toLowerCase();
    [...groupListEl.children].forEach(div => {
        div.style.display =
            div.textContent.toLowerCase().includes(text)
                ? "block"
                : "none";
    });
};

// Открытие группы
function openGroup(id) {
    loadMessages("groups/" + id + "/messages");
}

// =======================
// ===== Контакты =======
// =======================
const contactSearch = document.getElementById("contactSearch");
const searchResults = document.getElementById("searchResults");
const contactsList = document.getElementById("contactsList");

// Поиск пользователей
contactSearch.oninput = function () {
    let text = this.value.toLowerCase();
    searchResults.innerHTML = "";

    db.ref("users").once("value", snap => {
        snap.forEach(u => {
            if (u.key === myId) return;

            if (u.val().name.toLowerCase().includes(text)) {
                let d = document.createElement("div");
                d.textContent = u.val().name + (u.val().online ? " 🟢" : " ⚪");
                d.onclick = () => addContact(u.key);
                searchResults.appendChild(d);
            }
        });
    });
};

// Добавление контакта
function addContact(id) {
    db.ref("contacts/" + myId + "/" + id).set(true);
}

// Удаление контакта
function removeContact(id) {
    db.ref("contacts/" + myId + "/" + id).remove();
}

// Список контактов
db.ref("contacts/" + myId).on("value", snap => {
    contactsList.innerHTML = "";
    snap.forEach(uid => {
        db.ref("users/" + uid.key).once("value", u => {
            let d = document.createElement("div");
            d.textContent = u.val().name + (u.val().online ? " 🟢" : " ⚪");
            d.onclick = () => openContactChat(uid.key);
            d.oncontextmenu = e => {
                e.preventDefault();
                removeContact(uid.key);
            };
            contactsList.appendChild(d);
        });
    });
});

// =======================
// ===== ЧАТЫ ============
// =======================
let currentChatPath = null;

function openContactChat(uid) {
    currentChatPath = "private/" + myId + "/" + uid;
    loadMessages(currentChatPath);
}

function loadMessages(path) {
    currentChatPath = path;
    const messagesEl = document.getElementById("messages");
    messagesEl.innerHTML = "";

    db.ref(path).on("value", snap => {
        messagesEl.innerHTML = "";
        snap.forEach(m => {
            let d = document.createElement("div");
            d.className = "message";
            d.textContent = m.val().from + ": " + m.val().text;
            messagesEl.appendChild(d);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
    });
}

// Отправка
document.getElementById("sendMsg").onclick = sendMessage;

function sendMessage() {
    let text = document.getElementById("messageInput").value.trim();
    if (!text || !currentChatPath) return;

    let key = db.ref(currentChatPath).push().key;

    db.ref(currentChatPath + "/" + key).set({
        from: myId,
        text,
        time: Date.now()
    });

    document.getElementById("messageInput").value = "";
}
