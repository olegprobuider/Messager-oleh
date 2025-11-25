// script.js — основной логика мессенджера

// Firebase refs
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

let currentUser = null;
let currentRoomId = null;
let roomsRef = db.ref('rooms');
let usersRef = db.ref('users');
let statusRef = db.ref('status');

// UI elements
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const editProfileBtn = document.getElementById('editProfileBtn');
const profileModal = document.getElementById('profileModal');
const nickInput = document.getElementById('nickInput');
const avatarInput = document.getElementById('avatarInput');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const cancelProfileBtn = document.getElementById('cancelProfileBtn');

const newRoomBtn = document.getElementById('newRoomBtn');
const roomModal = document.getElementById('roomModal');
const createRoomBtn = document.getElementById('createRoomBtn');
const cancelRoomBtn = document.getElementById('cancelRoomBtn');
const roomNameInput = document.getElementById('roomNameInput');
const roomDescInput = document.getElementById('roomDescInput');

const roomsList = document.getElementById('roomsList');
const searchInput = document.getElementById('searchInput');

const roomTitle = document.getElementById('roomTitle');
const roomMeta = document.getElementById('roomMeta');

const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const fileInput = document.getElementById('fileInput');

// helpers
function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function fmtTime(ts){
  const d = new Date(ts);
  return d.toLocaleString();
}

// AUTH: anonymous sign-in then load/save profile
async function signInAnonymously(){
  const stored = localStorage.getItem('profile');
  try{
    const userCred = await auth.signInAnonymously();
    currentUser = userCred.user;
    // presence
    setupPresence(currentUser.uid);
    // load or create profile
    if(stored){
      const p = JSON.parse(stored);
      await saveProfileToDb(currentUser.uid, p);
      applyProfile(p);
    } else {
      // try get from DB
      usersRef.child(currentUser.uid).once('value', snap=>{
        if(snap.exists()){
          const p = snap.val();
          localStorage.setItem('profile', JSON.stringify(p));
          applyProfile(p);
        } else {
          // default profile
          const def = {nick: 'User' + currentUser.uid.slice(0,5), avatar:'', uid: currentUser.uid};
          localStorage.setItem('profile', JSON.stringify(def));
          saveProfileToDb(currentUser.uid, def);
          applyProfile(def);
        }
      });
    }
  }catch(e){
    console.error('auth error', e);
    alert('Ошибка аутентификации: ' + e.message);
  }
}

// presence
function setupPresence(uid){
  const userStatusDatabaseRef = statusRef.child(uid);

  const isOfflineForDatabase = { online: false, last_changed: firebase.database.ServerValue.TIMESTAMP };
  const isOnlineForDatabase = { online: true, last_changed: firebase.database.ServerValue.TIMESTAMP };

  const conRef = db.ref(".info/connected");
  conRef.on("value", function(snapshot) {
    if (snapshot.val() === false) {
      return;
    }
    userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(function() {
      userStatusDatabaseRef.set(isOnlineForDatabase);
    });
  });
}

// profile handling
function applyProfile(p){
  profileName.textContent = p.nick || 'Гость';
  profileAvatar.src = p.avatar || defaultAvatar(p.nick);
  nickInput.value = p.nick || '';
}
function defaultAvatar(text){
  // simple letter avatar as data url (use text as fallback)
  const letter = (text||'U')[0].toUpperCase();
  // tiny svg
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1f2937" width="100%" height="100%"/><text x="50%" y="55%" fill="#E6EEF8" font-size="96" text-anchor="middle" font-family="Arial">${letter}</text></svg>`);
}

async function saveProfileToDb(uid, profile){
  profile.uid = uid;
  return usersRef.child(uid).set(profile);
}

// profile modal events
editProfileBtn.addEventListener('click', ()=> profileModal.classList.remove('hidden'));
cancelProfileBtn.addEventListener('click', ()=> profileModal.classList.add('hidden'));

