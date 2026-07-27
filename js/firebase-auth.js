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

function prefersRedirect() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  return isIOS || isSafari || isStandalone || window.innerWidth < 820;
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

async function signInWithProvider(provider, mode) {
  const auth = getAuth(getFirebaseApp());
  const useRedirect = mode === 'redirect' || (mode !== 'popup' && prefersRedirect());
  if (useRedirect) {
    sessionStorage.setItem('sistema:firebase-auth-pending', '1');
    await signInWithRedirect(auth, provider);
    return null;
  }
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return { idToken, user: result.user };
}

window.FirebaseAuth = {
  prefersRedirect,
  async signInWithGoogle(mode) {
    return signInWithProvider(makeGoogleProvider(), mode);
  },
  async signInWithApple(mode) {
    return signInWithProvider(makeAppleProvider(), mode);
  },
  async consumeRedirectResult() {
    const auth = getAuth(getFirebaseApp());
    const result = await getRedirectResult(auth);
    sessionStorage.removeItem('sistema:firebase-auth-pending');
    if (!result?.user) return null;
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  },
};
