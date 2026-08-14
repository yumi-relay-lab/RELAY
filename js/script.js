import { db } from "./firebase.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


function getPostComparisonKey(post) {

  return [
    post.authorName || post.author || "",
    post.schoolDivision || "",
    post.title || "",
    post.purpose || "",
    post.howToUse || "",
    post.reflection || ""
  ]
    .map(value => String(value).trim())
    .join("\u0000");

}


function getFirstAttachmentImage(post) {

  const attachments = Array.isArray(post.attachments) ? post.attachments : [];
  const imageAttachment = attachments.find(attachment =>
    attachment.category === "image"
    && typeof attachment.downloadUrl === "string"
    && attachment.downloadUrl
  );

  return imageAttachment ? imageAttachment.downloadUrl : "";

}


async function loadPosts() {

  const response = await fetch("data/posts.json");
  const samplePosts = await response.json();
  const savedPosts = JSON.parse(localStorage.getItem("relayPosts")) || [];

  let firestorePosts = [];

  try {

    const snapshot = await getDocs(collection(db, "posts"));

    firestorePosts = snapshot.docs.map(document => ({
      ...document.data(),
      id: document.id
    }));

  } catch (error) {

    // Firestoreを取得できない場合も、従来の投稿一覧は表示する
    console.error("Firestore投稿の読み込みエラー:", error);

  }

  const firestoreIds = new Set(
    firestorePosts.map(post => String(post.id))
  );
  const firestorePostKeys = new Set(
    firestorePosts.map(getPostComparisonKey)
  );

  const uniqueSavedPosts = savedPosts.filter(post => {

    const hasSameId = firestoreIds.has(String(post.id));
    const hasSameContent = firestorePostKeys.has(getPostComparisonKey(post));

    return !hasSameId && !hasSameContent;

  });

  // 同じ投稿が両方にある場合は、Firestore側のデータを一覧に残す
  return samplePosts.concat(uniqueSavedPosts, firestorePosts);

}


function displayPosts(posts) {

  const postsArea = document.getElementById("posts");
  postsArea.innerHTML = "";

  posts.forEach(post => {

    const card = document.createElement("article");
    const imageUrl = getFirstAttachmentImage(post);
    const authorName = post.authorName || post.author || "";
    const tags = post.aiTags || post.tags || [];

    card.className = "card";

    card.innerHTML = `
      ${imageUrl ? `<img src="${imageUrl}" alt="${post.title}">` : ""}

      <h2>${post.title}</h2>

      <p class="division">
        ${post.schoolDivision || ""}
      </p>

      <p class="author">
        実践者：${authorName}
      </p>

      <p class="summary">
        ${post.aiSummary || ""}
      </p>

      <div class="tags">
        ${tags.map(tag => `<span>#${tag}</span>`).join("")}
      </div>

      <a class="detail-button" href="detail.html?id=${encodeURIComponent(post.id)}">
        ▶ 詳細を見る
      </a>
    `;

    postsArea.appendChild(card);

  });

}


loadPosts()
  .then(displayPosts)
  .catch(error => {
    console.error("読み込みエラー:", error);
  });
