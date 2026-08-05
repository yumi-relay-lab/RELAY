// =========================
// RELAY detail.js
// 詳細表示 + リアクション + 🤝ありがとう機能
// =========================


// URLからIDを取得

const params = new URLSearchParams(window.location.search);

const id = Number(params.get("id"));



// 投稿データ読み込み

fetch("../data/posts.json")

.then(response => response.json())

.then(posts => {


    const post = posts.find(item => item.id === id);



    if(!post){

        document.querySelector(".card").innerHTML =
        "<h2>投稿が見つかりません</h2>";

        return;

    }



    // =========================
    // 詳細表示
    // =========================


    document.getElementById("title").textContent =
    post.title;



    document.getElementById("image").src =
    post.image || "";



    document.getElementById("department").textContent =
    post.schoolDivision;



    document.getElementById("purpose").textContent =
    post.purpose;



    document.getElementById("method").textContent =
    post.howToUse;



    document.getElementById("practice").textContent =
    post.practice || "";



    // タグ表示

    const tagArea =
    document.getElementById("tags");


    tagArea.innerHTML = "";


    if(post.tags){

        post.tags.forEach(tag => {


            const span =
            document.createElement("span");


            span.className = "tag";

            span.textContent = tag;


            tagArea.appendChild(span);


        });

    }



    // =========================
    // リアクション機能
    // =========================


    const reactionKey =
    `reaction_${id}`;


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



    const buttons =
    document.querySelectorAll(".reaction button");



    buttons.forEach(button => {


        const type =
        button.dataset.reaction;


        const count =
        button.querySelector(".reaction-count");



        count.textContent =
        reactions[type];



        button.addEventListener("click",()=>{


            reactions[type]++;


            count.textContent =
            reactions[type];


            localStorage.setItem(
                reactionKey,
                JSON.stringify(reactions)
            );


        });


    });





    // =========================
    // 🤝ありがとうメッセージ機能
    // =========================


    const thanksKey =
    `thanksMessage_${id}`;



    let thanksMessages =
    JSON.parse(localStorage.getItem(thanksKey))
    ||
    [];



    const thanksList =
    document.getElementById("thanksList");



    const thanksMessage =
    document.getElementById("thanksMessage");



    const thanksButton =
    document.getElementById("thanksButton");




    // 表示

    function displayThanks(){


        thanksList.innerHTML = "";



        thanksMessages.forEach(message=>{


            const div =
            document.createElement("div");


            div.className =
            "thanks-item";



            div.textContent =
            "🤝 " + message;



            thanksList.appendChild(div);


        });


    }



    displayThanks();





    // 送信

    thanksButton.addEventListener("click",()=>{


        const text =
        thanksMessage.value.trim();



        if(text===""){

            alert("メッセージを入力してください");

            return;

        }



        thanksMessages.push(text);



        localStorage.setItem(
            thanksKey,
            JSON.stringify(thanksMessages)
        );



        thanksMessage.value="";



        displayThanks();


    });



});