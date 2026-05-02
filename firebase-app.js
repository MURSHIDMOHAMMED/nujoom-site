import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDocs, getDoc, deleteDoc, collection } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7cs6WkdRVDJ6aZVXCm_COkRTLqmhpSlY",
  authDomain: "nujoom-ledger.firebaseapp.com",
  projectId: "nujoom-ledger",
  storageBucket: "nujoom-ledger.firebasestorage.app",
  messagingSenderId: "138374425289",
  appId: "1:138374425289:web:fece0aa39b41b80ac2fb18"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Make global so other JS can use it.
// We are bundling the methods in window.fb to make main.js and email-alerts.js work seamlessly.
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;

window.fb = {
    auth, db, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
    doc, setDoc, getDocs, getDoc, deleteDoc, collection
};

console.log("🔥 Firebase Connected");
