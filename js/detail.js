// ================================
// RELAY detail.js Ver1.1
// リアクション機能対応版
// ================================


// URLからID取得

const params = new URLSearchParams(window.location.search);
const id = Number(params.get("id"));

console.log("URL:", window.location.href);
console.log("ID:", id);



// 投稿データ読み込み

fetch("data/posts.json")

.then(response => response.json())

.then(posts => {


    // localStorageの投稿取得

    const savedPosts =
        JSON.parse(localStorage.getItem("relayPosts")) || [];



    // 初期データ＋新規投稿

    posts = posts.concat(savedPosts);



    console.log("全投稿:", posts);



    // 該当投稿検索

    const post =
        posts.find(item => item.id === id);



    console.log("表示投稿:", post);



    if(!post){

        document.getElementById("title").textContent =
            "このページは一覧から実践を選択して開いてください。";

        return;

    }





    // =========================
    // 基本情報表示
    // =========================


    document.getElementById("title").textContent =
        post.title || "";



    document.getElementById("department").textContent =
        post.schoolDivision || "";





    // =========================
    // 画像（任意項目）
    // =========================


    const image =
        document.getElementById("image");


    if(post.image){

        image.src = post.image;

        image.style.display = "block";

    }else{

        image.style.display = "none";

    }







    // =========================
    // タグ表示
    // =========================


    const tags =
        post.aiTags || post.tags || [];



    document.getElementById("tags").innerHTML =

        tags.map(tag =>

            `<span class="tag">#${tag}</span>`

        ).join("");









    // =========================
    // 実践内容
    // =========================


    document.getElementById("purpose").textContent =
        post.purpose || "";



    document.getElementById("method").textContent =
        post.howToUse || "";



    document.getElementById("practice").textContent =
        post.reflection ||
        "実践の振り返りは登録されていません。";






    // =========================
    // リアクション読み込み
    // =========================


    loadReactions(id);





    // =========================
    // リアクションボタン設定
    // =========================


    const buttons =
        document.querySelectorAll(".reaction button");



    buttons.forEach(button => {


        const type =
            button.dataset.reaction;



        button.addEventListener("click",()=>{


            addReaction(id,type,button);


        });



    });



})



.catch(error => {

    console.error(
        "読み込みエラー:",
        error
    );

});









// =================================
// リアクション保存データ取得
// =================================


function getReactionData(){


    return JSON.parse(

        localStorage.getItem("relayReactions")

    ) || {};

}









// =================================
// リアクション表示
// =================================


function loadReactions(postId){


    const data =
        getReactionData();



    const reactions =
        data[postId] || {};



    document
    .querySelectorAll(".reaction button")
    .forEach(button=>{


        const type =
            button.dataset.reaction;



        const count =
            reactions[type] || 0;



        button.querySelector(".reaction-count")
        .textContent = count;



        // 押した履歴確認

        const key =
            `relay_${postId}_${type}`;



        if(localStorage.getItem(key)){


            button.textContent =
                button.textContent + " ✓";


            button.disabled = true;


        }



    });



}









// =================================
// リアクション追加
// =================================


function addReaction(postId,type,button){



    const key =
        `relay_${postId}_${type}`;



    // 2回押し防止

    if(localStorage.getItem(key)){

        return;

    }





    const data =
        getReactionData();



    if(!data[postId]){

        data[postId] = {};

    }



    if(!data[postId][type]){

        data[postId][type] = 0;

    }



    data[postId][type]++;




    localStorage.setItem(

        "relayReactions",

        JSON.stringify(data)

    );



    // 押した記録

    localStorage.setItem(

        key,

        "true"

    );



    // 表示更新

    const count =
        button.querySelector(".reaction-count");



    count.textContent =
        data[postId][type];



    button.disabled = true;



    button.textContent =
        button.textContent + " ✓";



}