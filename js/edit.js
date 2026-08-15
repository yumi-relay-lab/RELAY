import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const params = new URLSearchParams(window.location.search);
const postId = params.get("id");
const form = document.getElementById("editForm");
const status = document.getElementById("editStatus");
const saveButton = document.getElementById("saveEditButton");
const cancelLink = document.getElementById("cancelEditLink");
const attachmentNotice = document.getElementById("editAttachmentNotice");
const defaultSaveButtonText = saveButton.textContent;
let isSaving = false;


function setStatus(message, isError = false) {

    status.textContent = message;
    status.classList.toggle("is-error", isError);

}


function waitForInitialAuthState() {

    return new Promise(resolve => {

        let unsubscribe = () => {};

        unsubscribe = onAuthStateChanged(
            auth,
            user => {
                unsubscribe();
                resolve(user);
            },
            error => {
                unsubscribe();
                console.error("認証状態の取得エラー:", error);
                resolve(null);
            }
        );

    });

}


function setFormValues(post) {

    document.getElementById("schoolDivision").value = post.schoolDivision || "";
    document.getElementById("title").value = post.title || "";
    document.getElementById("purpose").value = post.purpose || "";
    document.getElementById("howToUse").value = post.howToUse || "";
    document.getElementById("reflection").value = post.reflection || "";
    document.getElementById("aiTags").value = Array.isArray(post.aiTags)
        ? post.aiTags.join(", ")
        : "";

    attachmentNotice.hidden = !Array.isArray(post.attachments)
        || post.attachments.length === 0;

}


function getTags() {

    return document.getElementById("aiTags").value
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

}


function removeLocalStorageCopy() {

    try {

        const posts = JSON.parse(localStorage.getItem("relayPosts")) || [];

        if (!Array.isArray(posts)) {
            return;
        }

        const remainingPosts = posts.filter(post => String(post.id) !== postId);

        if (remainingPosts.length !== posts.length) {
            localStorage.setItem("relayPosts", JSON.stringify(remainingPosts));
        }

    } catch (error) {

        console.warn("localStorageの互換データを整理できませんでした:", error);

    }

}


async function initializeEditPage() {

    if (!postId) {
        setStatus("編集する投稿が指定されていません。", true);
        return;
    }

    cancelLink.href = `detail.html?id=${encodeURIComponent(postId)}`;

    const currentUser = await waitForInitialAuthState();

    if (!currentUser) {
        setStatus("編集するにはGoogleでサインインしてください。", true);
        return;
    }

    try {

        const snapshot = await getDoc(doc(db, "posts", postId));

        if (!snapshot.exists()) {
            setStatus("編集する投稿が見つかりません。", true);
            return;
        }

        const post = snapshot.data();

        if (!auth.currentUser || post.authorId !== auth.currentUser.uid) {
            setStatus("この投稿を編集する権限がありません。", true);
            return;
        }

        setFormValues(post);
        setStatus("");
        form.hidden = false;

    } catch (error) {

        console.error("Firestore投稿の読み込みエラー:", error);
        setStatus("投稿を読み込めませんでした。時間をおいて再度お試しください。", true);

    }

}


form.addEventListener("submit", async event => {

    event.preventDefault();

    if (isSaving) {
        return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
        setStatus("ログイン状態を確認できません。トップページから再度サインインしてください。", true);
        return;
    }

    isSaving = true;
    saveButton.disabled = true;
    saveButton.textContent = "保存中…";
    setStatus("");

    try {

        const postReference = doc(db, "posts", postId);
        const latestSnapshot = await getDoc(postReference);

        if (!latestSnapshot.exists()) {
            throw new Error("post-not-found");
        }

        if (latestSnapshot.data().authorId !== currentUser.uid) {
            throw new Error("permission-denied");
        }

        await updateDoc(postReference, {
            schoolDivision: document.getElementById("schoolDivision").value,
            title: document.getElementById("title").value.trim(),
            purpose: document.getElementById("purpose").value.trim(),
            howToUse: document.getElementById("howToUse").value.trim(),
            reflection: document.getElementById("reflection").value.trim(),
            aiTags: getTags(),
            updatedAt: serverTimestamp()
        });

        removeLocalStorageCopy();
        location.href = `detail.html?id=${encodeURIComponent(postId)}`;

    } catch (error) {

        console.error("投稿の更新エラー:", error);

        if (error.message === "post-not-found") {
            setStatus("投稿が見つからないため保存できません。", true);
        } else if (error.message === "permission-denied" || error.code === "permission-denied") {
            setStatus("この投稿を編集する権限がないため保存できません。", true);
        } else {
            setStatus("変更を保存できませんでした。入力内容はそのままです。時間をおいて再度お試しください。", true);
        }

    } finally {

        isSaving = false;
        saveButton.disabled = false;
        saveButton.textContent = defaultSaveButtonText;

    }

});


initializeEditPage();
