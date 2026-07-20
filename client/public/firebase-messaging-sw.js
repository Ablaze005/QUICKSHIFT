// Service worker for Firebase Cloud Messaging
// NOTE: Replace the firebase.initializeApp config with your project's values when deploying, or host this file via Firebase Hosting to inject config.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Minimal placeholder init — replace with your real config or host differently
firebase.initializeApp({
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME',
  projectId: 'REPLACE_ME',
  messagingSenderId: 'REPLACE_ME',
  appId: 'REPLACE_ME'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || 'QuickShift'
  const options = { body: (payload.notification && payload.notification.body) || '' }
  self.registration.showNotification(title, options)
});