saveProfileBtn.addEventListener('click', async ()=>{
  const nick = nickInput.value.trim() || ('User' + (currentUser? currentUser.uid.slice(0,5) : Math.random().toString(36).slice(2,7)));
  const file = avatarInput.files[0];
  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  profile.nick = nick;

  if(file && currentUser){
    const ref = storage.ref().child('avatars/' + currentUser.uid + '/' + Date.now() + '_' + file.name);
    const snap = await ref.put(file);
    const url = await snap.ref.getDownloadURL();
    profile.avatar = url;
  }

  localStorage.setItem('profile', JSON.stringify(profile));
  if(currentUser) await saveProfileToDb(currentUser.uid, profile);
  applyProfile(profile);
  profileModal.classList.add('hidden');
});

// new room modal
newRoomBtn.addEventListener('click', ()=> roomModal.classList.remove('hidden'));
cancelRoomBtn.addEventListener('click', ()=> roomModal.classList.add('hidden'));

createRoomBtn.addEventListener('click', async ()=>{
  const name = roomNameInput.value.trim();
  if(!name) return alert('Введите имя чата');
  const desc = roomDescInput.value.trim() || '';
  const owner = currentUser ? currentUser.uid : 'anon';
  const room = {
    name,
    desc,
    owner,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };
  const newRoomRef = roomsRef.push();
  await newRoomRef.set(room);
  roomModal.classList.add('hidden');
  roomNameInput.value = roomDescInput.value = '';
});

// load rooms and render
roomsRef.on('value', snapshot=>{
  const rooms = snapshot.val() || {};
  renderRooms(rooms);
});

function renderRooms(roomsObj){
  const q = searchInput.value.trim().toLowerCase();
  roomsList.innerHTML = '';
  const rooms = Object.entries(roomsObj)
    .map(([id,room]) => ({id, ...room}))
    .filter(r => r.name.toLowerCase().includes(q))
    .sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  rooms.forEach(r => {
    const li = el('li','room-item');
    const thumb = el('div','room-thumb');
    thumb.textContent = r.name[0]?.toUpperCase() || '#';
    const info = el('div','room-info');
    const title = el('div','room-title'); title.textContent = r.name;
    const meta = el('div','room-meta'); meta.textContent = r.desc || `создано ${new Date(r.createdAt||Date.now()).toLocaleString()}`;
    info.appendChild(title); info.appendChild(meta);

    const right = el('div','room-right');
    const onlineBadge = el('div','room-meta'); onlineBadge.textContent = '...';
    right.appendChild(onlineBadge);

    // delete button if owner
    if(currentUser && r.owner === currentUser.uid){
      const del = el('button'); del.textContent = 'Удалить'; del.style.marginLeft = '8px';
      del.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        if(confirm('Удалить чат? Все сообщения будут удалены.')) {
          roomsRef.child(r.id).remove();
        }
      });
      right.appendChild(del);
    }

    li.appendChild(thumb); li.appendChild(info); li.appendChild(right);
    li.addEventListener('click', ()=> openRoom(r.id, r));
    roomsList.appendChild(li);

    // subscribe online count for room (simple: count unique users who have status online and are active in room)
    // For simplicity we listen to /status and show total online users (not room-specific)
    statusRef.on('value', snap=>{
      const s = snap.val() || {};
      const onlineCount = Object.values(s).filter(x=>x && x.online).length;
      onlineBadge.textContent = onlineCount + ' online';
    });
  });

  if(rooms.length === 0){
    const placeholder = el('div'); placeholder.textContent = 'Чатов нет — создайте первый 🎉'; placeholder.style.padding='10px'; roomsList.appendChild(placeholder);
  }
}

searchInput.addEventListener('input', ()=> roomsRef.once('value').then(snap=> renderRooms(snap.val()||{})));

