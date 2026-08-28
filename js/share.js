// =========================
// RELAY share.js
// 印刷用ページ + 従来の共有一覧
// =========================


const params = new URLSearchParams(window.location.search);
const postId = params.get("id");
const postList = document.getElementById("post-list");
const printSheet = document.getElementById("printSheet");
const printActions = document.getElementById("printActions");
const printButton = document.getElementById("printButton");
const printBackLink = document.getElementById("printBackLink");


function getFirstAttachmentImage(post) {

    const attachments = Array.isArray(post.attachments) ? post.attachments : [];
    const imageAttachment = attachments.find(attachment =>
        attachment
        && attachment.category === "image"
        && typeof attachment.downloadUrl === "string"
        && attachment.downloadUrl
    );

    return imageAttachment || null;

}


function setText(id, value, fallback = "記載なし") {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value || "").trim() || fallback;
    }

}


function renderPrintPost(post) {

    const tags = Array.isArray(post.aiTags)
        ? post.aiTags.filter(Boolean)
        : (Array.isArray(post.tags) ? post.tags.filter(Boolean) : []);
    const attachments = Array.isArray(post.attachments)
        ? post.attachments.filter(attachment => attachment && typeof attachment === "object")
        : [];
    const imageAttachment = getFirstAttachmentImage(post);

    document.title = `${post.title || "実践"} | RELAY Lab 印刷用ページ`;
    setText("printTitle", post.title, "実践タイトル未設定");
    setText("printDepartment", post.schoolDivision);
    setText("printPurpose", post.purpose);
    setText("printMethod", post.howToUse);
    setText("printReflection", post.reflection || post.practice);
    setText("printDate", new Intl.DateTimeFormat("ja-JP").format(new Date()), "");

    if (postId && printBackLink) {
        printBackLink.href = `detail.html?id=${encodeURIComponent(postId)}`;
    }

    const imageArea = document.getElementById("printImageArea");
    const image = document.getElementById("printImage");

    if (imageAttachment && imageArea && image) {
        image.src = imageAttachment.downloadUrl;
        image.alt = imageAttachment.name
            ? `${imageAttachment.name}の代表画像`
            : "実践の代表画像";
        imageArea.hidden = false;
    }

    const tagsSection = document.getElementById("printTagsSection");
    const tagsArea = document.getElementById("printTags");

    if (tags.length > 0 && tagsSection && tagsArea) {
        tags.forEach(tag => {
            const item = document.createElement("span");
            item.textContent = `#${String(tag).replace(/^#/, "")}`;
            tagsArea.appendChild(item);
        });
        tagsSection.hidden = false;
    }

    const attachmentsSection = document.getElementById("printAttachmentsSection");
    const attachmentsList = document.getElementById("printAttachments");

    if (attachments.length > 0 && attachmentsSection && attachmentsList) {
        attachments.forEach(attachment => {
            const item = document.createElement("li");
            item.textContent = attachment.name || "添付資料";
            attachmentsList.appendChild(item);
        });
        attachmentsSection.hidden = false;
    }

    if (postList) {
        postList.hidden = true;
    }

    if (printSheet) {
        printSheet.hidden = false;
    }

    if (printActions) {
        printActions.hidden = false;
    }

}


async function loadPrintPost() {

    if (!postId) return null;

    const sessionPost = JSON.parse(
        sessionStorage.getItem(`relayPrintPost_${postId}`)
        || "null"
    );

    if (sessionPost) {
        return sessionPost;
    }

    const savedPosts = JSON.parse(localStorage.getItem("relayPosts")) || [];
    const savedPost = Array.isArray(savedPosts)
        ? savedPosts.find(post => String(post.id) === String(postId))
        : null;

    if (savedPost) {
        return savedPost;
    }

    const response = await fetch("./data/posts.json");
    const posts = await response.json();

    return Array.isArray(posts)
        ? posts.find(post => String(post.id) === String(postId)) || null
        : null;

}


async function renderLegacyPostList() {

    if (!postList) return;

    const response = await fetch("./data/posts.json");
    const posts = await response.json();

    postList.innerHTML = "";

    if (!Array.isArray(posts) || posts.length === 0) {
        postList.innerHTML =
        '<p class="posts-empty-message">現在、共有できる実践はまだありません。トップページの新着実践をご覧ください。</p>';
        return;
    }

    posts.forEach(post => {
        const card = document.createElement("div");
        const title = document.createElement("h3");
        const summary = document.createElement("p");
        const tags = document.createElement("p");
        const link = document.createElement("a");

        card.className = "post-card";
        title.textContent = post.title || "実践";
        summary.textContent = post.aiSummary || "";
        tags.textContent = `🏷 ${(post.aiTags || []).join(" / ")}`;
        link.href = `detail.html?id=${encodeURIComponent(post.id)}`;
        link.textContent = "詳細を見る";
        card.append(title, summary, tags, link);
        postList.appendChild(card);
    });

}


if (printButton) {
    printButton.addEventListener("click", () => window.print());
}


if (postId) {
    loadPrintPost()
        .then(post => {
            if (!post) {
                throw new Error("印刷する投稿が見つかりません");
            }
            renderPrintPost(post);
        })
        .catch(error => {
            console.error("印刷用データの読み込みエラー:", error);
            if (postList) {
                postList.innerHTML = "<p>印刷する実践を読み込めませんでした。詳細ページからもう一度開いてください。</p>";
            }
        });
} else {
    renderLegacyPostList().catch(error => {
        console.error("読み込みエラー:", error);
        if (postList) {
            postList.innerHTML = "<p>投稿データを読み込めませんでした。</p>";
        }
    });
}
