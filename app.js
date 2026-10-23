// Firebase Config & Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged, sendEmailVerification,
  GoogleAuthProvider, signInWithPopup, updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, 
  serverTimestamp, doc, setDoc, deleteDoc, getDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA8iUv0uhGfF8y0lZOBCT8H-YHE5ahHDcA",
  authDomain: "chat-application-51377.firebaseapp.com",
  projectId: "chat-application-51377",
  storageBucket: "chat-application-51377.firebasestorage.app",
  messagingSenderId: "768565053963",
  appId: "1:768565053963:web:70e65317c0772e7569950e",
  measurementId: "G-E31DD6RZPP"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Firebase initialization warning.");
}

const CLOUDINARY_CLOUD_NAME = "cxxjd9vz";
const CLOUDINARY_UPLOAD_PRESET = "Mulaqat";

let currentUser = null;
let isGuestMode = false; // Dedicated flag for Guest Mode isolation
let currentChatMode = 'global';
let activeDirectUser = null;
let activeGroup = null;
let selectedFile = null;
let isUserActive = true;
let blockedUsersList = [];
let mutedUsersList = [];
let searchQuery = "";
let selectedMemberFilter = "all";

// Real Voice Recording Variables
let mediaRecorder = null;
let audioChunks = [];
let isRecordingAudio = false;

// WebRTC State
let localStream = null;
let peerConnection = null;
const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ]
};

let mockGroups = [
  { id: 'group_1', name: 'Tech Geeks 🚀', members: ['Zainab', 'Ali', 'Hamza', 'Usman'] },
  { id: 'group_2', name: 'Poetry & Coffee ☕', members: ['Ayesha', 'Bilal', 'Sara'] }
];

// Universal Theme Palette & Light/Dark Mode Handlers
window.setPalette = function(palette) {
  document.documentElement.setAttribute('data-theme', palette);
  document.getElementById('themeDropdownLanding')?.classList.add('hidden');
  document.getElementById('themeDropdownChat')?.classList.add('hidden');
};

window.toggleThemeDropdown = function(id) {
  document.getElementById(id)?.classList.toggle('hidden');
};

window.toggleDarkLightMode = function() {
  const html = document.documentElement;
  const icons = document.querySelectorAll('.modeIconGlobal');
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    icons.forEach(icon => icon.className = 'fa-solid fa-sun text-amber-500 text-xs sm:text-sm modeIconGlobal');
  } else {
    html.classList.add('dark');
    icons.forEach(icon => icon.className = 'fa-solid fa-moon text-slate-200 text-xs sm:text-sm modeIconGlobal');
  }
};

function initCanvasAnimation() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 55 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2.5 + 1.5,
    vx: (Math.random() - 0.5) * 0.7,
    vy: (Math.random() - 0.5) * 0.7
  }));

  function animate() {
    ctx.clearRect(0, 0, width, height);
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.2)';

    particles.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      for (let j = index + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (dist < 140) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
}

async function uploadToCloudinary(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
  } catch (err) {
    console.warn("Cloudinary upload fallback to Data URL.");
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Built-in Avatar Selection Helper
window.selectPresetAvatar = function(type, url) {
  if (type === 'signup') {
    document.getElementById('signupAvatarPreview').src = url;
    tempSignupPicUrl = url;
    tempSignupPicFile = null;
  } else {
    document.getElementById('editAvatarPreview').src = url;
    tempEditPicUrl = url;
    tempEditPicFile = null;
  }
};

let tempSignupPicUrl = null;
let tempEditPicUrl = null;

async function registerUserInDB(user) {
  if (!db || isGuestMode || user.uid.startsWith('guest_')) return;
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        status: isUserActive ? 'online' : 'offline',
        blockedUsers: [],
        mutedUsers: [],
        lastSeen: serverTimestamp()
      });
    } else {
      const uData = snap.data();
      blockedUsersList = uData.blockedUsers || [];
      mutedUsersList = uData.mutedUsers || [];
      if (uData.displayName) currentUser.displayName = uData.displayName;
      if (uData.photoURL) currentUser.photoURL = uData.photoURL;
      await updateDoc(userRef, { status: isUserActive ? 'online' : 'offline', lastSeen: serverTimestamp() });
    }
  } catch (err) {
    console.log("Database Register Error:", err);
  }
}

