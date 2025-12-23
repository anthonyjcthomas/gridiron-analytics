// app/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyD7FzwROwP4oMg53R5d0eQdwIe55w87Vp8",
    authDomain: "gridiron-analytics-a73d5.firebaseapp.com",
    projectId: "gridiron-analytics-a73d5",
    storageBucket: "gridiron-analytics-a73d5.firebasestorage.app",
    messagingSenderId: "37372455146",
    appId: "1:37372455146:web:a0e34968fe05f53c1d0f93",
    measurementId: "G-SDG9652RXN"
  };

// These config values are *public client config*, not secrets.
// Grab them from Firebase Console → Project settings → "Your apps" → Web.

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

export const firebaseApp = app;
export const db = getFirestore(app);
