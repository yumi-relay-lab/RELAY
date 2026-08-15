import { auth, db, storage } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    deleteObject,
    ref
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


const params = new URLSearchParams(window.location.search);
const postId = params.get("id");
const form = document.getElementById("editForm");
const status = document.getElementById("editStatus");
const saveButton = document.getElementById("saveEditButton");
const cancelLink = document.getElementById("cancelEditLink");
const attachmentList = document.getElementById("editAttachmentList");
const noAttachmentsMessage = document.getElementById("editNoAttachments");
const defaultSaveButtonText = saveButton.textContent;
const pendingDeletionPaths = new Set();
let displayedAttachments = [];
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

    displayedAttachments = Array.isArray(post.attachments)
        ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
        : [];
    pendingDeletionPaths.clear();
    renderAttachments();

}


function formatFileSize(size) {

    const bytes = Number(size);

    if (!Number.isFinite(bytes) || bytes < 0) {
        return "";
    }

    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    return `${Math.max(1, Math.round(bytes / 1024))} KB`;

}


function getCategoryLabel(category) {

    const labels = {
        image: "画像",
        pdf: "PDF",
        word: "Word",
        excel: "Excel"
    };

    return labels[category] || "ファイル";

}


function renderAttachments() {

    attachmentList.innerHTML = "";
    noAttachmentsMessage.hidden = displayedAttachments.length > 0;

    displayedAttachments.forEach(attachment => {

        const storagePath = typeof attachment.storagePath === "string"
            ? attachment.storagePath.trim()
            : "";
        const isPendingDeletion = pendingDeletionPaths.has(storagePath);
        const item = document.createElement("article");
        const details = document.createElement("div");
        const name = document.createElement("h4");
        const meta = document.createElement("p");
        const toggleButton = document.createElement("button");
        const fileSize = formatFileSize(attachment.size);

        item.className = "edit-attachment-item";
        item.classList.toggle("is-pending-deletion", isPendingDeletion);
        details.className = "edit-attachment-details";
        name.className = "edit-attachment-name";
        name.textContent = attachment.name || "名前のないファイル";
        meta.className = "edit-attachment-meta";
        meta.textContent = [getCategoryLabel(attachment.category), fileSize]
            .filter(Boolean)
            .join(" / ");
        details.append(name, meta);

        if (attachment.category === "image"
            && typeof attachment.downloadUrl === "string"
            && attachment.downloadUrl) {
            const preview = document.createElement("img");
            preview.className = "edit-attachment-preview";
            preview.src = attachment.downloadUrl;
            preview.alt = attachment.name || "添付画像";
            preview.loading = "lazy";
            details.prepend(preview);
        }

        if (isPendingDeletion) {
            const pendingLabel = document.createElement("strong");
            pendingLabel.className = "edit-attachment-pending-label";
            pendingLabel.textContent = "削除予定";
            details.appendChild(pendingLabel);
        }

        toggleButton.type = "button";
        toggleButton.className = "edit-attachment-toggle";
        toggleButton.classList.toggle("is-cancel", isPendingDeletion);
        toggleButton.setAttribute("aria-pressed", String(isPendingDeletion));
        toggleButton.textContent = isPendingDeletion
            ? "削除予定を取り消す"
            : "この添付を削除";
        toggleButton.addEventListener("click", () => {
            if (isPendingDeletion) {
                pendingDeletionPaths.delete(storagePath);
            } else {
                pendingDeletionPaths.add(storagePath);
            }
            renderAttachments();
        });

        item.append(details, toggleButton);
        attachmentList.appendChild(item);

    });

}


function setSavingState(saving) {

    isSaving = saving;
    saveButton.disabled = saving;
    saveButton.textContent = saving ? "保存中…" : defaultSaveButtonText;
    attachmentList.querySelectorAll(".edit-attachment-toggle").forEach(button => {
        button.disabled = saving;
    });

}


function validateDeletionPaths(storagePaths, currentUser) {

    const expectedPrefix = `posts/${postId}/${currentUser.uid}/`;

    storagePaths.forEach(storagePath => {
        const fileName = storagePath.slice(expectedPrefix.length);

        if (!storagePath.startsWith(expectedPrefix)
            || !fileName
            || fileName.includes("/")) {
            const error = new Error("invalid-storage-path");
            error.relayStage = "validation";
            throw error;
        }
    });

}


