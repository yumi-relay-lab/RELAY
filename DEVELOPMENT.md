# RELAY 開発ガイド

最終更新: 2026-08-10

この文書は、RELAYの設計方針、現在の実装、次に行う開発を共有するための開発上の羅針盤です。

> **コードを変更する前に、必ずDEVELOPMENT.mdを確認し、現在の設計方針と次の作業を確認すること。**

> **設計上の判断が必要な場合は、勝手に実装を進めず、変更内容と影響範囲を説明して確認すること。**

## 1. 目的・コンセプト

RELAYは、特別支援教育を含む教育実践を先生同士で共有するためのWebアプリケーションです。

- 先生が実践を手軽に投稿・閲覧できること
- 実践を通じて、他の先生が参考にしたり、感謝や気づきを伝えたりできること
- 利用者の操作は簡単にし、データの所有者識別・権限管理は安全に行うこと

基本原則は **「先生は簡単、裏側は堅牢」** です。

## 2. 現在のシステム構成

```text
RELAY/
├─ index.html              トップ・投稿一覧・ログイン表示
├─ post.html               新規投稿フォーム
├─ detail.html             投稿詳細・リアクション・ありがとう
├─ share.html              簡易投稿一覧
├─ css/style.css           共通スタイル
├─ js/firebase.js          Firebase App / Firestore / Authentication初期化
├─ js/auth.js              Googleサインイン・ログアウト・状態表示
├─ js/post.js              投稿作成・Firestore保存・localStorage保存
├─ js/script.js            トップ一覧表示
├─ js/detail.js            詳細表示・リアクション・ありがとう
├─ js/share.js             共有一覧表示
├─ data/posts.json         3件のサンプル投稿
└─ images/asanojunbi.jpg   サンプル画像
```

- HTMLはプロジェクト直下にあり、JavaScriptはES Modulesとして読み込んでいます。
- Firebase JavaScript SDKはCDN（`12.17.1`）から読み込んでいます。
- `js/firebase.js` はFirestoreの `db` とFirebase Authenticationの `auth` をexportしています。

## 3. 現在実装済みの機能

### 画面と投稿

- トップ画面で投稿カードを一覧表示する
- 投稿フォームで投稿者名、学部、タイトル、目的、方法、振り返りを入力する
- 投稿の詳細画面を表示する
- 共有画面で簡易一覧を表示する

### Google Authentication

- トップ画面に「Googleでサインイン」ボタンがある
- `GoogleAuthProvider` とポップアップ方式でGoogleサインインする
- `browserLocalPersistence` を指定し、同一ブラウザ・同一オリジンではログイン状態を維持する
- ログイン中の表示とログアウト機能がある
- ログイン中のFirebase UIDは、投稿時に `auth.currentUser.uid` として取得する

### 投稿保存

- `js/post.js` はFirestoreの `posts` コレクションへ新規投稿を保存する実装を持つ
- Firestore保存成功後、従来どおり `localStorage` の `relayPosts` にも追加してトップへ移動する
- 未ログイン時はFirestore投稿を行わず、Googleサインインを案内する
- Firestore保存失敗時は、エラーを表示してトップへ移動しない

### リアクション・ありがとう

- 詳細画面には6種類のリアクションがある
  - `thanks` / `reference` / `try` / `done` / `idea` / `question`
- ありがとうメッセージを送信できる
- これらは現時点ではブラウザの `localStorage` に保存される

## 4. Firebase Authenticationの設計

### 決定していること

- Googleアカウントを認証の入口にする
- `@fuku-c.ed.jp` には限定しない
- 将来的に全国の先生が利用できる設計とする
- 投稿者の所有者識別にはメールアドレスではなくFirebase AuthenticationのUIDを使う
- Firebase UIDを将来の編集・削除などの権限判定の基準にする
- Apple・Microsoftなどの認証方式を追加しても、投稿側は `authorId`（Firebase UID）を使い続ける

### 現在の実装範囲

- Googleプロバイダによるサインイン・サインアウトのみ実装済み
- 認証UIは現在トップ画面にのみある
- Apple・Microsoft認証、利用者プロフィール、教師承認・管理者ロールは未実装

## 5. 投稿データの設計

Firestoreに新規保存する投稿は、現在次の項目を持ちます。

```text
posts/{postId}
├─ authorId        Firebase AuthenticationのUID。所有者識別用
├─ authorName      フォームで入力する表示用ニックネーム
├─ schoolDivision
├─ title
├─ purpose
├─ howToUse
├─ reflection
├─ imageUrl        現在は null
├─ aiSummary       現在は固定文言
├─ aiTags          現在は固定配列
├─ reactionCounts  6種類の初期値がすべて0のマップ
├─ createdAt       Firestoreのサーバー時刻
└─ updatedAt       Firestoreのサーバー時刻
```

- `authorName` は画面表示用のニックネームであり、所有者識別には使わない
- `authorId` はFirebase UIDであり、将来の投稿編集・削除の権限判定に使う
- `authorId` にメールアドレスを入れない
- `data/posts.json` の3件のサンプル投稿はFirestoreへ移行しない

## 6. Firestoreの現在の利用状況

- Firebase App、Firestore、Authenticationの初期化は完了している
- `post.js` は `addDoc(collection(db, "posts"), firestorePost)` で投稿を保存する
- 一覧・詳細・共有画面はまだFirestoreを読まず、`data/posts.json` と `localStorage` を読んでいる
- サンプル投稿3件はFirestoreに登録しない