// open room
let messagesListener = null;
async function openRoom(roomId, room){
  currentRoomId = roomId;
  roomTitle.textContent = room.name;
  roomMeta.textContent = room.desc || '';

  // clear messages
  messagesEl.innerHTML = '';

  // listen messages
  if(messagesListener) messagesListener.off();
  const msgsRef = roomsRef.child(roomId).child('messages');
  messagesListener = msgsRef;
  msgsRef.on('value', snapshot=>{
    const msgs = snapshot.val() || {};
    renderMessages(msgs);
    // scroll
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// render messages
function renderMessages(msgsObj){
  messagesEl.innerHTML = '';
  const msgs = Object.entries(msgsObj).map(([id,m])=> ({id, ...m})).sort((a,b)=> a.ts - b.ts);
  msgs.forEach(m=>{
    const msgEl = el('div','message');
    if(currentUser && m.uid === currentUser.uid) msgEl.classList.add('self');

    const avatar = el('img','avatar'); avatar.src = m.avatar || defaultAvatar(m.nick || 'U');
    avatar.className = 'avatar';

    const bubble = el('div','bubble');
    bubble.innerHTML = `<strong>${escapeHtml(m.nick||'Anon')}</strong><div>${escapeHtml(m.text||'')}</div><div class="meta">${fmtTime(m.ts)}</div>`;

    msgEl.appendChild(avatar);
    msgEl.appendChild(bubble);
    messagesEl.appendChild(msgEl);
  });
}

// helper escape
function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// send message
messageForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentRoomId) return alert('Выберите чат');
  const text = messageInput.value.trim();
  const file = fileInput.files[0];
  if(!text && !file) return;

  const profile = JSON.parse(localStorage.getItem('profile') || '{}');
  const msg = {
    uid: currentUser.uid,
    nick: profile.nick || ('User' + currentUser.uid.slice(0,5)),
    avatar: profile.avatar || '',
    text: text || '',
    ts: Date.now()
  };

  const msgsRef = roomsRef.child(currentRoomId).child('messages');
  if(file){
    // upload file and attach URL instead of text
    const ref = storage.ref().child('rooms/' + currentRoomId + '/' + Date.now() + '_' + file.name);
    const snap = await ref.put(file);
    const url = await snap.ref.getDownloadURL();
    msg.text = '[изображение]';
    msg.image = url;
  }

  const newMsgRef = msgsRef.push();
  await newMsgRef.set(msg);
  messageInput.value = '';
  fileInput.value = '';
});

// show chat image if present (small enhancement)
messagesEl.addEventListener('click', (e)=>{
  const img = e.target.closest('img');
  if(img && img.dataset.full) {
    window.open(img.dataset.full, '_blank');
  }
});

// bootstrap
auth.onAuthStateChanged(user=>{
  if(user){
    currentUser = user;
    signInAnonymously(); // ensures profile and presence
  } else {
    signInAnonymously();
  }
});

// utility: load initial profile apply
(function initFromLocal(){
  const p = JSON.parse(localStorage.getItem('profile') || '{}');
  if(p && p.nick) applyProfile(p);
  else profileAvatar.src = defaultAvatar('G');
})();

// small UX: clicking avatar opens profile modal
profileAvatar.addEventListener('click', ()=> profileModal.classList.remove('hidden'));

// simple periodic refresh of rooms last message preview (could be improved)
setInterval(()=> roomsRef.once('value').then(snap=> renderRooms(snap.val()||{})), 5000);

// small helper to support showing image messages (modify renderMessages to handle)
function renderMessages(msgsObj){
  messagesEl.innerHTML = '';
  const msgs = Object.entries(msgsObj).map(([id,m])=> ({id, ...m})).sort((a,b)=> a.ts - b.ts);
  msgs.forEach(m=>{
    const msgEl = el('div','message');
    if(currentUser && m.uid === currentUser.uid) msgEl.classList.add('self');

    const avatar = el('img'); avatar.className = 'avatar'; avatar.src = m.avatar || defaultAvatar(m.nick || 'U');

    const bubble = el('div','bubble');
    const nickHtml = `<strong>${escapeHtml(m.nick||'Anon')}</strong>`;
    const textHtml = m.text ? `<div>${escapeHtml(m.text)}</div>` : '';
    const imageHtml = m.image ? `<div style="margin-top:8px"><img src="${m.image}" style="max-width:240px;border-radius:8px;cursor:pointer" data-full="${m.image}" /></div>` : '';
    const metaHtml = `<div class="meta">${fmtTime(m.ts)}</div>`;
    bubble.innerHTML = nickHtml + textHtml + imageHtml + metaHtml;

    msgEl.appendChild(avatar);
    msgEl.appendChild(bubble);
    messagesEl.appendChild(msgEl);
  });
                        }
