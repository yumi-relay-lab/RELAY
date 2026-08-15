# RELAY Lab 開発ガイド

最終更新: 2026-08-15

この文書は、RELAY Labの設計方針、現在の実装、次に行う開発を共有するための開発上の羅針盤です。

> **コードを変更する前に、必ずDEVELOPMENT.mdを確認し、現在の設計方針と次の作業を確認すること。**

> **設計上の判断が必要な場合は、勝手に実装を進めず、変更内容と影響範囲を説明して確認すること。**

## 1. 目的・コンセプト

RELAY Labは、特別支援教育を含む教育実践を先生同士で共有するためのWebアプリケーションです。

- 先生が実践を手軽に投稿・閲覧できること
- 実践を通じて、他の先生が参考にしたり、感謝や気づきを伝えたりできること
- 利用者の操作は簡単にし、データの所有者識別・権限管理は安全に行うこと

基本原則は **「先生は簡単、裏側は堅牢」** です。

## 2. 現在のシステム構成

```text
RELAY/
├─ index.html              トップ・投稿一覧・ログイン表示
├─ post.html               新規投稿フォーム
├─ edit.html               投稿者本人の本文編集フォーム
├─ detail.html             投稿詳細・リアクション・ありがとう
├─ share.html              簡易投稿一覧
├─ css/style.css           共通スタイル
├─ js/firebase.js          Firebase App / Firestore / Authentication / Storage初期化
├─ js/auth.js              Googleサインイン・ログアウト・状態表示
├─ js/post.js              投稿作成・Firestore保存・localStorage保存
├─ js/edit.js              投稿者本人の本文編集・Firestore更新
├─ js/script.js            トップ一覧表示
├─ js/detail.js            詳細表示・リアクション・ありがとう
├─ js/share.js             共有一覧表示
├─ data/posts.json         空配列（Ver.1では初期サンプル投稿を非表示）
├─ images/asanojunbi.jpg   サンプル画像
├─ firestore.rules         Firestore Security Rules
├─ storage.rules           Cloud Storage Security Rules
└─ firebase.json           Firebase deploy設定
```

- HTMLはプロジェクト直下にあり、JavaScriptはES Modulesとして読み込んでいます。
- Firebase JavaScript SDKはCDN（`12.17.1`）から読み込んでいます。
- `js/firebase.js` はFirestoreの `db`、Firebase Authenticationの `auth`、Cloud Storageの `storage` をexportしています。
- Cloud StorageはFirebase Blazeプランで有効化済みで、Storageバケットのリージョンは `asia-northeast1`（東京）です。

## 3. 現在実装済みの機能

### 画面と投稿

- トップ画面で投稿カードを一覧表示する
- 投稿フォームで投稿者名、学部、タイトル、目的、方法、振り返りを入力する
- 投稿の詳細画面を表示する
- 共有画面で簡易一覧を表示する
- トップの一覧画面と詳細画面はFirestoreの投稿を優先して参照する
- Firestoreを取得できない場合や対象がない場合に、`data/posts.json` と `localStorage` の互換データを利用する

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
- 投稿ボタンを処理中に無効化し、二重投稿を防止する

### 添付機能 Ver.1

- Cloud Storageバケットの作成とStorage Rulesのdeployは完了している
- 画像（JPEG / PNG / WebP）、PDF、Word（DOC / DOCX）、Excel（XLS / XLSX）に対応する
- 動画は対応しない
- 1投稿に最大3ファイル、1ファイル5MBまでとする
- ファイル選択とドラッグ＆ドロップに対応する
- 5MBを超える対応画像はブラウザ上で自動圧縮する
- PDF・Word・Excelは自動圧縮せず、5MBを超える場合は添付できない
- 添付資料に個人情報が含まれていないことを確認するチェックを必須とする
- Storage保存パスは `posts/{postId}/{authorId}/{fileId}.{extension}` とする
- 添付情報はFirestoreの `posts/{postId}` に `attachments` 配列として保存する
- 詳細画面は画像プレビュー、PDFの閲覧、Word / Excelのダウンロードに対応する
- 画像を `localStorage` に保存せず、Cloud Storageと `attachments.downloadUrl` を正とする
- 投稿者本人の編集画面で、既存添付の削除と新規添付の追加ができる
- 編集時も新規投稿時と同じ形式・容量・最大件数・個人情報確認の制限を適用する

### リアクション・ありがとう

- 詳細画面には6種類のリアクションがある
  - `thanks` / `reference` / `try` / `done` / `idea` / `question`
- ありがとうメッセージを送信できる
- これらは現時点ではブラウザの `localStorage` に保存される

#### ありがとうメッセージ Ver.1方針

