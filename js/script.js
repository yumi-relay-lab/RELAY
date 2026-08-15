import { db } from "./firebase.js";
import { TAG_CANDIDATES } from "./tags.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

let allPosts = [];
let selectedSchoolDivision = "";
const selectedTagFilters = new Set();
const POSTS_PER_PAGE = 10;
let visiblePostCount = POSTS_PER_PAGE;
let currentFilteredPosts = [];


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


function getCreatedAtMilliseconds(post) {

  const createdAt = post && post.createdAt;

  if (!createdAt) return null;

  if (typeof createdAt.toMillis === "function") {
    return createdAt.toMillis();
  }

  if (typeof createdAt.toDate === "function") {
    return createdAt.toDate().getTime();
  }

  if (typeof createdAt === "object" && Number.isFinite(createdAt.seconds)) {
    return createdAt.seconds * 1000;
  }

  const milliseconds = new Date(createdAt).getTime();

  return Number.isFinite(milliseconds) ? milliseconds : null;

}


function formatPostDate(post) {

  const milliseconds = getCreatedAtMilliseconds(post);

  if (milliseconds === null) return "";

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(milliseconds));

}


function sortPostsByCreatedAt(posts) {

  return posts
    .map((post, originalIndex) => ({
      post,
      originalIndex,
      createdAt: getCreatedAtMilliseconds(post)
    }))
    .sort((first, second) => {

      if (first.createdAt === null && second.createdAt === null) {
        return first.originalIndex - second.originalIndex;
      }

      if (first.createdAt === null) return 1;
      if (second.createdAt === null) return -1;

      return second.createdAt - first.createdAt
        || first.originalIndex - second.originalIndex;

    })
    .map(item => item.post);

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
  return sortPostsByCreatedAt(
    samplePosts.concat(uniqueSavedPosts, firestorePosts)
  );

}


function normalizeSearchText(value) {

  return String(value || "").trim().toLocaleLowerCase("ja");

}


function matchesSearch(post, keyword) {

  if (!keyword) return true;

  const tags = Array.isArray(post.aiTags) ? post.aiTags : [];
  const searchableValues = [
    post.title,
    post.purpose,
    post.howToUse,
    post.reflection,
    post.schoolDivision,
    ...tags
  ];

  return searchableValues.some(value =>
    normalizeSearchText(value).includes(keyword)
  );

}


function matchesSchoolDivision(post, schoolDivision) {

  return !schoolDivision
    || normalizeSearchText(post.schoolDivision) === normalizeSearchText(schoolDivision);

}


function matchesTagFilters(post, selectedTags) {

  if (selectedTags.size === 0) return true;

  const postTags = Array.isArray(post.aiTags) ? post.aiTags : [];

  return Array.from(selectedTags).some(selectedTag =>
    postTags.some(postTag => String(postTag).trim() === selectedTag)
  );

}


function createPostCard(post) {

  const card = document.createElement("article");
  const media = document.createElement("div");
  const content = document.createElement("div");
  const imageUrl = getFirstAttachmentImage(post);
  const authorName = post.authorName || post.author || "";
  const postDate = formatPostDate(post);
  const tags = Array.isArray(post.aiTags)
    ? post.aiTags
    : (Array.isArray(post.tags) ? post.tags : []);

  card.className = "card";
  media.className = "card-media";
  content.className = "card-content";

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = post.title || "実践の添付画像";
    image.loading = "lazy";
    media.appendChild(image);
  } else {
    const placeholder = document.createElement("div");
    const placeholderIcon = document.createElement("span");
    const placeholderText = document.createElement("span");

    placeholder.className = "card-image-placeholder";
    placeholderIcon.className = "card-image-placeholder-icon";
    placeholderIcon.setAttribute("aria-hidden", "true");
    placeholderIcon.textContent = "📘";
    placeholderText.textContent = "実践資料";
    placeholder.append(placeholderIcon, placeholderText);
    media.appendChild(placeholder);
  }

  const title = document.createElement("h2");
  title.textContent = post.title || "無題の実践";

  const division = document.createElement("p");
  division.className = "division";
  division.textContent = post.schoolDivision || "";

  const author = document.createElement("p");
  author.className = "author";
  author.textContent = `実践者：${authorName}`;

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = post.purpose || post.aiSummary || "";

  const tagsArea = document.createElement("div");
  tagsArea.className = "tags";

  tags.forEach(tag => {
    const tagElement = document.createElement("span");
    tagElement.textContent = `#${tag}`;
    tagsArea.appendChild(tagElement);
  });

  const detailLink = document.createElement("a");
  detailLink.className = "detail-button";
  detailLink.href = `detail.html?id=${encodeURIComponent(post.id)}`;
  detailLink.textContent = "▶ 詳細を見る";

  const cardMeta = document.createElement("div");
  cardMeta.className = "card-meta";
  cardMeta.appendChild(author);

  if (postDate) {
    const date = document.createElement("p");
    date.className = "post-date";
    date.textContent = `投稿日：${postDate}`;
    cardMeta.appendChild(date);
  }

  content.append(title, division, summary, tagsArea, cardMeta, detailLink);
  card.append(media, content);

  return card;

}


