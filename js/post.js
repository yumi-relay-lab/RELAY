import { auth, db } from "./firebase.js";

import {
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const button = document.querySelector(".submit-button");

button.addEventListener("click", async function () {

    const currentUser = auth.currentUser;

    if (!currentUser) {

        alert("投稿するにはGoogleでサインインしてください。トップページからサインインしてください。");
        return;

    }

    const newPost = {

        id: Date.now(),

        author:
        document.getElementById("author").value,

        schoolDivision:
        document.getElementById("schoolDivision").value,

        title:
        document.getElementById("title").value,

        purpose:
        document.getElementById("purpose").value,

        howToUse:
        document.getElementById("howToUse").value,

        reflection:
        document.getElementById("reflection").value,

        image: "",

        aiSummary:
        "先生の実践投稿です。",

        aiTags:
        ["実践共有"]

    };

    // 既存データを取得
    const firestorePost = {
        authorId: currentUser.uid,
        authorName: newPost.author,
        schoolDivision: newPost.schoolDivision,
        title: newPost.title,
        purpose: newPost.purpose,
        howToUse: newPost.howToUse,
        reflection: newPost.reflection,
        imageUrl: newPost.image || null,
        aiSummary: newPost.aiSummary,
        aiTags: newPost.aiTags,
        reactionCounts: {
            thanks: 0,
            reference: 0,
            try: 0,
            done: 0,
            idea: 0,
            question: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    try {

        await addDoc(collection(db, "posts"), firestorePost);

    } catch (error) {

        console.error("Firestoreへの投稿保存に失敗しました:", error);
        alert("投稿の保存に失敗しました。時間をおいて再度お試しください。");
        return;

    }

    let posts =
        JSON.parse(localStorage.getItem("relayPosts")) || [];

    // 新しい投稿を追加
    posts.push(newPost);

    // 保存
    localStorage.setItem(
        "relayPosts",
        JSON.stringify(posts)
    );

    alert("実践を投稿しました！");

    location.href = "index.html";

});
