import { auth, db } from "./firebase.js";

import {
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_LOCAL_IMAGE_SIZE = 700 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "xls", "xlsx"
]);

const fileInput = document.getElementById("attachments");
const dropZone = document.getElementById("attachmentDropZone");
const attachmentList = document.getElementById("attachmentList");
const attachmentStatus = document.getElementById("attachmentStatus");
const privacyConfirmation = document.getElementById("privacyConfirmation");
const privacyCheckbox = document.getElementById("privacyConfirmed");
const selectedFiles = [];


function getExtension(fileName) {

    return fileName.includes(".")
        ? fileName.split(".").pop().toLowerCase()
        : "";

}


function isAllowedFile(file) {

    return ALLOWED_EXTENSIONS.has(getExtension(file.name));

}


function isImageFile(file) {

    return IMAGE_TYPES.has(file.type)
        && ["jpg", "jpeg", "png", "webp"].includes(getExtension(file.name));

}


function getFileIcon(file) {

    const extension = getExtension(file.name);

    if (isImageFile(file)) {
        return "📷";
    }

    if (extension === "pdf") {
        return "📄";
    }

    if (extension === "doc" || extension === "docx") {
        return "📘";
    }

    return "📗";

}


function setAttachmentStatus(message, isError = false) {

    attachmentStatus.textContent = message;
    attachmentStatus.classList.toggle("is-error", isError);

}


function renderAttachments() {

    attachmentList.innerHTML = "";

    selectedFiles.forEach((file, index) => {

        const item = document.createElement("li");
        const fileName = document.createElement("span");
        const removeButton = document.createElement("button");

        fileName.textContent = `${getFileIcon(file)} ${file.name}`;

        removeButton.type = "button";
        removeButton.className = "attachment-remove";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `${file.name}を添付から外す`);
        removeButton.addEventListener("click", () => {

            selectedFiles.splice(index, 1);
            setAttachmentStatus("");
            renderAttachments();

        });

        item.append(fileName, removeButton);
        attachmentList.appendChild(item);

    });

    const hasAttachments = selectedFiles.length > 0;

    privacyConfirmation.hidden = !hasAttachments;
    privacyCheckbox.required = hasAttachments;

    if (!hasAttachments) {
        privacyCheckbox.checked = false;
    }

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


function fileToDataUrl(file) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
        reader.readAsDataURL(file);

    });

}


async function createLocalImageDataUrl() {

    const imageFile = selectedFiles.find(isImageFile);

    if (!imageFile) {
        return "";
    }

    const localImage = await compressImage(
        imageFile,
        MAX_LOCAL_IMAGE_SIZE,
        1600
    );

    if (!localImage) {
        throw new Error("詳細表示用の画像を作成できませんでした。");
    }

    return fileToDataUrl(localImage);

}


function isDuplicateFile(file) {

    return selectedFiles.some(selectedFile =>
        selectedFile.name === file.name
        && selectedFile.size === file.size
        && selectedFile.lastModified === file.lastModified
    );

}


async function addFiles(files) {

    setAttachmentStatus("");

    for (const originalFile of files) {

        if (selectedFiles.length >= MAX_FILES) {
            setAttachmentStatus("添付できるのは最大3ファイルです。", true);
            break;
        }

        if (!isAllowedFile(originalFile)) {
            setAttachmentStatus(`${originalFile.name} は対応していない形式です。`, true);
            continue;
        }

        if (isDuplicateFile(originalFile)) {
            setAttachmentStatus(`${originalFile.name} はすでに選択されています。`, true);
            continue;
        }

        let file = originalFile;

        if (file.size > MAX_FILE_SIZE && isImageFile(file)) {

            setAttachmentStatus(`${file.name} を5MB以下に圧縮しています。`);

            try {
                file = await compressImage(file);
            } catch (error) {
                console.error("画像圧縮に失敗しました:", error);
                file = null;
            }

            if (!file || file.size > MAX_FILE_SIZE) {
                setAttachmentStatus(`${originalFile.name} は圧縮後も5MBを超えるため添付できません。`, true);
                continue;
            }

            setAttachmentStatus(`${originalFile.name} を圧縮して追加しました。`);

        } else if (file.size > MAX_FILE_SIZE) {

            setAttachmentStatus(
                "このファイルは5MBを超えています。PDF・Word・Excelは自動圧縮できません。5MB以下にしてから添付してください。",
                true
            );
            continue;

        }

        if (isDuplicateFile(file)) {
            setAttachmentStatus(`${originalFile.name} はすでに選択されています。`, true);
            continue;
        }

        selectedFiles.push(file);

    }

    fileInput.value = "";
    renderAttachments();

}


fileInput.addEventListener("change", event => {
    addFiles(Array.from(event.target.files));
});


["dragenter", "dragover"].forEach(eventName => {

    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
    });

});


["dragleave", "drop"].forEach(eventName => {

    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove("is-dragging");
    });

});


dropZone.addEventListener("drop", event => {
    addFiles(Array.from(event.dataTransfer.files));
});


const button = document.querySelector(".submit-button");

button.addEventListener("click", async function () {

    if (selectedFiles.length > 0 && !privacyCheckbox.checked) {

        setAttachmentStatus("添付資料に個人情報が含まれていないことを確認し、チェックを入れてください。", true);
        privacyCheckbox.focus();
        return;

    }

    const currentUser = auth.currentUser;

    if (!currentUser) {

        alert("投稿するにはGoogleでサインインしてください。トップページからサインインしてください。");
        return;

    }

    let localImageDataUrl = "";

    try {

        localImageDataUrl = await createLocalImageDataUrl();

    } catch (error) {

        console.error("詳細表示用画像の作成に失敗しました:", error);
        setAttachmentStatus("画像を詳細画面用に保存できませんでした。画像を選び直してください。", true);
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

        image: localImageDataUrl,

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
        // Storage未実装のため、画像本体は従来どおりlocalStorageにだけ保存する
        imageUrl: null,
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

        const postReference = await addDoc(collection(db, "posts"), firestorePost);

        // 一覧のFirestore IDと詳細画面が参照するlocalStorage IDを揃える
        newPost.id = postReference.id;

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