function displayPosts(posts) {

  const postsArea = document.getElementById("posts");
  postsArea.replaceChildren();

  if (posts.length === 0) {
    const message = document.createElement("p");

    message.className = "posts-empty-message";
    message.textContent = allPosts.length === 0
      ? "まだ投稿はありません。最初の実践を投稿してみましょう。"
      : "選択した条件に一致する実践は見つかりませんでした。検索キーワード・学部・タグを変えてみてください。";
    postsArea.appendChild(message);
    return;
  }

  posts.forEach(post => {

    postsArea.appendChild(createPostCard(post));

  });

}


function renderVisiblePosts() {

  const loadMoreButton = document.getElementById("loadMoreButton");
  const visiblePosts = currentFilteredPosts.slice(0, visiblePostCount);

  displayPosts(visiblePosts);

  if (loadMoreButton) {
    loadMoreButton.hidden = currentFilteredPosts.length <= visiblePostCount;
  }

}


function applySearch() {

  const input = document.getElementById("postSearchInput");
  const clearButton = document.getElementById("clearSearchButton");
  const resultCount = document.getElementById("searchResultCount");
  const originalKeyword = input ? input.value.trim() : "";
  const keyword = normalizeSearchText(originalKeyword);
  currentFilteredPosts = allPosts.filter(post => {
    const matchesKeyword = matchesSearch(post, keyword);
    const matchesDivision = matchesSchoolDivision(post, selectedSchoolDivision);
    const matchesTags = matchesTagFilters(post, selectedTagFilters);

    return matchesKeyword && matchesDivision && matchesTags;
  });

  visiblePostCount = POSTS_PER_PAGE;

  if (clearButton) {
    clearButton.hidden = !originalKeyword
      && !selectedSchoolDivision
      && selectedTagFilters.size === 0;
  }

  if (resultCount) {
    const selectedTags = Array.from(selectedTagFilters);
    const tagDescription = selectedTags.length > 0
      ? `タグ「${selectedTags.join("、")}」`
      : "";

    if (tagDescription) {
      const conditions = [
        selectedSchoolDivision,
        originalKeyword ? `“${originalKeyword}”` : "",
        tagDescription
      ].filter(Boolean);

      resultCount.textContent = conditions.length === 1
        ? `${tagDescription}：${currentFilteredPosts.length}件`
        : `${conditions.join("・")}の絞り込み結果：${currentFilteredPosts.length}件`;
    } else if (originalKeyword && selectedSchoolDivision) {
      resultCount.textContent = `${selectedSchoolDivision}で “${originalKeyword}” の検索結果：${currentFilteredPosts.length}件`;
    } else if (originalKeyword) {
      resultCount.textContent = `“${originalKeyword}” の検索結果：${currentFilteredPosts.length}件`;
    } else if (selectedSchoolDivision) {
      resultCount.textContent = `${selectedSchoolDivision}の実践：${currentFilteredPosts.length}件`;
    } else {
      resultCount.textContent = `${currentFilteredPosts.length}件の実践`;
    }
  }

  renderVisiblePosts();

}


