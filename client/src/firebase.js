// Defaults are intentionally set for local emulator use when VITE_USE_EMULATOR=true.
// For a real Firebase project, set the VITE_* environment variables in client/.env.local.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (import.meta.env.VITE_USE_EMULATOR === 'true' ? 'demo-key' : 'YOUR_API_KEY'),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.VITE_USE_EMULATOR === 'true' ? 'localhost' : 'YOUR_AUTH_DOMAIN'),
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || (import.meta.env.VITE_USE_EMULATOR === 'true' ? 'http://127.0.0.1:9000?ns=demo-project' : 'YOUR_DATABASE_URL'),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:demo-app'
}