Firestore Rulesはリポジトリ内のファイルではなくFirebase Console側で管理されている。現在共有されているRulesは、全ての読み書きを拒否する設定である。

```text
allow read, write: if false;
```

そのため、現在はGoogleログインに成功していても、Firestoreへの投稿保存はRulesによって拒否される。これは想定どおりの状態である。

## 7. localStorageとの現在の関係

| 保存先 | キー | 現在の内容 |
| --- | --- | --- |
| localStorage | `relayPosts` | ブラウザで作成された投稿の配列 |
| localStorage | `reaction_{id}` | 投稿別のリアクション数 |
| localStorage | `thanksMessage_{id}` | 投稿別のありがとうメッセージ配列 |
| data/posts.json | — | 初期表示用の3件のサンプル投稿 |
| Firestore | `posts/{postId}` | 新規投稿の保存先として実装済み。ただし現Rulesでは書込み拒否 |

重要な現状:

- トップ一覧は `data/posts.json` と `relayPosts` を結合して表示する
- 共有一覧と詳細画面は `data/posts.json` のみを参照する
- Firestore保存は成功した後にだけ `relayPosts` へ保存される
- Firestore保存がRulesで拒否される現在は、`relayPosts` への追加も行われない

## 8. 現在変更してはいけない既存機能

次の項目は、明示的な作業指示と影響確認なしに変更しない。

- 投稿フォームの既存入力項目
- 投稿データの既存フィールドと入力の意味
- `localStorage` の保存処理
- 既存のFirestore投稿保存処理
- 投稿一覧、詳細、共有一覧の動作
- リアクション機能とありがとうメッセージ機能
- 写真・動画アップロード機能（未実装）
- `data/posts.json` と3件のサンプル投稿
- Firestore Rules

## 9. 今後の開発ロードマップ

1. 開発環境でFirestore書込みを安全に検証する
   - Firestore Emulatorまたは開発専用Firebaseプロジェクトを使用する
   - 開発用Rulesを最小権限で設計・検証する
2. Firestore投稿を実運用できるRulesへ移行する
   - 認証済みユーザーだけが投稿できるようにする
   - `authorId == request.auth.uid` を検証する
   - 保存項目、型、文字数、初期リアクション数を検証する
3. 投稿一覧・詳細・共有一覧をFirestore参照へ移行する
4. 投稿者本人による編集・削除を追加する
5. リアクション・ありがとうを認証済みのFirestoreデータへ移行する
6. 利用者プロフィール、教師承認、管理者ロール、公開前確認を設計する
7. App Checkを監視モードから導入し、本番公開前に強制する
8. 写真・動画アップロードをCloud StorageとStorage Rulesを含めて設計・実装する
9. Apple・Microsoftなどの認証方式を必要に応じて追加する

## 10. 現在の開発段階と次に行う作業

現在は **第2段階③-3の準備段階** である。

- Firebase AuthenticationのGoogleログイン: 実装済み
- Firestore投稿処理: 実装済み
- 投稿への `authorId` 保存: 実装済み
- Firestore Rulesによる認証済み投稿の許可: 未実施
- Firestoreへ保存した投稿の一覧・詳細表示: 未実施

次に行う作業は、**開発・テスト用にFirestore書込みを安全に確認する方法とRulesを確定すること** である。候補はFirestore Emulatorまたは本番と分離した開発用Firebaseプロジェクトである。Rulesを変更する前に、許可する操作、検証する項目、影響範囲を確認する。

## 11. セキュリティ・Firestore Rules

### 決定していること

- `allow read, write: if true` のような無制限公開は採用しない
- 本番の投稿作成はFirebase Authenticationを前提にする
- 投稿者の識別・所有権はメールアドレスではなくFirebase UIDで扱う
- `authorId` は投稿作成者のUIDと一致することをRulesで検証する方針
- Firestoreへの直接書込みを操作別・コレクション別に最小限で許可する
- App CheckはAuthenticationとRulesを補完する対策として、将来導入する
- 写真・動画を導入する場合はCloud Storage Rulesを別途設計する

### 未決定事項

- 教師であることを確認する具体的な方法（管理者承認、招待、組織単位の登録など）
- 公開済み投稿を未ログイン利用者に読ませるかどうか
- 投稿の公開前確認と `pending` / `published` などの公開状態を導入するかどうか
- 管理者ロールの付与・管理方法
- 投稿者本人の編集・削除をいつ有効にするか
- リアクション・ありがとうの重複防止、投稿者識別、集計方法
- App Checkを導入・強制する具体的な時期
- 写真・動画のファイル形式、容量、公開範囲、確認フロー

## 12. 開発ルール

1. コードを変更する前に、必ずこの `DEVELOPMENT.md` を確認する。
2. 作業前に対象ファイルと現在の実装を確認する。
3. 依頼された範囲以外のファイル・機能は変更しない。
4. 既存のデータ保存、一覧、詳細、リアクション機能への影響を確認する。
5. 設計上の判断が必要な場合は、勝手に実装を進めない。変更内容、代替案、影響範囲を説明し、確認を得る。
6. FirebaseやFirestoreを変更する場合は、開発用と本番用の影響範囲を分けて説明する。
7. Firestore Rulesはアプリコードと同等に重要な変更として扱い、許可操作・データ検証・テスト方法を確認してから変更する。
8. 未決定の事項は推測で固定せず、この文書に「未決定」と記録する。