function renderTagFilterOptions() {

  const container = document.getElementById("tagFilterOptions");

  if (!container) return;

  TAG_CANDIDATES.forEach(tag => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "tag-filter-button";
    button.dataset.tag = tag;
    button.setAttribute("aria-pressed", "false");
    button.textContent = tag;
    container.appendChild(button);
  });

}


function updateDivisionFilterButtons() {

  const buttons = document.querySelectorAll(".division-filter-button");

  buttons.forEach(button => {
    const isSelected = button.dataset.division === selectedSchoolDivision;

    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

}


function updateTagFilterButtons() {

  const buttons = document.querySelectorAll(".tag-filter-button");
  const summary = document.getElementById("tagFilterSummary");

  buttons.forEach(button => {
    const isSelected = selectedTagFilters.has(button.dataset.tag);

    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  if (summary) {
    summary.textContent = selectedTagFilters.size > 0
      ? `タグで絞り込む（${selectedTagFilters.size}件選択中）`
      : "タグで絞り込む";
  }

}


function setupSearch() {

  renderTagFilterOptions();

  const form = document.getElementById("searchForm");
  const input = document.getElementById("postSearchInput");
  const clearButton = document.getElementById("clearSearchButton");
  const loadMoreButton = document.getElementById("loadMoreButton");
  const tagFilterToggle = document.getElementById("tagFilterToggle");
  const tagFilterOptions = document.getElementById("tagFilterOptions");
  const divisionButtons = document.querySelectorAll(".division-filter-button");
  const tagButtons = document.querySelectorAll(".tag-filter-button");

  if (tagFilterToggle && tagFilterOptions) {
    tagFilterToggle.addEventListener("click", () => {
      const willOpen = tagFilterOptions.hidden;

      tagFilterOptions.hidden = !willOpen;
      tagFilterToggle.setAttribute("aria-expanded", String(willOpen));
      tagFilterToggle.textContent = willOpen ? "タグを閉じる ▴" : "タグを表示 ▾";
    });
  }

  if (form) {
    form.addEventListener("submit", event => {
      event.preventDefault();
      applySearch();
    });
  }

  if (input) {
    input.addEventListener("input", () => applySearch());
  }

  if (clearButton && input) {
    clearButton.addEventListener("click", () => {
      input.value = "";
      selectedSchoolDivision = "";
      selectedTagFilters.clear();
      updateDivisionFilterButtons();
      updateTagFilterButtons();
      applySearch();
      input.focus();
    });
  }

  divisionButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedSchoolDivision = button.dataset.division || "";
      updateDivisionFilterButtons();
      applySearch();
    });
  });

  tagButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tag = button.dataset.tag;

      if (selectedTagFilters.has(tag)) {
        selectedTagFilters.delete(tag);
      } else {
        selectedTagFilters.add(tag);
      }

      updateTagFilterButtons();
      applySearch();
    });
  });

  if (loadMoreButton) {
    loadMoreButton.addEventListener("click", () => {
      visiblePostCount += POSTS_PER_PAGE;
      renderVisiblePosts();
    });
  }

}


setupSearch();

loadPosts()
  .then(posts => {
    allPosts = posts;
    applySearch();
  })
  .catch(error => {
    console.error("読み込みエラー:", error);

    const resultCount = document.getElementById("searchResultCount");
    const postsArea = document.getElementById("posts");
    const loadMoreButton = document.getElementById("loadMoreButton");

    if (resultCount) {
      resultCount.textContent = "投稿を読み込めませんでした";
    }

    if (postsArea) {
      const message = document.createElement("p");
      message.className = "posts-empty-message";
      message.textContent = "投稿の読み込みに失敗しました。時間をおいて再度お試しください。";
      postsArea.replaceChildren(message);
    }

    if (loadMoreButton) {
      loadMoreButton.hidden = true;
    }
  });
