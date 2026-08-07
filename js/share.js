// =========================
// RELAY share.js
// 投稿一覧表示
// =========================


const postList = document.getElementById("post-list");


// 投稿データ読み込み

fetch("./data/posts.json")

.then(response => response.json())

.then(posts => {


    postList.innerHTML = "";


    posts.forEach(post => {


        const card = document.createElement("div");

        card.className = "post-card";


        card.innerHTML = `

            <h3>${post.title}</h3>

            <p>${post.aiSummary}</p>

            <p>🏷 ${post.aiTags.join(" / ")}</p>


            <a href="detail.html?id=${post.id}">
                詳細を見る
            </a>

        `;


        postList.appendChild(card);


    });


})

.catch(error => {

    console.error("読み込みエラー:", error);

    postList.innerHTML =
    "<p>投稿データを読み込めませんでした。</p>";

});