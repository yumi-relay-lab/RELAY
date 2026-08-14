// =========================
// RELAY Firebase 接続
// =========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


// Firebase 設定

const firebaseConfig = {

    apiKey: "AIzaSyBtxD9anSZbN053Ag-9uh1AtyAikEvqFXw",

    authDomain: "relay-lab-2026.firebaseapp.com",

    projectId: "relay-lab-2026",

    storageBucket: "relay-lab-2026.firebasestorage.app",

    messagingSenderId: "161339476177",

    appId: "1:161339476177:web:4099a20a281da611b79df0"

};


// Firebase 初期化

const app = initializeApp(firebaseConfig);


// Firestore

export const db = getFirestore(app);


// Firebase Authentication
export const auth = getAuth(app);


// Cloud Storage
export const storage = getStorage(app);
