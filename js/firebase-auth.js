import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

function getFirebaseApp() {
  const config = window.FIREBASE_CONFIG;
  if (!config?.apiKey) throw new Error('FIREBASE_CONFIG missing');
  return getApps().length ? getApps()[0] : initializeApp(config);
}

async function signInWithProvider(provider) {
  const auth = getAuth(getFirebaseApp());
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return { idToken, user: result.user };
}

window.FirebaseAuth = {
  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return signInWithProvider(provider);
  },
  async signInWithApple() {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return signInWithProvider(provider);
  },
};