// COMPLETE FIX FOR GUEST MODE SESSION OVERWRITE
document.getElementById('guestNavBtn')?.addEventListener('click', async () => {
  if (auth && auth.currentUser) {
    await signOut(auth); // Sign out any existing logged-in user session
  }
  
  isGuestMode = true; // Set Guest Mode Flag to TRUE
  const guestId = Math.floor(1000 + Math.random() * 9000);
  currentUser = {
    uid: 'guest_' + guestId,
    displayName: 'Guest User #' + guestId,
    email: 'guest' + guestId + '@aadhimulaqaat.app',
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=Guest${guestId}`
  };
  blockedUsersList = [];
  mutedUsersList = [];
  launchChatApp();
});

// Create Group Modal Prompt
window.createNewGroupPrompt = async function() {
  const { value: groupName } = await Swal.fire({
    title: 'Create Group Community',
    input: 'text',
    inputPlaceholder: 'Group Name...',
    showCancelButton: true,
    confirmButtonText: 'Create',
    background: '#1e293b', color: '#fff', confirmButtonColor: '#10b981'
  });

  if (groupName) {
    const newGroup = {
      id: 'group_' + Date.now(),
      name: groupName,
      members: [currentUser.displayName, 'Ali', 'Zainab']
    };
    mockGroups.push(newGroup);
    listenToActiveUsers();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Group Created!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
  }
};

// Working Invite Friends Action Button
document.getElementById('inviteFriendsBtn')?.addEventListener('click', async () => {
  const link = window.location.origin + window.location.pathname;
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Invite Link Copied!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
    } else {
      throw new Error();
    }
  } catch (err) {
    Swal.fire({
      title: 'Invite Friends 🚀',
      text: 'Copy this link to invite:',
      input: 'text',
      inputValue: link,
      background: '#1e293b', color: '#fff'
    });
  }
});

window.openModal = (id) => document.getElementById(id)?.classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id)?.classList.add('hidden');
window.switchModal = (from, to) => { closeModal(from); openModal(to); };

document.getElementById('openLoginBtn')?.addEventListener('click', () => openModal('loginModal'));
document.getElementById('openSignupBtn')?.addEventListener('click', () => openModal('signupModal'));

if (auth) {
  onAuthStateChanged(auth, async (user) => {
    // Only launch auth state user if Guest Mode is NOT active
    if (user && user.emailVerified && !isGuestMode) {
      currentUser = {
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`
      };
      await registerUserInDB(currentUser);
      launchChatApp();
    }
  });
}

function launchChatApp() {
  document.getElementById('landingView')?.classList.add('hidden');
  document.getElementById('chatAppView')?.classList.remove('hidden');
  
  if (document.getElementById('userName')) document.getElementById('userName').innerText = currentUser.displayName;
  if (document.getElementById('userEmail')) document.getElementById('userEmail').innerText = currentUser.email;
  if (document.getElementById('userAvatar')) document.getElementById('userAvatar').src = currentUser.photoURL;
  if (document.getElementById('editAvatarPreview')) document.getElementById('editAvatarPreview').src = currentUser.photoURL;
  if (document.getElementById('editProfileName')) document.getElementById('editProfileName').value = currentUser.displayName;

  updateActiveNavTab('navGlobalChat');
  listenToActiveUsers();
  listenToMessages();
  listenToRealtimeStatuses();
}

let tempSignupPicFile = null;
document.getElementById('signupPicFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    tempSignupPicFile = file;
    tempSignupPicUrl = null;
    const reader = new FileReader();
    reader.onload = (ev) => document.getElementById('signupAvatarPreview').src = ev.target.result;
    reader.readAsDataURL(file);
  }
});

let tempEditPicFile = null;
document.getElementById('editPicFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    tempEditPicFile = file;
    tempEditPicUrl = null;
    const reader = new FileReader();
    reader.onload = (ev) => document.getElementById('editAvatarPreview').src = ev.target.result;
    reader.readAsDataURL(file);
  }
});

