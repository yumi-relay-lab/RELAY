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
    getDownloadURL,
    ref,
    uploadBytes
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "xls", "xlsx"
]);
const params = new URLSearchParams(window.location.search);
const postId = params.get("id");
const form = document.getElementById("editForm");
const status = document.getElementById("editStatus");
const saveButton = document.getElementById("saveEditButton");
const cancelLink = document.getElementById("cancelEditLink");
const attachmentList = document.getElementById("editAttachmentList");
const noAttachmentsMessage = document.getElementById("editNoAttachments");
const fileInput = document.getElementById("editAttachments");
const dropZone = document.getElementById("editAttachmentDropZone");
const newAttachmentList = document.getElementById("editNewAttachmentList");
const attachmentStatus = document.getElementById("editAttachmentStatus");
const privacyConfirmation = document.getElementById("editPrivacyConfirmation");
const privacyCheckbox = document.getElementById("editPrivacyConfirmed");
const defaultSaveButtonText = saveButton.textContent;
const pendingDeletionPaths = new Set();
const selectedNewFiles = [];
let displayedAttachments = [];
let isSaving = false;
let isAddingFiles = false;


function setStatus(message, isError = false) {

    status.textContent = message;
    status.classList.toggle("is-error", isError);

}


function setAttachmentStatus(message, isError = false) {

    attachmentStatus.textContent = message;
    attachmentStatus.classList.toggle("is-error", isError);

}


function getExtension(fileName) {

    return fileName.includes(".")
        ? fileName.split(".").pop().toLowerCase()
        : "";

}


function getFileCategory(file) {

    const extension = getExtension(file.name);

    if (["jpg", "jpeg", "png", "webp"].includes(extension)) {
        return "image";
    }

    if (extension === "pdf") {
        return "pdf";
    }

    if (extension === "doc" || extension === "docx") {
        return "word";
    }

    return "excel";

}


function getContentType(file) {

    if (file.type) {
        return file.type;
    }

    const contentTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    return contentTypes[getExtension(file.name)];

}


function isAllowedFile(file) {

    return ALLOWED_EXTENSIONS.has(getExtension(file.name));

}


function isImageFile(file) {

    return IMAGE_TYPES.has(file.type)
        && ["jpg", "jpeg", "png", "webp"].includes(getExtension(file.name));

}


function isDuplicateNewFile(file) {

    return selectedNewFiles.some(selectedFile =>
        selectedFile.name === file.name
        && selectedFile.size === file.size
        && selectedFile.lastModified === file.lastModified
    );

}


function loadImage(file) {

    return new Promise((resolve, reject) => {

        const image = new Image();
        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("画像を読み込めませんでした。"));
        };

        image.src = objectUrl;

    });

}


function canvasToBlob(canvas, type, quality) {

    return new Promise(resolve => canvas.toBlob(resolve, type, quality));

}


async function compressImage(file, maxSize = MAX_FILE_SIZE, maxDimension = 2000) {

    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    let quality = 0.85;
    let blob = null;

    for (let attempt = 0; attempt < 10; attempt++) {

        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        blob = await canvasToBlob(canvas, file.type, quality);

        if (!blob) {
            throw new Error("画像を圧縮できませんでした。");
        }

        if (blob.size <= maxSize) {
            return new File([blob], file.name, {
                type: file.type,
                lastModified: file.lastModified
            });
        }

        if (file.type === "image/png" || quality <= 0.55) {
            scale *= 0.8;
        } else {
            quality -= 0.1;
        }

    }

    return null;

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
    renderNewAttachments();

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
                if (getPlannedAttachmentCount() >= MAX_FILES) {
                    setAttachmentStatus("添付は既存ファイルと追加予定を合わせて最大3ファイルです。", true);
                    return;
                }
                pendingDeletionPaths.delete(storagePath);
            } else {
                pendingDeletionPaths.add(storagePath);
            }
            setAttachmentStatus("");
            renderAttachments();
        });

        item.append(details, toggleButton);
        attachmentList.appendChild(item);

    });

}


function getRetainedAttachmentCount() {

    return displayedAttachments.filter(attachment => {
        const storagePath = typeof attachment.storagePath === "string"
            ? attachment.storagePath.trim()
            : "";

        return !pendingDeletionPaths.has(storagePath);
    }).length;

}


function getPlannedAttachmentCount() {

    return getRetainedAttachmentCount() + selectedNewFiles.length;

}


function renderNewAttachments() {

    newAttachmentList.innerHTML = "";

    selectedNewFiles.forEach((file, index) => {

        const item = document.createElement("li");
        const fileName = document.createElement("span");
        const removeButton = document.createElement("button");

        fileName.textContent = `追加予定：${file.name} (${formatFileSize(file.size)})`;
        removeButton.type = "button";
        removeButton.className = "attachment-remove";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `${file.name}を追加予定から外す`);
        removeButton.addEventListener("click", () => {
            selectedNewFiles.splice(index, 1);
            setAttachmentStatus("");
            renderNewAttachments();
        });

        item.append(fileName, removeButton);
        newAttachmentList.appendChild(item);

    });

    const hasNewAttachments = selectedNewFiles.length > 0;

    privacyConfirmation.hidden = !hasNewAttachments;
    privacyCheckbox.required = hasNewAttachments;

    if (!hasNewAttachments) {
        privacyCheckbox.checked = false;
    }

}


