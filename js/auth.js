import { auth } from "./firebase.js";

import {
    GoogleAuthProvider,
    browserLocalPersistence,
    onAuthStateChanged,
    setPersistence,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


const signInButton = document.getElementById("googleSignInButton");
const signOutButton = document.getElementById("signOutButton");
const authStatus = document.getElementById("authStatus");


function setStatus(message) {

    if (authStatus) {
        authStatus.textContent = message;
    }

}


function displayUser(user) {

    if (!user) {
        setStatus("ログインしていません");

        if (signInButton) {
            signInButton.hidden = false;
        }

        if (signOutButton) {
            signOutButton.hidden = true;
        }

        return;
    }

    const userName = user.displayName || user.email || "ユーザー";

    setStatus(`${userName} としてログイン中`);

    if (signInButton) {
        signInButton.hidden = true;
    }

    if (signOutButton) {
        signOutButton.hidden = false;
    }

}


function getSignInErrorMessage(error) {

    switch (error.code) {
        case "auth/popup-closed-by-user":
            return "サインインがキャンセルされました。";
        case "auth/popup-blocked":
            return "ポップアップがブロックされました。ブラウザの設定を確認してください。";
        case "auth/unauthorized-domain":
            return "このサイトではサインインを利用できません。管理者にお問い合わせください。";
        default:
            return "サインインに失敗しました。時間をおいて再度お試しください。";
    }

}


onAuthStateChanged(auth, displayUser);


if (signInButton) {

    signInButton.addEventListener("click", async () => {

        signInButton.disabled = true;
        setStatus("Googleアカウントでサインインしています...");

        try {

            await setPersistence(auth, browserLocalPersistence);

            const provider = new GoogleAuthProvider();

            await signInWithPopup(auth, provider);

        } catch (error) {

            console.error("Googleサインインに失敗しました:", error);
            setStatus(getSignInErrorMessage(error));

        } finally {

            signInButton.disabled = false;

        }

    });

}


if (signOutButton) {

    signOutButton.addEventListener("click", async () => {

        signOutButton.disabled = true;

        try {

            await signOut(auth);
            setStatus("ログアウトしました。");

        } catch (error) {

            console.error("ログアウトに失敗しました:", error);
            setStatus("ログアウトに失敗しました。時間をおいて再度お試しください。");

        } finally {

            signOutButton.disabled = false;

        }

    });

}