document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn.innerText = "Saving...";
  saveBtn.disabled = true;

  const newName = document.getElementById('editProfileName').value.trim();
  const newBio = document.getElementById('editProfileBio').value.trim();
  if (!newName) return;

  try {
    let newAvatarUrl = currentUser.photoURL;
    if (tempEditPicFile) {
      newAvatarUrl = await uploadToCloudinary(tempEditPicFile);
    } else if (tempEditPicUrl) {
      newAvatarUrl = tempEditPicUrl;
    }

    currentUser.displayName = newName;
    currentUser.photoURL = newAvatarUrl;

    document.getElementById('userName').innerText = newName;
    document.getElementById('userAvatar').src = newAvatarUrl;

    if (db && currentUser.uid && !currentUser.uid.startsWith('guest_')) {
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: newName,
        photoURL: newAvatarUrl,
        bio: newBio
      });
    }

    if (auth && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: newName, photoURL: newAvatarUrl });
    }

    closeModal('editProfileModal');
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Profile Updated Successfully!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Update Failed', text: err.message, background: '#1e293b', color: '#fff' });
  } finally {
    saveBtn.innerText = "Save Changes";
    saveBtn.disabled = false;
  }
});

async function handleGoogleAuth() {
  if (!auth) return;
  try {
    isGuestMode = false;
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    currentUser = {
      uid: result.user.uid,
      displayName: result.user.displayName || result.user.email.split('@')[0],
      email: result.user.email,
      photoURL: result.user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.email}`
    };
    await registerUserInDB(currentUser);
    closeModal('signupModal');
    closeModal('loginModal');
    launchChatApp();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Google Auth Failed', text: err.message, background: '#1e293b', color: '#fff' });
  }
}

document.getElementById('googleAuthBtnSignup')?.addEventListener('click', handleGoogleAuth);
document.getElementById('googleAuthBtnLogin')?.addEventListener('click', handleGoogleAuth);

// Three-Dots Chat Menu Options
document.getElementById('chatOptionsMenuBtn')?.addEventListener('click', () => {
  if (!activeDirectUser) return;
  const isBlocked = blockedUsersList.includes(activeDirectUser.uid);
  const isMuted = mutedUsersList.includes(activeDirectUser.uid);

  Swal.fire({
    title: activeDirectUser.displayName,
    text: 'Select action:',
    showCancelButton: true,
    confirmButtonText: isBlocked ? 'Unblock' : 'Block',
    denyButtonText: isMuted ? 'Unmute' : 'Mute',
    cancelButtonText: 'Clear Chat',
    showDenyButton: true,
    confirmButtonColor: '#ef4444',
    denyButtonColor: '#f59e0b',
    cancelButtonColor: '#6366f1',
    background: '#1e293b', color: '#fff'
  }).then(async (result) => {
    if (!currentUser.uid.startsWith('guest_') && db) {
      const userRef = doc(db, "users", currentUser.uid);
      if (result.isConfirmed) {
        if (isBlocked) {
          await updateDoc(userRef, { blockedUsers: arrayRemove(activeDirectUser.uid) });
          blockedUsersList = blockedUsersList.filter(id => id !== activeDirectUser.uid);
        } else {
          await updateDoc(userRef, { blockedUsers: arrayUnion(activeDirectUser.uid) });
          blockedUsersList.push(activeDirectUser.uid);
        }
      } else if (result.isDenied) {
        if (isMuted) {
          await updateDoc(userRef, { mutedUsers: arrayRemove(activeDirectUser.uid) });
          mutedUsersList = mutedUsersList.filter(id => id !== activeDirectUser.uid);
        } else {
          await updateDoc(userRef, { mutedUsers: arrayUnion(activeDirectUser.uid) });
          mutedUsersList.push(activeDirectUser.uid);
        }
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        document.getElementById('messagesContainer').innerHTML = `<div class="text-center text-xs theme-subtext p-4">Chat cleared locally.</div>`;
      }
    }
  });
});

window.toggleEmojiPicker = function() {
  document.getElementById('emojiPickerPopup')?.classList.toggle('hidden');
};

document.getElementById('emojiBtn')?.addEventListener('click', toggleEmojiPicker);

document.getElementById('emojiGrid')?.addEventListener('click', (e) => {
  if (e.target.tagName === 'SPAN') {
    const input = document.getElementById('messageInput');
    input.value += e.target.innerText;
    document.getElementById('emojiPickerPopup')?.classList.add('hidden');
    input.focus();
  }
});

window.togglePollCreator = function(show) {
  const box = document.getElementById('pollCreatorBox');
  if (show) box?.classList.remove('hidden');
  else box?.classList.add('hidden');
};

document.getElementById('pollBtn')?.addEventListener('click', () => togglePollCreator(true));

window.submitLivePoll = async function() {
  const q = document.getElementById('pollQuestionInput')?.value;
  const o1 = document.getElementById('pollOpt1Input')?.value;
  const o2 = document.getElementById('pollOpt2Input')?.value;

  if (!q || !o1 || !o2) return;

  const pollData = {
    type: 'poll',
    question: q,
    options: [o1, o2],
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    senderPhoto: currentUser.photoURL,
    receiverId: currentChatMode === 'ai' ? currentUser.uid : (currentChatMode === 'direct' ? activeDirectUser?.uid : 'global'),
    mode: currentChatMode,
    timestamp: serverTimestamp()
  };

  if (db) await addDoc(collection(db, "messages"), pollData);
  togglePollCreator(false);
};

// Voice Note Media Recorder
document.getElementById('voiceMsgBtn')?.addEventListener('click', async () => {
  const micIcon = document.getElementById('micIcon');
  if (!isRecordingAudio) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], "voice.webm", { type: 'audio/webm' });
        const fileUrl = await uploadToCloudinary(audioFile);

        const audioMsg = {
          type: 'audio',
          fileUrl: fileUrl || 'https://www.w3schools.com/html/horse.mp3',
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          receiverId: currentChatMode === 'ai' ? currentUser.uid : (currentChatMode === 'direct' ? activeDirectUser?.uid : 'global'),
          mode: currentChatMode,
          timestamp: serverTimestamp()
        };
        if (db) await addDoc(collection(db, "messages"), audioMsg);
      };
      mediaRecorder.start();
      isRecordingAudio = true;
      micIcon.className = 'fa-solid fa-microphone text-rose-500 animate-pulse text-sm sm:text-base';
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Mic Error', text: 'Microphone permission required.', background: '#1e293b', color: '#fff' });
    }
  } else {
    if (mediaRecorder) mediaRecorder.stop();
    isRecordingAudio = false;
    micIcon.className = 'fa-solid fa-microphone text-sm sm:text-base';
  }
});

document.getElementById('changeWallpaperBtn')?.addEventListener('click', () => {
  Swal.fire({
    title: 'Chat Wallpaper',
    text: 'Enter image URL or leave empty:',
    input: 'text',
    showCancelButton: true,
    confirmButtonText: 'Set',
    background: '#1e293b', color: '#fff'
  }).then((res) => {
    const container = document.getElementById('messagesContainer');
    if (res.isConfirmed && res.value) container.style.backgroundImage = `url('${res.value}')`;
    else container.style.backgroundImage = 'none';
  });
});

document.getElementById('chatSearchInput')?.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  listenToMessages();
});

document.getElementById('groupMemberFilter')?.addEventListener('change', (e) => {
  selectedMemberFilter = e.target.value;
  listenToMessages();
});

function updateActiveNavTab(activeId) {
  const defaultTabClass = "w-full px-3.5 py-2.5 rounded-2xl font-medium text-xs sm:text-sm flex items-center gap-3 theme-subtext hover:bg-black/10 dark:hover:bg-white/10 transition-all";
  const activeTabClass = "w-full px-3.5 py-2.5 rounded-2xl font-medium text-xs sm:text-sm flex items-center gap-3 active-nav-tab transition-all";
  
  ['navGlobalChat', 'navDirectDm', 'navGroups', 'navStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = (id === activeId) ? activeTabClass : defaultTabClass;
  });

  const mainChat = document.getElementById('chatMainPanel');
  const statusPanel = document.getElementById('statusViewPanel');
  if (activeId === 'navStatus') {
    mainChat.classList.add('hidden');
    statusPanel.classList.remove('hidden');
    listenToRealtimeStatuses();
  } else {
    mainChat.classList.remove('hidden');
    statusPanel.classList.add('hidden');
  }
}

function listenToActiveUsers() {
  const usersContainer = document.getElementById('activeUsersList');
  const title = document.getElementById('directoryTitle');
  if (!usersContainer) return;

  if (currentChatMode === 'direct') {
    title.innerText = "Active Users";
    if (!db) return;
    onSnapshot(collection(db, "users"), (snapshot) => {
      usersContainer.innerHTML = '';
      snapshot.forEach((docSnap) => {
        const uData = docSnap.data();
        if (uData.uid !== currentUser.uid) {
          const uItem = document.createElement('div');
          uItem.className = `p-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10 ${activeDirectUser?.uid === uData.uid ? 'theme-btn-primary text-white' : ''}`;
          uItem.innerHTML = `
            <div class="relative">
              <img src="${uData.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=User'}" class="w-7 h-7 rounded-full border theme-border object-cover">
              <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full ${uData.status === 'offline' ? 'bg-slate-500' : 'bg-emerald-500'}"></span>
            </div>
            <span class="text-xs font-semibold truncate">${uData.displayName}</span>
          `;
          uItem.onclick = () => selectDirectUser(uData);
          usersContainer.appendChild(uItem);
        }
      });
    });
  } else if (currentChatMode === 'groups') {
    title.innerText = "Group Chats";
    usersContainer.innerHTML = `<button onclick="createNewGroupPrompt()" class="w-full py-1.5 px-3 rounded-xl theme-btn-primary text-white text-xs font-bold mb-2 flex items-center justify-center gap-1.5"><i class="fa-solid fa-plus"></i> Create Group</button>`;
    mockGroups.forEach(g => {
      const gItem = document.createElement('div');
      gItem.className = `p-2 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10 ${activeGroup?.id === g.id ? 'theme-btn-primary text-white' : ''}`;
      gItem.innerHTML = `
        <div class="w-7 h-7 rounded-full theme-btn-primary text-white flex items-center justify-center font-bold text-xs">#</div>
        <div class="truncate"><div class="text-xs font-semibold truncate">${g.name}</div></div>
      `;
      gItem.onclick = () => selectGroup(g);
      usersContainer.appendChild(gItem);
    });
  }
}

function selectDirectUser(userObj) {
  activeDirectUser = userObj;
  document.getElementById('chatRoomTitle').innerText = userObj.displayName;
  document.getElementById('chatRoomSub').innerText = "Private 1-on-1 Direct Chat";
  document.getElementById('chatOptionsMenuBtn').classList.remove('hidden');
  document.getElementById('groupMemberFilter').classList.add('hidden');
  listenToActiveUsers();
  listenToMessages();
}

function selectGroup(gObj) {
  activeGroup = gObj;
  document.getElementById('chatRoomTitle').innerText = gObj.name;
  document.getElementById('chatRoomSub').innerText = `${gObj.members.length} members`;
  document.getElementById('chatOptionsMenuBtn').classList.add('hidden');
  listenToActiveUsers();
  listenToMessages();
}

function listenToMessages() {
  const container = document.getElementById('messagesContainer');
  if (!container || !db) return;

  const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));

  onSnapshot(q, (snapshot) => {
    container.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const msgId = docSnap.id;

      if (msg.senderId && blockedUsersList.includes(msg.senderId)) return;
      if (searchQuery && msg.text && !msg.text.toLowerCase().includes(searchQuery)) return;

      let isVisible = false;

      if (currentChatMode === 'global' && msg.mode === 'global') {
        isVisible = true;
      } else if (currentChatMode === 'direct' && msg.mode === 'direct' && activeDirectUser) {
        if ((msg.senderId === currentUser.uid && msg.receiverId === activeDirectUser.uid) ||
            (msg.senderId === activeDirectUser.uid && msg.receiverId === currentUser.uid)) {
          isVisible = true;
        }
      } else if (currentChatMode === 'ai' && msg.mode === 'ai') {
        if (msg.receiverId === currentUser.uid || msg.senderId === currentUser.uid) {
          isVisible = true;
        }
      } else if (currentChatMode === 'groups' && msg.mode === 'groups') {
        isVisible = true;
      }

      if (isVisible) {
        const isMe = msg.senderId === currentUser.uid;
        const bubble = document.createElement('div');
        bubble.id = `msg-${msgId}`;
        bubble.className = `flex gap-2.5 mb-3.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} group`;

        let contentHtml = msg.text ? `<div>${msg.text}</div>` : '';
        if (msg.type === 'audio' || msg.fileType === 'audio') {
          contentHtml = `<audio controls src="${msg.fileUrl}" style="height:35px; width:200px;"></audio>`;
        } else if (msg.fileUrl) {
          if (msg.fileType === 'image') {
            contentHtml += `<img src="${msg.fileUrl}" class="max-w-xs rounded-xl mt-2 border theme-border shadow-md">`;
          } else {
            contentHtml += `<a href="${msg.fileUrl}" target="_blank" class="inline-flex items-center gap-2 text-xs theme-accent-text hover:underline mt-2"><i class="fa-solid fa-file"></i> Attachment</a>`;
          }
        }

        bubble.innerHTML = `
          <img src="${msg.senderPhoto || 'https://api.dicebear.com/7.x/bottts/svg?seed=User'}" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border theme-border self-end object-cover">
          <div class="p-3 rounded-2xl text-xs sm:text-sm relative ${isMe ? 'theme-btn-primary text-white font-medium rounded-br-none shadow-md' : 'theme-card-bg theme-text rounded-bl-none border theme-border'}">
            <div class="flex justify-between items-center gap-4 mb-1">
              <span class="text-[10px] font-bold opacity-80">${msg.senderName}</span>
            </div>
            ${contentHtml}
          </div>
        `;
        container.appendChild(bubble);
      }
    });
    container.scrollTop = container.scrollHeight;
  });
}

document.getElementById('chatForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('messageInput');
  const text = input.value.trim();

  if (!text && !selectedFile) return;

  let fileUrl = null;
  let fileType = null;

  if (selectedFile) {
    fileUrl = await uploadToCloudinary(selectedFile);
    fileType = selectedFile.type.split('/')[0];
  }

  const msgData = {
    senderId: currentUser.uid,
    senderName: currentUser.displayName,
    senderPhoto: currentUser.photoURL,
    receiverId: currentChatMode === 'ai' ? currentUser.uid : (currentChatMode === 'direct' ? activeDirectUser?.uid : 'global'),
    text: text,
    fileUrl: fileUrl,
    fileType: fileType,
    mode: currentChatMode,
    timestamp: serverTimestamp()
  };

  try {
    if (db) await addDoc(collection(db, "messages"), msgData);
    input.value = '';

    if (currentChatMode === 'ai' && text) {
      const currentUserId = currentUser.uid;
      setTimeout(async () => {
        const aiReply = {
          senderId: 'mulaqaat_ai',
          senderName: 'Mulaqaat AI ✨',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=AI',
          receiverId: currentUserId,
          text: `I received your message: "${text}". How can I help you further? 🤖`,
          mode: 'ai',
          timestamp: serverTimestamp()
        };
        if (db) await addDoc(collection(db, "messages"), aiReply);
      }, 1000);
    }
  } catch (err) {
    console.log("Message send error:", err);
  }
});

// Realtime 24h Expiring Status Stories
window.postMediaStatusPrompt = async function() {
  const { value: formValues } = await Swal.fire({
    title: 'Post New Status',
    html:
      '<input id="swal-status-text" class="swal2-input" placeholder="Caption/Text...">' +
      '<input id="swal-status-file" type="file" accept="image/*,video/*" class="swal2-file">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Post Status',
    background: '#1e293b', color: '#fff', confirmButtonColor: '#10b981',
    preConfirm: () => [document.getElementById('swal-status-text').value, document.getElementById('swal-status-file').files[0]]
  });

  if (formValues) {
    const [caption, file] = formValues;
    let mediaUrl = null;
    let mediaType = 'text';

    if (file) {
      mediaUrl = await uploadToCloudinary(file);
      mediaType = file.type.startsWith('video') ? 'video' : 'image';
    }

    const statusObj = {
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userPhoto: currentUser.photoURL,
      caption: caption || '',
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      createdAt: Date.now(),
      timestamp: serverTimestamp()
    };

    if (db && !currentUser.uid.startsWith('guest_')) {
      await addDoc(collection(db, "statuses"), statusObj);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Status Posted!', showConfirmButton: false, timer: 1500, background: '#1e293b', color: '#fff' });
    }
  }
};

function listenToRealtimeStatuses() {
  const grid = document.getElementById('statusGridContainer');
  if (!grid || !db) return;

  const q = query(collection(db, "statuses"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    grid.innerHTML = '';
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    snapshot.forEach((docSnap) => {
      const st = docSnap.data();
      const statusId = docSnap.id;

      if (now - st.createdAt > TWENTY_FOUR_HOURS) {
        deleteDoc(doc(db, "statuses", statusId));
        return;
      }

      const isMyStatus = st.userId === currentUser.uid;
      const card = document.createElement('div');
      card.className = 'theme-card-bg border theme-border rounded-2xl p-4 shadow-lg flex flex-col justify-between space-y-3 relative group';

      let mediaContent = '';
      if (st.mediaUrl) {
        if (st.mediaType === 'video') {
          mediaContent = `<video src="${st.mediaUrl}" controls class="w-full h-40 object-cover rounded-xl mt-2"></video>`;
        } else {
          mediaContent = `<img src="${st.mediaUrl}" class="w-full h-40 object-cover rounded-xl mt-2">`;
        }
      }

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full border-2 border-emerald-500 p-0.5 shrink-0">
              <img src="${st.userPhoto || 'https://api.dicebear.com/7.x/bottts/svg?seed=User'}" class="w-full h-full rounded-full object-cover">
            </div>
            <div>
              <h4 class="font-bold text-sm theme-text">${st.userName}</h4>
              <span class="text-[10px] theme-subtext">${timeAgo(st.createdAt)}</span>
            </div>
          </div>
          ${isMyStatus ? `<button onclick="deleteStatus('${statusId}')" class="text-rose-500 hover:text-rose-400 p-1 text-xs"><i class="fa-solid fa-trash-can"></i></button>` : ''}
        </div>
        ${st.caption ? `<p class="text-xs theme-text font-medium">${st.caption}</p>` : ''}
        ${mediaContent}
      `;
      grid.appendChild(card);
    });
  });
}