async function addNewFiles(files) {

    if (isAddingFiles || isSaving) {
        return;
    }

    isAddingFiles = true;
    fileInput.disabled = true;
    saveButton.disabled = true;
    dropZone.classList.add("is-disabled");
    setAttachmentStatus("");

    try {

        for (const originalFile of files) {

            if (getPlannedAttachmentCount() >= MAX_FILES) {
                setAttachmentStatus("添付は既存ファイルと追加予定を合わせて最大3ファイルです。", true);
                break;
            }

            if (!isAllowedFile(originalFile)) {
                setAttachmentStatus(`${originalFile.name} は対応していない形式です。`, true);
                continue;
            }

            if (isDuplicateNewFile(originalFile)) {
                setAttachmentStatus(`${originalFile.name} はすでに追加予定です。`, true);
                continue;
            }

            let file = originalFile;

            if (file.size > MAX_FILE_SIZE && isImageFile(file)) {
                setAttachmentStatus(`${file.name} を5MB以下に圧縮しています。`);

                try {
                    file = await compressImage(file);
                } catch (error) {
                    console.error("画像圧縮エラー:", error);
                    file = null;
                }

                if (!file || file.size > MAX_FILE_SIZE) {
                    setAttachmentStatus(`${originalFile.name} は圧縮後も5MBを超えるため追加できません。`, true);
                    continue;
                }

                setAttachmentStatus(`${originalFile.name} を圧縮して追加予定にしました。`);

            } else if (file.size > MAX_FILE_SIZE) {
                setAttachmentStatus("PDF・Word・Excelは自動圧縮できません。5MB以下のファイルを選択してください。", true);
                continue;
            }

            if (isDuplicateNewFile(file)) {
                setAttachmentStatus(`${originalFile.name} はすでに追加予定です。`, true);
                continue;
            }

            if (getPlannedAttachmentCount() >= MAX_FILES) {
                setAttachmentStatus("添付は既存ファイルと追加予定を合わせて最大3ファイルです。", true);
                break;
            }

            selectedNewFiles.push(file);

        }

    } finally {

        isAddingFiles = false;
        fileInput.disabled = isSaving;
        saveButton.disabled = isSaving;
        dropZone.classList.toggle("is-disabled", isSaving);
        fileInput.value = "";
        renderNewAttachments();

    }

}


function setSavingState(saving) {

    isSaving = saving;
    saveButton.disabled = saving;
    saveButton.textContent = saving ? "保存中…" : defaultSaveButtonText;
    fileInput.disabled = saving;
    privacyCheckbox.disabled = saving;
    dropZone.classList.toggle("is-disabled", saving);
    attachmentList.querySelectorAll(".edit-attachment-toggle").forEach(button => {
        button.disabled = saving;
    });
    newAttachmentList.querySelectorAll(".attachment-remove").forEach(button => {
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


async function deleteUploadedFiles(uploadedReferences) {

    const results = await Promise.allSettled(
        uploadedReferences.map(storageReference => deleteObject(storageReference))
    );

    results.forEach(result => {
        if (result.status === "rejected"
            && result.reason.code !== "storage/object-not-found") {
            console.error("新規アップロード済みファイルの補償削除エラー:", result.reason);
        }
    });

    return results.every(result =>
        result.status === "fulfilled"
        || result.reason.code === "storage/object-not-found"
    );

}


async function uploadNewAttachments(currentUser) {

    const attachments = [];
    const uploadedReferences = [];

    try {

        for (const file of selectedNewFiles) {

            const fileId = crypto.randomUUID();
            const extension = getExtension(file.name);
            const storagePath = `posts/${postId}/${currentUser.uid}/${fileId}.${extension}`;
            const storageReference = ref(storage, storagePath);
            const contentType = getContentType(file);

            await uploadBytes(storageReference, file, { contentType });
            uploadedReferences.push(storageReference);

            const downloadUrl = await getDownloadURL(storageReference);

            attachments.push({
                id: fileId,
                name: file.name,
                storagePath,
                downloadUrl,
                contentType,
                size: file.size,
                category: getFileCategory(file)
            });

        }

        return { attachments, uploadedReferences };

    } catch (error) {

        const cleanupSucceeded = await deleteUploadedFiles(uploadedReferences);
        error.relayStage = "upload";
        error.cleanupFailed = !cleanupSucceeded;
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


fileInput.addEventListener("change", event => {
    if (!isSaving) {
        addNewFiles(Array.from(event.target.files));
    }
});


["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();

        if (!isSaving) {
            dropZone.classList.add("is-dragging");
        }
    });
});


["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
    });
});


