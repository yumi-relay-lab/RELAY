const button = document.querySelector(".submit-button");

button.addEventListener("click", function () {

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

        image: "",

        aiSummary:
        "先生の実践投稿です。",

        aiTags:
        ["実践共有"]

    };

    // 既存データを取得
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