window.deleteStatus = async function(statusId) {
  if (db) await deleteDoc(doc(db, "statuses", statusId));
};

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// WebRTC Call Handlers
document.getElementById('startAudioCallBtn')?.addEventListener('click', () => startWebRTCCall(true));
document.getElementById('startVideoCallBtn')?.addEventListener('click', () => startWebRTCCall(false));

async function startWebRTCCall(isAudioOnly) {
  const peerName = activeDirectUser ? activeDirectUser.displayName : "Global Room Peer";
  document.getElementById('callPeerName').innerText = peerName;
  document.getElementById('callStatus').innerText = isAudioOnly ? "Starting Audio Call..." : "Starting Video Call...";
  openModal('callModal');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: !isAudioOnly, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    document.getElementById('callStatus').innerText = "Connected & Streaming (WebRTC)";
  } catch (err) {
    document.getElementById('callStatus').innerText = "Call Connected (Simulation Mode)";
  }
}

document.getElementById('endCallBtn')?.addEventListener('click', () => {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  if (peerConnection) peerConnection.close();
  closeModal('callModal');
});

document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!auth) return;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const name = document.getElementById('signupName').value;

  try {
    isGuestMode = false;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    let avatarUrl = tempSignupPicUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;
    if (tempSignupPicFile) avatarUrl = await uploadToCloudinary(tempSignupPicFile);
    await updateProfile(cred.user, { displayName: name, photoURL: avatarUrl });
    await sendEmailVerification(cred.user);
    document.getElementById('signupStep1')?.classList.add('hidden');
    document.getElementById('signupStep2')?.classList.remove('hidden');
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Sign Up Failed', text: err.message, background: '#1e293b', color: '#fff' });
  }
});

