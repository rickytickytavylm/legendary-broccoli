import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

function getFirebaseApp() {
  const config = window.FIREBASE_CONFIG;
  if (!config?.apiKey) throw new Error('FIREBASE_CONFIG missing');
  return getApps().length ? getApps()[0] : initializeApp(config);
}

function makeGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function makeAppleProvider() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

async function tokenFromUser(user) {
  if (!user) return null;
  const idToken = await user.getIdToken();
  return { idToken, user };
}

async function signInWithProvider(provider) {
  const auth = getAuth(getFirebaseApp());
  try {
    const result = await signInWithPopup(auth, provider);
    return tokenFromUser(result.user);
  } catch (err) {
    const code = String(err?.code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw err;
    }
    // Popup blocked / broken (common in in-app browsers) → full-page redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      sessionStorage.setItem('sistema:firebase-auth-pending', '1');
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

window.FirebaseAuth = {
  async signInWithGoogle() {
    return signInWithProvider(makeGoogleProvider());
  },
  async signInWithApple() {
    return signInWithProvider(makeAppleProvider());
  },
  async consumeRedirectResult() {
    const auth = getAuth(getFirebaseApp());
    let result = null;
    try {
      result = await getRedirectResult(auth);
    } catch (err) {
      console.warn('[firebase] getRedirectResult', err);
    }
    sessionStorage.removeItem('sistema:firebase-auth-pending');
    if (result?.user) return tokenFromUser(result.user);
    // Safari may lose redirect payload; persisted Firebase session can still exist.
    if (auth.currentUser) return tokenFromUser(auth.currentUser);
    return null;
  },
};
