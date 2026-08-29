// =========================
// RELAY detail.js Ver1.2
// 詳細表示 + リアクション + 🤝ありがとう機能
// =========================

import { auth, db, storage } from "./firebase.js";
import { sanitizeJiritsuCategories } from "./jiritsu.js";
import { getSafeResourceUrl } from "./resource-url.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    deleteDoc,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    deleteObject,
    ref
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


// =========================
// URLからID取得
// =========================

const params = new URLSearchParams(window.location.search);

const id = params.get("id");



// =========================
// 投稿データ読み込み
// =========================

async function loadPost() {

    const response = await fetch("./data/posts.json");
    const samplePosts = await response.json();
    const savedPosts = JSON.parse(localStorage.getItem("relayPosts")) || [];

    try {

        const snapshot = await getDoc(doc(db, "posts", id));

        if (snapshot.exists()) {
            return {
                post: {
                    ...snapshot.data(),
                    id: snapshot.id
                },
                isFirestorePost: true
            };
        }

    } catch (error) {

        console.error("Firestore投稿の読み込みエラー:", error);

    }

    return {
        post: samplePosts
            .concat(savedPosts)
            .find(item => String(item.id) === id)
            || null,
        isFirestorePost: false
    };

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


function setupOwnerActions(post, isFirestorePost) {

    const ownerActions = document.getElementById("ownerActions");
    const editButton = document.getElementById("editPostButton");
    const deleteButton = document.getElementById("deletePostButton");
    const deleteDialog = document.getElementById("deletePostDialog");
    const deleteDialogHeading = document.getElementById("deletePostDialogHeading");
    const cancelDeleteButton = document.getElementById("cancelDeletePostButton");
    const confirmDeleteButton = document.getElementById("confirmDeletePostButton");
    const actionStatus = document.getElementById("ownerActionStatus");
    const isOwner = isFirestorePost
        && auth.currentUser
        && post.authorId === auth.currentUser.uid;
    const defaultDeleteButtonText = deleteButton ? deleteButton.textContent : "";
    let isDeleting = false;

    if (!ownerActions || !editButton || !deleteButton || !actionStatus || !isOwner) {
        return;
    }

    function setActionError(message) {
        actionStatus.textContent = message;
        actionStatus.hidden = false;
    }

    function setDeletingState(deleting) {
        isDeleting = deleting;
        editButton.disabled = deleting;
        deleteButton.disabled = deleting;
        deleteButton.textContent = deleting ? "削除中…" : defaultDeleteButtonText;
        cancelDeleteButton.disabled = deleting;
        confirmDeleteButton.disabled = deleting;
        confirmDeleteButton.querySelector("span").textContent = deleting ? "削除中…" : "削除する";
    }

    function getOwnedStoragePaths(latestPost, currentUser) {

        const expectedPrefix = `posts/${post.id}/${currentUser.uid}/`;
        const attachments = Array.isArray(latestPost.attachments)
            ? latestPost.attachments
            : [];
        const hasMissingPath = attachments.some(attachment => {
            return !attachment
                || typeof attachment !== "object"
                || typeof attachment.storagePath !== "string"
                || !attachment.storagePath.trim();
        });
        const storagePaths = attachments.map(attachment => {
            return attachment && typeof attachment.storagePath === "string"
                ? attachment.storagePath.trim()
                : "";
        }).filter(Boolean);

        const hasInvalidPath = storagePaths.some(storagePath => {
            const fileName = storagePath.slice(expectedPrefix.length);

            return !storagePath.startsWith(expectedPrefix)
                || !fileName
                || fileName.includes("/");
        });

        if (hasMissingPath || hasInvalidPath) {
            const error = new Error("invalid-storage-path");
            error.relayStage = "validation";
            throw error;
        }

        return [...new Set(storagePaths)];

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

    function removeLocalPostData() {

        try {

            const savedPosts = JSON.parse(localStorage.getItem("relayPosts")) || [];

            if (Array.isArray(savedPosts)) {
                const remainingPosts = savedPosts.filter(item => String(item.id) !== String(post.id));

                if (remainingPosts.length !== savedPosts.length) {
                    localStorage.setItem("relayPosts", JSON.stringify(remainingPosts));
                }
            }

            localStorage.removeItem(`reaction_${post.id}`);
            localStorage.removeItem(`reactionSelection_${post.id}`);
            localStorage.removeItem(`thanksMessage_${post.id}`);

        } catch (error) {

            console.warn("localStorageの投稿関連データを整理できませんでした:", error);

        }

    }

    editButton.addEventListener("click", () => {
        location.href = `edit.html?id=${encodeURIComponent(post.id)}`;
    });

    deleteButton.addEventListener("click", () => {

        if (isDeleting) {
            return;
        }

        deleteDialog.showModal();
        deleteDialogHeading.focus({ preventScroll: true });
    });

    cancelDeleteButton.addEventListener("click", () => {
        deleteDialog.close();
    });

    confirmDeleteButton.addEventListener("click", async () => {

        if (isDeleting) {
            return;
        }

        actionStatus.hidden = true;
        actionStatus.textContent = "";
        setDeletingState(true);

        try {

            const currentUser = auth.currentUser;

            if (!currentUser) {
                const error = new Error("not-authenticated");
                error.relayStage = "authentication";
                throw error;
            }

            const postReference = doc(db, "posts", post.id);
            const latestSnapshot = await getDoc(postReference);

            if (!latestSnapshot.exists()) {
                const error = new Error("post-not-found");
                error.relayStage = "validation";
                throw error;
            }

            const latestPost = latestSnapshot.data();

            if (!auth.currentUser || latestPost.authorId !== auth.currentUser.uid) {
                const error = new Error("permission-denied");
                error.relayStage = "authorization";
                throw error;
            }

            const storagePaths = getOwnedStoragePaths(latestPost, auth.currentUser);

            await deleteStorageFiles(storagePaths);

            try {
                await deleteDoc(postReference);
            } catch (error) {
                error.relayStage = "firestore";
                throw error;
            }

            removeLocalPostData();
            location.href = "index.html";

        } catch (error) {

            console.error("投稿の削除エラー:", error.cause || error);

            if (error.message === "not-authenticated") {
                setActionError("ログイン状態を確認できないため削除できません。トップページから再度サインインしてください。");
            } else if (error.message === "post-not-found") {
                setActionError("投稿が見つからないため削除できません。");
            } else if (error.message === "permission-denied" || error.relayStage === "authorization") {
                setActionError("この投稿を削除する権限がありません。");
            } else if (error.message === "invalid-storage-path") {
                setActionError("添付ファイルの保存先を安全に確認できないため、投稿は削除していません。");
            } else if (error.relayStage === "storage") {
                setActionError("添付ファイルを削除できなかったため、Firestoreの投稿は削除していません。時間をおいて再度お試しください。");
            } else if (error.relayStage === "firestore") {
                setActionError("添付ファイルは削除されましたが、Firestoreの投稿を削除できませんでした。再度削除をお試しください。");
            } else {
                setActionError("投稿を削除できませんでした。データは削除されていません。時間をおいて再度お試しください。");
            }

            setDeletingState(false);

        }

    });

    ownerActions.hidden = false;

}


function formatDevTimestamp(value) {

    if (!value) return "未設定";

    let date;

    if (typeof value.toDate === "function") {
        date = value.toDate();
    } else if (value instanceof Date) {
        date = value;
    } else if (typeof value === "object" && Number.isFinite(value.seconds)) {
        date = new Date(value.seconds * 1000);
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "未設定";

    return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(date);

}


async function copyDevText(text, label) {

    const status = document.getElementById("devPanelStatus");

    try {
        await navigator.clipboard.writeText(text);
        if (status) {
            status.textContent = `${label}をコピーしました`;
            status.hidden = false;
        }
    } catch (error) {
        console.error(`${label}のコピーエラー:`, error);
        if (status) {
            status.textContent = `${label}をコピーできませんでした`;
            status.hidden = false;
        }
    }

}


function createDevInfoRow(label, value) {

    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;
    description.textContent = value;
    row.append(term, description);

    return { row, description };

}


function createDevCopyButton(text, label) {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "dev-panel-button";
    button.textContent = "コピー";
    button.addEventListener("click", () => copyDevText(text, label));

    return button;

}


function renderDevInfo(post, isFirestorePost) {

    const content = document.getElementById("devPanelContent");

    if (!content) return;

    content.replaceChildren();

    const postId = post && post.id != null ? String(post.id) : (id || "不明");
    const summary = document.createElement("dl");
    const postIdRow = createDevInfoRow("投稿ID", postId);

    postIdRow.description.append(" ", createDevCopyButton(postId, "投稿ID"));
    summary.append(postIdRow.row);

    if (!isFirestorePost) {
        const notice = document.createElement("p");
        notice.className = "dev-panel-notice";
        notice.textContent = "Firestore投稿ではありません";
        content.append(summary, notice);
        return;
    }

    const attachments = Array.isArray(post.attachments)
        ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
        : [];

    summary.append(
        createDevInfoRow("authorId", post.authorId || "未設定").row,
        createDevInfoRow("createdAt", formatDevTimestamp(post.createdAt)).row,
        createDevInfoRow("updatedAt", formatDevTimestamp(post.updatedAt)).row,
        createDevInfoRow("attachments", `${attachments.length}件`).row
    );
    content.append(summary);

    const attachmentList = document.createElement("div");
    attachmentList.className = "dev-panel-attachments";

    if (attachments.length === 0) {
        attachmentList.textContent = "添付ファイルはありません";
    }

    attachments.forEach((attachment, index) => {
        const item = document.createElement("section");
        const heading = document.createElement("p");
        const details = document.createElement("dl");
        const storagePath = typeof attachment.storagePath === "string"
            ? attachment.storagePath
            : "";
        const downloadUrl = typeof attachment.downloadUrl === "string"
            ? attachment.downloadUrl
            : "";

        item.className = "dev-panel-attachment";
        heading.className = "dev-panel-attachment-title";
        heading.textContent = `添付 ${index + 1}`;
        details.append(
            createDevInfoRow("name", attachment.name || "未設定").row,
            createDevInfoRow("category", attachment.category || "未設定").row,
            createDevInfoRow("contentType", attachment.contentType || "未設定").row,
            createDevInfoRow("size", formatFileSize(attachment.size) || "未設定").row,
            createDevInfoRow("storagePath", storagePath || "未設定").row,
            createDevInfoRow("downloadUrl", downloadUrl ? "あり" : "なし").row
        );

        const actions = document.createElement("div");
        actions.className = "dev-panel-actions";

        if (storagePath) {
            actions.append(createDevCopyButton(storagePath, `添付${index + 1}のstoragePath`));
        }

        if (downloadUrl) {
            const openLink = document.createElement("a");
            openLink.className = "dev-panel-button";
            openLink.href = downloadUrl;
            openLink.target = "_blank";
            openLink.rel = "noopener noreferrer";
            openLink.textContent = "URLを開く";
            actions.append(
                openLink,
                createDevCopyButton(downloadUrl, `添付${index + 1}のdownloadUrl`)
            );
        }

        item.append(heading, details, actions);
        attachmentList.append(item);
    });

    content.append(attachmentList);

}


function getFirstAttachmentImage(post) {

    const attachments = Array.isArray(post.attachments)
        ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
        : [];
    const imageAttachment = attachments.find(attachment =>
        attachment.category === "image"
        && typeof attachment.downloadUrl === "string"
        && attachment.downloadUrl
    );

    return imageAttachment ? imageAttachment.downloadUrl : "";

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


function createUnavailableMessage() {

    const message = document.createElement("span");
    message.className = "detail-attachment-error";
    message.textContent = "ファイルを開けません";

    return message;

}


function renderAttachments(post) {

    const attachmentSection = document.getElementById("detailAttachments");
    const attachmentList = document.getElementById("detailAttachmentList");
    const attachments = Array.isArray(post.attachments)
        ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
        : [];

    if (!attachmentSection || !attachmentList || attachments.length === 0) {
        return;
    }

    attachmentList.innerHTML = "";

    attachments.forEach(attachment => {

        const item = document.createElement("article");
        const fileName = document.createElement("h3");
        const fileSize = formatFileSize(attachment.size);
        const downloadUrl = typeof attachment.downloadUrl === "string"
            ? attachment.downloadUrl.trim()
            : "";

        item.className = "detail-attachment-item";
        fileName.className = "detail-attachment-name";
        fileName.textContent = attachment.name || "名前のないファイル";
        item.appendChild(fileName);

        if (fileSize) {
            const size = document.createElement("p");
            size.className = "detail-attachment-size";
            size.textContent = fileSize;
            item.appendChild(size);
        }

        if (!downloadUrl) {
            item.appendChild(createUnavailableMessage());
            attachmentList.appendChild(item);
            return;
        }

        if (attachment.category === "image") {
            item.classList.add("detail-attachment-item-image");

            const previewLink = document.createElement("a");
            previewLink.className = "detail-attachment-preview-link";
            previewLink.href = downloadUrl;
            previewLink.target = "_blank";
            previewLink.rel = "noopener noreferrer";
            previewLink.setAttribute(
                "aria-label",
                `${attachment.name || "添付画像"}を拡大表示`
            );

            const preview = document.createElement("img");
            preview.className = "detail-attachment-preview";
            preview.src = downloadUrl;
            preview.alt = attachment.name || "添付画像";
            preview.loading = "lazy";
            preview.addEventListener("error", () => {
                previewLink.remove();
                item.appendChild(createUnavailableMessage());
            }, { once: true });
            previewLink.appendChild(preview);
            item.appendChild(previewLink);
        } else {
            item.classList.add("detail-attachment-item-file");

            const linkLabels = {
                pdf: "PDFを開く",
                word: "Wordをダウンロード",
                excel: "Excelをダウンロード"
            };
            const linkLabel = linkLabels[attachment.category];

            if (linkLabel) {
                const link = document.createElement("a");
                link.className = "detail-attachment-link";
                link.href = downloadUrl;
                link.textContent = linkLabel;

                if (attachment.category === "pdf") {
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                } else {
                    link.download = attachment.name || "";
                }

                item.appendChild(link);
            } else {
                item.appendChild(createUnavailableMessage());
            }
        }

        attachmentList.appendChild(item);

    });

    attachmentSection.hidden = false;

}


function renderResourceLink(post) {

    const section = document.getElementById("detailResourceLink");
    const link = document.getElementById("detailResourceLinkAnchor");
    const resourceUrl = getSafeResourceUrl(post.resourceUrl);

    if (!section || !link || !resourceUrl) {
        return;
    }

    link.href = resourceUrl;
    section.hidden = false;

}


Promise.all([
    loadPost(),
    waitForInitialAuthState()
])

.then(([postResult]) => {

    const { post, isFirestorePost } = postResult;



    if(!post){

        const card = document.querySelector(".card");

        if(card){

            card.innerHTML =
            "<h2>投稿が見つかりません</h2>";

        }

        return;

    }



    // =========================
    // 詳細表示
    // =========================


    const title =
    document.getElementById("title");

    if(title){

        title.textContent = post.title;

    }



    const image =
    document.getElementById("image");


    if(image){

        const imageUrl = getFirstAttachmentImage(post);

        if (imageUrl) {
            image.src = imageUrl;
        } else {
            image.hidden = true;
        }

    }


    renderAttachments(post);

    renderResourceLink(post);

    setupOwnerActions(post, isFirestorePost);

    renderDevInfo(post, isFirestorePost);



    const department =
    document.getElementById("department");


    if(department){

        department.textContent =
        post.schoolDivision || "";

    }



    const purpose =
    document.getElementById("purpose");


    if(purpose){

        purpose.textContent =
        post.purpose || "";

    }



    const method =
    document.getElementById("method");


    if(method){

        method.textContent =
        post.howToUse || "";

    }



    const practice =
    document.getElementById("practice");


    if(practice){

        practice.textContent =
        post.reflection || post.practice || "";

    }





    // =========================
    // タグ表示
    // =========================


    const tagArea =
    document.getElementById("tags");


    if(tagArea){


        tagArea.innerHTML = "";


        const tags = Array.isArray(post.aiTags)
            ? post.aiTags
            : (Array.isArray(post.tags) ? post.tags : []);

        if(tags.length){


            tags.forEach(tag=>{


                const span =
                document.createElement("span");


                span.className =
                "tag";


                span.textContent =
                tag;


                tagArea.appendChild(span);


            });


        }

    }

    const jiritsuArea = document.getElementById("jiritsuCategories");
    const jiritsuCategories = sanitizeJiritsuCategories(post.jiritsuCategories);

    if (jiritsuArea && jiritsuCategories.length > 0) {
        const label = document.createElement("strong");
        label.textContent = "自立活動との関連";
        jiritsuArea.replaceChildren(label);
        jiritsuCategories.forEach(category => {
            const span = document.createElement("span");
            span.textContent = category;
            jiritsuArea.appendChild(span);
        });
        jiritsuArea.hidden = false;
    }


    // =========================
    // 印刷用ページ
    // =========================


    const shareButton = document.getElementById("shareButton");

    if (shareButton) {

        shareButton.addEventListener("click", () => {

            const attachments = Array.isArray(post.attachments)
                ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
                : [];
            const printablePost = {
                id: post.id,
                title: post.title || "",
                schoolDivision: post.schoolDivision || "",
                purpose: post.purpose || "",
                howToUse: post.howToUse || "",
                reflection: post.reflection || post.practice || "",
                aiTags: Array.isArray(post.aiTags)
                    ? post.aiTags
                    : (Array.isArray(post.tags) ? post.tags : []),
                jiritsuCategories,
                attachments: attachments.map(attachment => ({
                    name: attachment.name || "",
                    category: attachment.category || "",
                    downloadUrl: attachment.downloadUrl || ""
                }))
            };

            sessionStorage.setItem(
                `relayPrintPost_${post.id}`,
                JSON.stringify(printablePost)
            );

            location.href = `share.html?id=${encodeURIComponent(post.id)}`;

        });

    }






    // =========================
    // リアクション機能
    // =========================


    const reactionKey =
    `reaction_${id}`;

    const reactionSelectionKey =
    `reactionSelection_${id}`;



    let reactions =
    JSON.parse(localStorage.getItem(reactionKey))
    ||
    {

        thanks:0,
        reference:0,
        try:0,
        done:0,
        idea:0,
        question:0

    };

    const storedReactionSelections =
    JSON.parse(localStorage.getItem(reactionSelectionKey))
    ||
    {};

    const reactionSelections = {
        thanks: storedReactionSelections.thanks || reactions.thanks > 0,
        reference: storedReactionSelections.reference || reactions.reference > 0,
        try: storedReactionSelections.try || reactions.try > 0,
        done: storedReactionSelections.done || reactions.done > 0,
        idea: storedReactionSelections.idea || reactions.idea > 0,
        question: storedReactionSelections.question || reactions.question > 0
    };

    function addReactionOnce(type) {

        if (reactionSelections[type]) {
            return false;
        }

        reactions[type] = (reactions[type] || 0) + 1;
        reactionSelections[type] = true;

        localStorage.setItem(
            reactionKey,
            JSON.stringify(reactions)
        );

        localStorage.setItem(
            reactionSelectionKey,
            JSON.stringify(reactionSelections)
        );

        return true;

    }





    const buttons =
    document.querySelectorAll(".reaction button");



    buttons.forEach(button=>{


        const type =
        button.dataset.reaction;



        const count =
        button.querySelector(".reaction-count");



        if(count){

            count.textContent =
            reactions[type] || 0;

        }

        if (reactionSelections[type]) {
            button.disabled = true;
            button.setAttribute("aria-pressed", "true");
        }



        button.addEventListener("click",()=>{


            if (!addReactionOnce(type)) {
                return;
            }


            if(count){

                count.textContent =
                reactions[type];

            }



            button.disabled = true;
            button.setAttribute("aria-pressed", "true");


        });


    });






    // =========================
    // 🤝ありがとうメッセージ
    // =========================


    const thanksKey =
    `thanksMessage_${id}`;



    const storedThanksMessages =
    JSON.parse(localStorage.getItem(thanksKey))
    ||
    [];

    let thanksMessages = Array.isArray(storedThanksMessages)
    ? storedThanksMessages
    : [];



    const thanksList =
    document.getElementById("thanksList");



    const thanksMessage =
    document.getElementById("thanksMessage");



    const thanksButton =
    document.getElementById("thanksButton");



    const thanksActionStatus =
    document.getElementById("thanksActionStatus");



    function setThanksActionError(message){


        if(!thanksActionStatus){

            return;

        }


        thanksActionStatus.textContent = message;
        thanksActionStatus.hidden = false;


    }



    function clearThanksActionError(){


        if(!thanksActionStatus){

            return;

        }


        thanksActionStatus.textContent = "";
        thanksActionStatus.hidden = true;


    }





    // 表示処理

    function displayThanks(){


        if(!thanksList){

            return;

        }



        thanksList.innerHTML = "";



        thanksMessages
        .map((item, index) => ({ item, index }))
        .reverse()
        .forEach(({ item, index })=>{


            const div =
            document.createElement("div");


            div.className =
            "thanks-item";



            const datetime =
            document.createElement("p");


            datetime.className =
            "thanks-item-datetime";


            datetime.textContent =
            `🤝 ${item.datetime || ""}`;



            const message =
            document.createElement("p");


            message.className =
            "thanks-item-message";


            message.textContent =
            item.message || "";


            div.append(datetime, message);



            const canDelete =
            auth.currentUser
            && typeof item.authorId === "string"
            && item.authorId === auth.currentUser.uid;



            if(canDelete){


                const deleteButton =
                document.createElement("button");


                deleteButton.type = "button";
                deleteButton.className = "thanks-delete-button";
                deleteButton.textContent = "🗑️ 削除";


                deleteButton.addEventListener("click",()=>{


                    const confirmed = confirm(
                        "このありがとうメッセージを削除します。よろしいですか？"
                    );


                    if(!confirmed){

                        return;

                    }


                    if(!auth.currentUser || item.authorId !== auth.currentUser.uid){

                        setThanksActionError("このメッセージを削除する権限がありません。");
                        return;

                    }


                    deleteButton.disabled = true;
                    deleteButton.textContent = "削除中…";
                    clearThanksActionError();


                    const updatedMessages = thanksMessages.filter((messageItem, messageIndex) => {
                        return messageIndex !== index;
                    });


                    try{


                        localStorage.setItem(
                            thanksKey,
                            JSON.stringify(updatedMessages)
                        );


                        thanksMessages = updatedMessages;
                        displayThanks();


                    }catch(error){


                        console.error("ありがとうメッセージの削除エラー:", error);
                        setThanksActionError("メッセージを削除できませんでした。時間をおいて再度お試しください。");
                        deleteButton.disabled = false;
                        deleteButton.textContent = "🗑️ 削除";


                    }


                });


                div.appendChild(deleteButton);


            }



            thanksList.appendChild(div);


        });


    }




    onAuthStateChanged(auth, displayThanks);







    // 送信処理

    if(thanksButton){


        thanksButton.addEventListener("click",()=>{


            if(!thanksMessage){

                return;

            }



            const currentUser = auth.currentUser;


            if(!currentUser){


                alert("ありがとうメッセージを送信するにはGoogleでサインインしてください。");
                return;


            }



            const text =
            thanksMessage.value.trim();




            if(text===""){


                alert(
                "メッセージを入力してください"
                );


                return;


            }





            const now =
            new Date();



            const datetime =

            now.getFullYear()
            + "/"
            +
            String(now.getMonth()+1)
            .padStart(2,"0")
            + "/"
            +
            String(now.getDate())
            .padStart(2,"0")
            + " "
            +
            String(now.getHours())
            .padStart(2,"0")
            + ":"
            +
            String(now.getMinutes())
            .padStart(2,"0");







            // 匿名メッセージ保存

            thanksMessages.push({

                id:crypto.randomUUID(),

                message:text,

                datetime:datetime,

                authorId:currentUser.uid

            });





            localStorage.setItem(

                thanksKey,

                JSON.stringify(thanksMessages)

            );







            // 🤝ありがとう数は同じブラウザでは1回だけ増加

            const addedThanksReaction = addReactionOnce("thanks");




            const thanksCount =

            document.querySelector(

            '[data-reaction="thanks"] .reaction-count'

            );



            if(thanksCount && addedThanksReaction){


                thanksCount.textContent =
                reactions.thanks;

                const thanksButton = thanksCount.closest("button");

                if (thanksButton) {
                    thanksButton.disabled = true;
                    thanksButton.setAttribute("aria-pressed", "true");
                }


            }




            thanksMessage.value = "";


            clearThanksActionError();



            displayThanks();



        });


    }



})

.catch(error => {

    console.error("読み込みエラー:", error);

    const card = document.querySelector(".card");

    if (card) {
        card.innerHTML = "<h2>投稿が見つかりません</h2>";
    }

});
