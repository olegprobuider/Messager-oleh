// Firebase init
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

let userId = null;
let currentChat = null;

/* ----------------------------- Создание аккаунта -------------------------- */
function createAccount() {
    let nick = nicknameInput.value.trim();
    let file = avatarInput.files[0];

    if (!nick) return alert("Введите ник");

    userId = Date.now();

    if (file) {
        let reader = new FileReader();
        reader.onload = () => saveUser(nick, reader.result);
        reader.readAsDataURL(file);
    } else {
        saveUser(nick, "default");
    }
}

function saveUser(nick, avatar) {
    firebase.database().ref("users/" + userId).set({
        nickname: nick,
        avatar: avatar,
        online: true
    });

    localStorage.setItem("userId", userId);

    authScreen.classList.add("hidden");
    app.classList.remove("hidden");

    loadUser();
    loadContacts();
    loadGroups();
}

/* ----------------------------- Загрузка данных ----------------------------- */
function loadUser() {
    userId = localStorage.getItem("userId");
    firebase.database().ref("users/" + userId).once("value").then(s => {
        let u = s.val();
        myAvatarSmall.src = u.avatar === "default" ? "" : u.avatar;
        myNicknameSmall.innerText = u.nickname;
    });
}

/* ----------------------------- Редактировать профиль ---------------------- */
function openProfileEdit() {
    profileEdit.classList.remove("hidden");
}

function closeProfileEdit() {
    profileEdit.classList.add("hidden");
}

function saveProfile() {
    let newNick = editNickname.value.trim();
    let file = editAvatar.files[0];

    if (newNick)
        firebase.database().ref(`users/${userId}/nickname`).set(newNick);

    if (file) {
        let r = new FileReader();
        r.onload = () => {
            firebase.database().ref(`users/${userId}/avatar`).set(r.result);
        };
        r.readAsDataURL(file);
    }

    closeProfileEdit();
    loadUser();
}

/* ----------------------------- Контакты ---------------------------------- */
function loadContacts() {
    firebase.database().ref("users").on("value", snap => {
        contactList.innerHTML = "";
        snap.forEach(u => {
            if (u.key == userId) return;

            let div = document.createElement("div");
            div.className = "contactItem";
            div.innerHTML = `
                <div>${u.val().nickname}</div>
            `;
            div.onclick = () => openChatWith(u.key, u.val().nickname);
            contactList.appendChild(div);
        });
    });
}

/* ----------------------------- Группы ------------------------------------- */
function createGroup() {
    let name = newGroupName.value.trim();
    if (!name) return;

    let id = Date.now();

    firebase.database().ref("groups/" + id).set({
        name: name
    });

    newGroupName.value = "";
}

function loadGroups() {
    firebase.database().ref("groups").on("value", snap => {
        groupList.innerHTML = "";
        snap.forEach(g => {
            let div = document.createElement("div");
            div.innerText = g.val().name;
            div.onclick = () => openGroup(g.key, g.val().name);
            groupList.appendChild(div);
        });
    });
}

/* ----------------------------- Открытие чата ------------------------------ */
function openChatWith(uid, nickname) {
    currentChat = "pm_" + [userId, uid].sort().join("_");
    currentChatName.innerText = nickname;
    loadMessages();
}

function openGroup(id, name) {
    currentChat = "group_" + id;
    currentChatName.innerText = name;
    loadMessages();
}

/* ----------------------------- Сообщения ---------------------------------- */
function sendMessage() {
    if (!currentChat) return;

    let text = messageInput.value.trim();
    if (!text) return;

    firebase.database().ref("messages/" + currentChat).push({
        user: userId,
        text: text,
        time: Date.now()
    });

    messageInput.value = "";
}

function loadMessages() {
    firebase.database().ref("messages/" + currentChat).on("value", snap => {
        messages.innerHTML = "";

        snap.forEach(m => {
            let d = document.createElement("div");
            d.innerHTML = `<b>${m.val().user == userId ? "Вы" : m.val().user}:</b> ${m.val().text}`;
            messages.appendChild(d);
        });

        messages.scrollTop = messages.scrollHeight;
    });
}
