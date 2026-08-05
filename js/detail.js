// URLからIDを取得
const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));
console.log(window.location.href);
console.log(window.location.search);

// 投稿データを読み込み
fetch("data/posts.json")
  .then(response => response.json())
  .then(posts => {

    console.log("URLのid =", id);
    console.log("posts =", posts);
    console.log("postsのid =", posts.map(p => p.id));

    // ブラウザ保存された投稿を取得
    const savedPosts =
      JSON.parse(localStorage.getItem("relayPosts")) || [];

    // 既存データ＋新規投稿
    posts = posts.concat(savedPosts);

    console.log("結合後のposts =", posts);

    const post = posts.find(item => item.id === id);

    console.log("検索結果 =", post);

    if (!post) {
      document.getElementById("title").textContent =
        "実践が見つかりませんでした";
      return;
    }

    // 基本情報
    document.getElementById("title").textContent = post.title;
    document.getElementById("image").src = post.image;
    document.getElementById("department").textContent = post.schoolDivision;

    // タグ表示
    document.getElementById("tags").innerHTML =
      post.aiTags
        .map(tag => `<span class="tag">#${tag}</span>`)
        .join("");

    // 実践内容
    document.getElementById("purpose").textContent = post.purpose;
    document.getElementById("method").textContent = post.howToUse;
    document.getElementById("practice").textContent = post.reflection;

  })
  .catch(error => {
    console.error("読み込みエラー:", error);
  });