async function deleteStorageFiles(storagePaths) {

    const results = await Promise.allSettled(
        storagePaths.map(async storagePath => {
            try {
                await deleteObject(ref(storage, storagePath));
            } catch (error) {
                if (error.code !== "storage/object-not-found") {
                    throw error;
                }
            }
        })
    );
    const failedResult = results.find(result => result.status === "rejected");

    if (failedResult) {
        const error = new Error("storage-delete-failed");
        error.relayStage = "storage";
        error.cause = failedResult.reason;
        throw error;
    }

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

    setSavingState(true);
    setStatus("");

    try {

        const postReference = doc(db, "posts", postId);
        const latestSnapshot = await getDoc(postReference);

        if (!latestSnapshot.exists()) {
            throw new Error("post-not-found");
        }

        const latestPost = latestSnapshot.data();

        if (!auth.currentUser || latestPost.authorId !== auth.currentUser.uid) {
            throw new Error("permission-denied");
        }

        const latestAttachments = Array.isArray(latestPost.attachments)
            ? latestPost.attachments.filter(attachment => attachment && typeof attachment === "object")
            : [];
        const requestedDeletionPaths = [...pendingDeletionPaths];
        const latestStoragePaths = new Set(latestAttachments.map(attachment => {
            return typeof attachment.storagePath === "string"
                ? attachment.storagePath.trim()
                : "";
        }));
        const hasStaleDeletion = requestedDeletionPaths.some(storagePath => {
            return !storagePath || !latestStoragePaths.has(storagePath);
        });

        if (hasStaleDeletion) {
            const error = new Error("attachments-changed");
            error.relayStage = "validation";
            throw error;
        }

        validateDeletionPaths(requestedDeletionPaths, auth.currentUser);
        await deleteStorageFiles(requestedDeletionPaths);

        const remainingAttachments = latestAttachments.filter(attachment => {
            const storagePath = typeof attachment.storagePath === "string"
                ? attachment.storagePath.trim()
                : "";

            return !pendingDeletionPaths.has(storagePath);
        });
        const updates = {
            schoolDivision: document.getElementById("schoolDivision").value,
            title: document.getElementById("title").value.trim(),
            purpose: document.getElementById("purpose").value.trim(),
            howToUse: document.getElementById("howToUse").value.trim(),
            reflection: document.getElementById("reflection").value.trim(),
            aiTags: getTags(),
            updatedAt: serverTimestamp()
        };

        if (requestedDeletionPaths.length > 0) {
            updates.attachments = remainingAttachments;
        }

        try {
            await updateDoc(postReference, updates);
        } catch (error) {
            error.relayStage = requestedDeletionPaths.length > 0
                ? "firestore-after-storage"
                : "firestore";
            throw error;
        }

        removeLocalStorageCopy();
        location.href = `detail.html?id=${encodeURIComponent(postId)}`;

    } catch (error) {

        console.error("投稿の更新エラー:", error);

        if (error.message === "post-not-found") {
            setStatus("投稿が見つからないため保存できません。", true);
        } else if (error.message === "invalid-storage-path") {
            setStatus("添付ファイルの保存先を安全に確認できないため、変更は保存していません。", true);
        } else if (error.message === "attachments-changed") {
            setStatus("添付情報が画面表示後に変更されたため保存できません。ページを再読み込みしてください。", true);
        } else if (error.relayStage === "storage") {
            setStatus("Storageの添付ファイルを削除できなかったため、Firestoreの添付情報と本文は更新していません。再度保存をお試しください。", true);
        } else if (error.relayStage === "firestore-after-storage") {
            setStatus("Storageファイルの削除は完了しましたが、Firestoreの変更を保存できませんでした。再度保存をお試しください。", true);
        } else if (error.message === "permission-denied" || error.code === "permission-denied") {
            setStatus("この投稿を編集する権限がないため保存できません。", true);
        } else {
            setStatus("変更を保存できませんでした。入力内容はそのままです。時間をおいて再度お試しください。", true);
        }

    } finally {

        setSavingState(false);

    }

});


initializeEditPage();