- ありがとうメッセージの画面上の表示は匿名を維持する
- 送信した本人だけが、自分のありがとうメッセージを削除できる
- ありがとうメッセージの編集機能はVer.1では実装しない
- 内容を間違えた場合は、送信者本人が削除して再投稿する
- 投稿そのものの編集・削除は、投稿の `authorId` に一致する投稿者本人だけに許可する
- ありがとうメッセージの削除は、そのメッセージの送信者本人だけに許可する
- 投稿所有者とメッセージ送信者は別の権限として判定し、投稿者であることを理由に他の利用者のありがとうメッセージを削除できる仕様にはしない
- 現行Ver.1のありがとうメッセージは `localStorage` の `thanksMessage_{postId}` に保存する
- 新規メッセージは `id`, `message`, `datetime`, `authorId` を持ち、送信にはGoogleサインインを必須とする
- `authorId` は削除権限の判定にだけ使い、画面上に氏名・メールアドレス・UIDを表示しない
- `authorId` を持たない旧メッセージは従来どおり匿名表示し、削除ボタンは表示しない

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
├─ attachments     StorageのダウンロードURLを含む添付ファイル情報
├─ aiSummary       現在は固定文言
├─ aiTags          現在は固定配列
├─ reactionCounts  6種類の初期値がすべて0のマップ
├─ createdAt       Firestoreのサーバー時刻
└─ updatedAt       Firestoreのサーバー時刻
```

- `authorName` は画面表示用のニックネームであり、所有者識別には使わない
- `authorId` はFirebase UIDであり、将来の投稿編集・削除の権限判定に使う
- `authorId` にメールアドレスを入れない
- `attachments` の各要素は `id`, `name`, `storagePath`, `downloadUrl`, `contentType`, `size`, `category` を持つ
- 初期サンプル投稿3件はFirestoreへ移行せず、Ver.1運用では表示しない

## 6. Firestoreの現在の利用状況

- Firebase App、Firestore、Authenticationの初期化は完了している
- `post.js` は `addDoc(collection(db, "posts"), firestorePost)` で投稿を保存する
- トップ一覧と詳細画面はFirestoreを優先して参照する
- 共有画面は現時点で `data/posts.json` のみを参照するため、空配列の間は投稿を表示しない
- 初期サンプル投稿3件はFirestoreに登録せず、`data/posts.json` からも除外済み

Firestore Rulesはリポジトリ内の `firestore.rules` で管理する。現在は投稿の読み取りを許可し、作成時は `request.resource.data.authorId == request.auth.uid`、更新・削除時は既存投稿の `authorId == request.auth.uid` を検証するRulesを持つ。

Storage Rulesは `storage.rules` で管理する。リポジトリ内のRulesは、読み取りを認証済みユーザーに限定し、書込み・削除はStorageパス内の `authorId` と `request.auth.uid` が一致する場合だけ許可する。Rules変更後はdeploy状況を確認する。

## 7. localStorageとの現在の関係

| 保存先 | キー | 現在の内容 |
| --- | --- | --- |
| localStorage | `relayPosts` | ブラウザで作成された投稿の配列 |
| localStorage | `reaction_{id}` | 投稿別のリアクション数 |
| localStorage | `thanksMessage_{id}` | 投稿別のありがとうメッセージ配列 |
| data/posts.json | — | Ver.1では初期サンプルを表示しないため空配列 |
| Firestore | `posts/{postId}` | 新規投稿と添付メタデータの正本 |
| Cloud Storage | `posts/{postId}/{authorId}/{fileId}.{extension}` | 添付ファイル本体 |

重要な現状:

- トップ一覧は空の `data/posts.json`、`relayPosts`、Firestore投稿を結合し、重複時はFirestore側を残す
- 詳細画面はFirestore投稿を優先し、見つからない場合は `data/posts.json` と `relayPosts` を参照する
- 共有一覧は `data/posts.json` のみを参照するため、現在は初期サンプルを表示しない
- Firestore保存は成功した後にだけ `relayPosts` へ保存される
- `localStorage` は従来データとの互換表示用であり、添付情報の正本ではない
- 添付ファイル本体はCloud Storage、画像表示を含む添付メタデータはFirestoreの `attachments` 配列を正とする

## 8. 現在変更してはいけない既存機能

次の項目は、明示的な作業指示と影響確認なしに変更しない。

- 投稿フォームの既存入力項目
- 投稿データの既存フィールドと入力の意味
- `localStorage` の保存処理
- 既存のFirestore投稿保存処理
- 投稿一覧、詳細、共有一覧の動作
- リアクション機能とありがとうメッセージ機能
- 実装済みの添付機能（画像・PDF・Word・Excel）
- 空配列として維持する `data/posts.json`
- Firestore Rules

## 9. 今後の開発ロードマップ

1. Storage RulesをStorageパスの `authorId` 単位へ強化する
2. `authorId === auth.currentUser.uid` を基準に、投稿者本人だけの本文編集・投稿削除・既存添付削除・新規添付追加を実装する
3. 投稿削除はCloud Storageの添付ファイルを先に削除し、完了後にFirestore投稿を削除する
4. 共有一覧をFirestore参照へ移行する
5. localStorage版で実装済みの匿名表示・送信者本人削除を維持しながら、リアクション・ありがとうを認証済みのFirestoreデータへ移行する
6. 先生が必要な実践を探しやすいトップページへ改善する
7. 利用者プロフィール、教師承認、管理者ロール、公開前確認を設計する
8. App Checkを監視モードから導入し、本番公開前に強制する
9. 動画添付とApple・Microsoftなどの認証方式を、必要に応じて設計する

## 10. 現在の開発段階と次に行う作業

現在は **添付機能 Ver.1、投稿者本人の本文編集・投稿削除・既存添付削除・新規添付追加が完了した段階** である。

- Firebase AuthenticationのGoogleログイン: 実装済み
- Firestore投稿処理: 実装済み
- 投稿への `authorId` 保存: 実装済み
- Firestore Rulesによる認証済み投稿の許可: 実装済み
- Firestoreへ保存した投稿の一覧・詳細表示: 実装済み
- Cloud StorageとStorage Rulesのdeploy: 実施済み
- 添付機能 Ver.1: 実装済み
- 投稿者本人の本文編集: 実装済み
- 投稿者本人の投稿削除: 実装済み
- 投稿者本人の既存添付削除: 実装済み
- 投稿者本人の新規添付追加: 実装済み

次の主要タスクは、**localStorageで管理しているリアクション・ありがとうメッセージのFirestore移行設計** とする。匿名表示を維持しながら、認証済み送信と送信者本人の削除をRulesで保護する。

### トップページとタグのVer.1方針

- トップページでは、Ver.1の `createdAt` 新着順、キーワード検索、学部フィルター、タグフィルターを利用できる
- 学部フィルターは「すべて」「小学部」「中学部」「高等部」を提供し、キーワード検索と同時に適用する
- 人気順やランキングはVer.1では実装しない
- AI APIによる本文解析・自動タグ付けはVer.1では実装しない
- Ver.1のタグは、投稿者本人が用意されたタグ候補から複数選択するUIを投稿画面・編集画面に実装済み
- タグ候補の正本は `js/tags.js` の `TAG_CANDIDATES` とし、投稿・編集・トップページで共通利用する
- 現時点では既存の `aiTags` をトップページの検索対象として扱う
- 候補外の既存タグは編集画面の「その他のタグ」に残し、保存時に候補タグと統合する
- トップページのタグフィルターは複数選択でき、選択タグのいずれかを含む投稿を表示する
- トップページの投稿カードは初期10件を表示し、「もっと見る」で10件ずつ追加表示する
- タグ管理画面とAI APIによるタグ候補の自動提案は、Ver.2以降に必要性を確認して検討する

## 11. セキュリティ・Firestore Rules

### 決定していること

- `allow read, write: if true` のような無制限公開は採用しない
- 本番の投稿作成はFirebase Authenticationを前提にする
- 投稿者の識別・所有権はメールアドレスではなくFirebase UIDで扱う
- `authorId` は投稿作成者のUIDと一致することをRulesで検証する方針
- 投稿の編集・削除権限と、ありがとうメッセージの削除権限を分けて検証する
- ありがとうメッセージは匿名表示としつつ、削除権限の判定に必要な送信者情報を権限管理用に保持する
- Firestoreへの直接書込みを操作別・コレクション別に最小限で許可する
- App CheckはAuthenticationとRulesを補完する対策として、将来導入する
- Cloud Storageの書込み・削除はStorageパスの `authorId` とFirebase UIDを使って最小権限で制御する

### 未決定事項

- 教師であることを確認する具体的な方法（管理者承認、招待、組織単位の登録など）
- 公開済み投稿を未ログイン利用者に読ませるかどうか
- 投稿の公開前確認と `pending` / `published` などの公開状態を導入するかどうか
- 管理者ロールの付与・管理方法
- リアクション・ありがとうのFirestore保存構造、重複防止、集計方法
- App Checkを導入・強制する具体的な時期
- 動画添付のファイル形式、容量、公開範囲、確認フロー

## 12. 開発ルール

1. コードを変更する前に、必ずこの `DEVELOPMENT.md` を確認する。
2. 作業前に対象ファイルと現在の実装を確認する。
3. 依頼された範囲以外のファイル・機能は変更しない。
4. 既存のデータ保存、一覧、詳細、リアクション機能への影響を確認する。
5. 設計上の判断が必要な場合は、勝手に実装を進めない。変更内容、代替案、影響範囲を説明し、確認を得る。
6. FirebaseやFirestoreを変更する場合は、開発用と本番用の影響範囲を分けて説明する。
7. Firestore Rulesはアプリコードと同等に重要な変更として扱い、許可操作・データ検証・テスト方法を確認してから変更する。
8. 未決定の事項は推測で固定せず、この文書に「未決定」と記録する。
9. 詳細画面の開発用確認パネル（`.dev-panel`）は、本番公開前に非表示または削除する。