document.getElementById('finishProfileBtn')?.addEventListener('click', () => {
  closeModal('signupModal');
  openModal('loginModal');
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!auth) return;
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    isGuestMode = false;
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (!cred.user.emailVerified) {
      Swal.fire({ icon: 'warning', title: 'Verify Email', text: 'Please verify your email address before logging in.', background: '#1e293b', color: '#fff' });
      return;
    }
    closeModal('loginModal');
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Login Failed', text: err.message, background: '#1e293b', color: '#fff' });
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', () => {
  if (auth && auth.currentUser) signOut(auth);
  localStorage.clear();
  location.reload();
});

const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');

document.getElementById('openSidebarBtn')?.addEventListener('click', () => {
  sidebar?.classList.remove('-translate-x-full');
  mobileOverlay?.classList.remove('hidden');
});

document.getElementById('toggleSidebarBtn')?.addEventListener('click', () => {
  sidebar?.classList.add('-translate-x-full');
  mobileOverlay?.classList.add('hidden');
});

mobileOverlay?.addEventListener('click', () => {
  sidebar?.classList.add('-translate-x-full');
  mobileOverlay?.classList.add('hidden');
});

document.getElementById('navGlobalChat')?.addEventListener('click', () => {
  currentChatMode = 'global';
  activeDirectUser = null;
  document.getElementById('groupMemberFilter')?.classList.add('hidden');
  document.getElementById('chatOptionsMenuBtn')?.classList.add('hidden');
  updateActiveNavTab('navGlobalChat');
  document.getElementById('userDirectory')?.classList.add('hidden');
  document.getElementById('chatRoomTitle').innerText = "Global Lounge";
  document.getElementById('chatRoomSub').innerText = "Public chat room for everyone";
  listenToMessages();
});

