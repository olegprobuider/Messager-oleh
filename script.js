const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

let currentUser = null;
let currentRoom = null;

const roomsRef = db.ref("rooms");
const usersRef = db.ref("users");

const messagesEl = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const messageForm = document.getElementById("messageForm");
const fileInput = document.getElementById("fileInput");
const roomsList = document.getElementById("roomsList");
const roomTitle = document.getElementById("roomTitle");

firebase.auth().signInAnonymously();

firebase.auth().onAuthStateChanged(user=>{
  if(!user) return;
  currentUser = user;

  usersRef.child(user.uid).once("value").then(snap=>{
    if(!snap.exists()){
      usersRef.child(user.uid).set({
        nick: "User"+user.uid.slice(0,5),
        avatar: ""
      });
    }
  });
});

function defaultAvatar(text){
  const l = (text||"U")[0].toUpperCase();
  return `https://ui-avatars.com/api/?name=${l}&background=6C63FF&color=fff`;
}

roomsRef.on("value", snap=>{
  roomsList.innerHTML="";
  const rooms = snap.val()||{};
  for(let id in rooms){
    const li=document.createElement("li");
    li.textContent=rooms[id].name;
    li.onclick=()=>openRoom(id, rooms[id].name);
    roomsList.appendChild(li);
  }
});

function openRoom(id,name){
  currentRoom=id;
  roomTitle.textContent=name;
  messagesEl.innerHTML="";

  roomsRef.child(id+"/messages").off();
  roomsRef.child(id+"/messages").on("value", snap=>{
    messagesEl.innerHTML="";
    const msgs=snap.val()||{};
    for(let mid in msgs){
      renderMessage(msgs[mid]);
    }
    messagesEl.scrollTop=messagesEl.scrollHeight;
  });
}

function renderMessage(m){
  const div=document.createElement("div");
  div.className="message";

  const img=document.createElement("img");
  img.className="avatar";
  img.src=m.avatar || defaultAvatar(m.nick);

  const bubble=document.createElement("div");
  bubble.className="bubble";
  bubble.innerHTML=`<b style="cursor:pointer;color:#6C63FF" onclick="openPrivate('${m.uid}','${m.nick}')">${m.nick}</b><br>${m.text||""}`;

  if(m.image){
    const im=document.createElement("img");
    im.src=m.image;
    im.style.maxWidth="200px";
    bubble.appendChild(im);
  }

  div.appendChild(img);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
}

messageForm.onsubmit=async e=>{
  e.preventDefault();
  if(!currentRoom) return alert("Выбери чат");

  const text=messageInput.value;
  const file=fileInput.files[0];

  const userSnap=await usersRef.child(currentUser.uid).get();
  const profile=userSnap.val();

  const msg={
    uid:currentUser.uid,
    nick:profile.nick,
    avatar:profile.avatar,
    text:text,
    time:Date.now()
  };

  if(file){
    const ref=storage.ref("rooms/"+currentRoom+"/"+Date.now()+"_"+file.name);
    const snap=await ref.put(file);
    msg.image=await snap.ref.getDownloadURL();
    msg.text="";
  }

  roomsRef.child(currentRoom+"/messages").push(msg);
  messageInput.value="";
  fileInput.value="";
};

window.openPrivate=function(uid,nick){
  const id=[currentUser.uid,uid].sort().join("_");
  const ref=db.ref("private/"+id);

  ref.once("value",s=>{
    if(!s.exists()){
      ref.set({name:"ЛС с "+nick});
    }
    openPrivateRoom(id,nick);
  });
}

function openPrivateRoom(id,nick){
  currentRoom="private/"+id;
  roomTitle.textContent="ЛС с "+nick;
  messagesEl.innerHTML="";

  db.ref(currentRoom+"/messages").on("value",snap=>{
    messagesEl.innerHTML="";
    const msgs=snap.val()||{};
    for(let m in msgs) renderMessage(msgs[m]);
  });
}
