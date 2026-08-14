// =========================
// RELAY detail.js Ver1.2
// 詳細表示 + リアクション + 🤝ありがとう機能
// =========================

import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


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
                ...snapshot.data(),
                id: snapshot.id
            };
        }

    } catch (error) {

        console.error("Firestore投稿の読み込みエラー:", error);

    }

    return samplePosts
        .concat(savedPosts)
        .find(item => String(item.id) === id)
        || null;

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
            const preview = document.createElement("img");
            preview.className = "detail-attachment-preview";
            preview.src = downloadUrl;
            preview.alt = attachment.name || "添付画像";
            preview.loading = "lazy";
            preview.addEventListener("error", () => {
                preview.remove();
                item.appendChild(createUnavailableMessage());
            }, { once: true });
            item.appendChild(preview);
        } else {
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


loadPost()

.then(post => {



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


        const tags = post.aiTags || post.tags || [];

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



    buttons.forEach(button=>{


        const type =
        button.dataset.reaction;



        const count =
        button.querySelector(".reaction-count");



        if(count){

            count.textContent =
            reactions[type] || 0;

        }



        button.addEventListener("click",()=>{


            reactions[type]++;


            if(count){

                count.textContent =
                reactions[type];

            }



            localStorage.setItem(

                reactionKey,

                JSON.stringify(reactions)

            );


        });


    });






    // =========================
    // 🤝ありがとうメッセージ
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





    // 表示処理

    function displayThanks(){


        if(!thanksList){

            return;

        }



        thanksList.innerHTML = "";



        thanksMessages
        .slice()
        .reverse()
        .forEach(item=>{


            const div =
            document.createElement("div");


            div.className =
            "thanks-item";



            div.innerHTML =

            "🤝 " +
            item.datetime +
            "<br><br>" +
            item.message;



            thanksList.appendChild(div);


        });


    }




    displayThanks();







    // 送信処理

    if(thanksButton){


        thanksButton.addEventListener("click",()=>{


            if(!thanksMessage){

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

                message:text,

                datetime:datetime

            });





            localStorage.setItem(

                thanksKey,

                JSON.stringify(thanksMessages)

            );







            // 🤝ありがとう数も増加

            reactions.thanks++;



            localStorage.setItem(

                reactionKey,

                JSON.stringify(reactions)

            );




            const thanksCount =

            document.querySelector(

            '[data-reaction="thanks"] .reaction-count'

            );



            if(thanksCount){


                thanksCount.textContent =
                reactions.thanks;


            }




            thanksMessage.value = "";



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
