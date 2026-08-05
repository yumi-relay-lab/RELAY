fetch("data/posts.json")
  .then(response => response.json())
  .then(posts => {


    // ブラウザ保存された投稿を取得
    const savedPosts =
      JSON.parse(localStorage.getItem("relayPosts")) || [];


    // 既存データ＋新規投稿
    posts = posts.concat(savedPosts);



    const postsArea = document.getElementById("posts");


    postsArea.innerHTML = "";


    posts.forEach(post => {


      const card = document.createElement("article");


      card.className = "card";


      card.innerHTML = `

        <img src="${post.image}" alt="${post.title}">


        <h2>${post.title}</h2>


        <p class="division">
          ${post.schoolDivision}
        </p>


        <p class="summary">
          ${post.aiSummary}
        </p>


        <div class="tags">
          ${post.aiTags.map(tag => `<span>#${tag}</span>`).join("")}
        </div>


        <a class="detail-button" href="detail.html?id=${post.id}">
          ▶ 詳細を見る
        </a>


      `;


      postsArea.appendChild(card);


    });


  })


  .catch(error => {

    console.error("読み込みエラー:", error);

  });