dropZone.addEventListener("drop", event => {
    if (!isSaving) {
        addNewFiles(Array.from(event.dataTransfer.files));
    }
});


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

    if (isAddingFiles) {
        setAttachmentStatus("画像の圧縮またはファイルの確認中です。完了後に保存してください。", true);
        return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
        setStatus("ログイン状態を確認できません。トップページから再度サインインしてください。", true);
        return;
    }

    if (selectedNewFiles.length > 0 && !privacyCheckbox.checked) {
        setAttachmentStatus("新しい添付資料に個人情報が含まれていないことを確認し、チェックを入れてください。", true);
        privacyCheckbox.focus();
        return;
    }

    if (getPlannedAttachmentCount() > MAX_FILES) {
        setAttachmentStatus("添付は既存ファイルと追加予定を合わせて最大3ファイルです。", true);
        return;
    }

    setSavingState(true);
    setStatus("");
    setAttachmentStatus("");
    let uploadedReferences = [];

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

        const remainingAttachments = latestAttachments.filter(attachment => {
            const storagePath = typeof attachment.storagePath === "string"
                ? attachment.storagePath.trim()
                : "";

            return !pendingDeletionPaths.has(storagePath);
        });

        if (remainingAttachments.length + selectedNewFiles.length > MAX_FILES) {
            const error = new Error("too-many-attachments");
            error.relayStage = "validation";
            throw error;
        }

        const uploadResult = await uploadNewAttachments(auth.currentUser);

        uploadedReferences = uploadResult.uploadedReferences;

        await deleteStorageFiles(requestedDeletionPaths);

        const updatedAttachments = remainingAttachments.concat(uploadResult.attachments);
        const updates = {
            schoolDivision: document.getElementById("schoolDivision").value,
            title: document.getElementById("title").value.trim(),
            purpose: document.getElementById("purpose").value.trim(),
            howToUse: document.getElementById("howToUse").value.trim(),
            reflection: document.getElementById("reflection").value.trim(),
            aiTags: getTags(),
            updatedAt: serverTimestamp()
        };

        if (requestedDeletionPaths.length > 0 || uploadResult.attachments.length > 0) {
            updates.attachments = updatedAttachments;
        }

        try {
            await updateDoc(postReference, updates);
        } catch (error) {
            if (requestedDeletionPaths.length > 0) {
                error.relayStage = "firestore-after-storage";
            } else if (uploadResult.attachments.length > 0) {
                error.relayStage = "firestore-after-upload";
            } else {
                error.relayStage = "firestore";
            }
            throw error;
        }

        removeLocalStorageCopy();
        location.href = `detail.html?id=${encodeURIComponent(postId)}`;

    } catch (error) {

        console.error("投稿の更新エラー:", error);

        if (uploadedReferences.length > 0) {
            const cleanupSucceeded = await deleteUploadedFiles(uploadedReferences);
            error.cleanupFailed = !cleanupSucceeded;
        }

        if (error.message === "post-not-found") {
            setStatus("投稿が見つからないため保存できません。", true);
        } else if (error.message === "invalid-storage-path") {
            setStatus("添付ファイルの保存先を安全に確認できないため、変更は保存していません。", true);
        } else if (error.message === "attachments-changed") {
            setStatus("添付情報が画面表示後に変更されたため保存できません。ページを再読み込みしてください。", true);
        } else if (error.message === "too-many-attachments") {
            setStatus("添付情報が画面表示後に変更され、合計3ファイルを超えるため保存できません。ページを再読み込みしてください。", true);
        } else if (error.relayStage === "upload") {
            setStatus(error.cleanupFailed
                ? "新しい添付ファイルのアップロードに失敗し、一部のファイルを自動削除できませんでした。Firestoreは更新していません。"
                : "新しい添付ファイルをアップロードできなかったため、Firestoreは更新していません。再度保存をお試しください。", true);
        } else if (error.relayStage === "storage") {
            setStatus(error.cleanupFailed
                ? "既存添付の削除に失敗し、アップロード済みの新規ファイルの一部を自動削除できませんでした。Firestoreは更新していません。"
                : "Storageの既存添付を削除できなかったため、新規アップロード分を補償削除し、Firestoreは更新していません。再度保存をお試しください。", true);
        } else if (error.relayStage === "firestore-after-storage") {
            setStatus(error.cleanupFailed
                ? "既存添付は削除されましたがFirestoreを更新できず、新規アップロード分の一部も自動削除できませんでした。再度保存をお試しください。"
                : "既存添付のStorage削除後にFirestoreを更新できませんでした。新規アップロード分は補償削除しました。再度保存をお試しください。", true);
        } else if (error.relayStage === "firestore-after-upload") {
            setStatus(error.cleanupFailed
                ? "Firestoreの変更を保存できず、アップロード済みの新規ファイルの一部も自動削除できませんでした。"
                : "Firestoreの変更を保存できなかったため、アップロード済みの新規ファイルを補償削除しました。再度保存をお試しください。", true);
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