document.getElementById('navDirectDm')?.addEventListener('click', () => {
  currentChatMode = 'direct';
  updateActiveNavTab('navDirectDm');
  document.getElementById('userDirectory')?.classList.remove('hidden');
  document.getElementById('chatRoomTitle').innerText = "Select a User";
  document.getElementById('chatRoomSub').innerText = "Choose an active user from sidebar";
  listenToActiveUsers();
  listenToMessages();
});

document.getElementById('navGroups')?.addEventListener('click', () => {
  currentChatMode = 'groups';
  document.getElementById('chatOptionsMenuBtn')?.classList.add('hidden');
  updateActiveNavTab('navGroups');
  document.getElementById('userDirectory')?.classList.remove('hidden');
  document.getElementById('chatRoomTitle').innerText = "Group Communities";
  document.getElementById('chatRoomSub').innerText = "Collaborate in group chats";
  listenToActiveUsers();
  listenToMessages();
});

document.getElementById('navStatus')?.addEventListener('click', () => {
  currentChatMode = 'status';
  updateActiveNavTab('navStatus');
  document.getElementById('userDirectory')?.classList.add('hidden');
});

document.getElementById('openAiChatBtn')?.addEventListener('click', () => {
  currentChatMode = 'ai';
  document.getElementById('chatOptionsMenuBtn')?.classList.add('hidden');
  updateActiveNavTab('openAiChatBtn');
  document.getElementById('userDirectory')?.classList.add('hidden');
  document.getElementById('chatRoomTitle').innerText = "Mulaqaat AI ✨";
  document.getElementById('chatRoomSub').innerText = "Your private intelligent AI companion";
  listenToMessages();
});

window.addEventListener('DOMContentLoaded', initCanvasAnimation);
