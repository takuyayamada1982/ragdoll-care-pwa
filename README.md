# Ragdoll Care PWA

家族で共有する、ラグドール向けの体調・行動・写真ログPWAプロトタイプです。

## 起動

```bash
node server.js
```

起動後に表示されるURLをスマホで開くと、スマホ前提のUIを確認できます。

```text
http://127.0.0.1:4184/
```

## GitHub Pagesで公開

このフォルダは静的PWAなので、ビルドなしでGitHub Pagesに公開できます。

1. GitHubで新しいリポジトリを作成します。
2. `ragdoll-care-pwa` の中身をリポジトリへpushします。
3. GitHubの `Settings` → `Pages` を開きます。
4. `Build and deployment` の `Source` を `GitHub Actions` にします。
5. `main` ブランチへpushすると `.github/workflows/deploy-pages.yml` が動きます。
6. Actions完了後、PagesのURLでアプリを開けます。

このワークスペース全体を1つのリポジトリとして使う場合は、ルート側の `.github/workflows/deploy-ragdoll-care.yml` が `ragdoll-care-pwa` フォルダだけを公開します。

## Vercelで公開

Vercelでは `vercel.json` により、このPWAを静的サイトとして公開します。`server.js` はローカル確認用なのでVercelには含めません。

GitHub上に古い `app.js` や `server.js` が残っていると、Vercelがサーバーアプリと誤認することがあります。Vercelへ公開する場合は、GitHub上で以下を削除してください。

- `app.js`
- `server.js`
- 古い `package.json` の `start` 設定

Vercelの公開URLを使う場合は、Supabaseの `Authentication` → `URL Configuration` に以下を追加してください。

- Site URL: Vercelの本番URL
- Redirect URLs: Vercelの本番URL

例:

```text
https://ragdoll-care-pwa.vercel.app/
```

## MVPで確認できること

- 複数猫を前提にした猫切り替え
- ファミリーIDに紐づくメンバー切り替え
- ごはん、水、トイレ、体調、行動、ケア、体重、写真の記録
- 日誌タイムライン
- 週単位の変化表示
- 写真アップロード時のリサイズ・圧縮
- アルバム表示
- PWA manifest と service worker

## Supabase連携

この版はSupabaseにログインし、家族・猫プロフィール・記録ログを共有できます。

接続先:

```text
https://ghdsgyqbnhnegbeyeqlt.supabase.co
```

Publishable keyは `main.js` に設定済みです。Secret keyはブラウザ用アプリには入れません。

### Supabase側で先に行うこと

1. SupabaseのSQL Editorを開きます。
2. `docs/supabase-join-family.sql` の中身を貼り付けます。
3. `Run` を押します。
4. アプリでアカウント作成またはログインします。
5. 1人目はログイン後、自動で家族ページが作成されます。
6. 2人目以降は、設定画面に表示されるファミリーID（紹介コード）で参加します。

ファミリーID参加、猫プロフィール追加・編集、記録保存が止まる場合は、同じ `docs/supabase-join-family.sql` をSupabase SQL Editorでもう一度実行してください。関数と権限設定を上書き更新します。

### 家族メンバーを招待する流れ

親メンバー:

1. 新規登録します。
2. ログインします。
3. 初回ログイン時に家族ページが自動作成されます。
4. 設定画面を開きます。
5. 「ファミリーID（紹介コード）」を子メンバーへ伝えます。

子メンバー:

1. 最初の画面で「新規登録」を押します。
2. メールアドレスとパスワードを設定します。
3. 登録後、ログイン画面へ戻ります。
4. 「ログイン」を押します。
5. メールアドレス、パスワード、連携するIDに親メンバーのファミリーIDを入力します。
6. ファミリーIDが認証されると、同じ家族ページの共有が始まります。
7. 次回以降は、同じメールアドレスとパスワードだけでログインできます。

子メンバーが先に自分用の家族ページを作ってしまった場合も、ログアウトしてから親メンバーのファミリーIDを「連携するID」に入力してログインし直してください。最新の参加先を優先して表示します。

## 保存について

Supabaseログイン後は、以下が家族間で共有されます。

- 家族グループ
- 家族メンバーの表示名
- 猫プロフィール
- ごはん、体調、行動などの記録ログ
- 記録内容の編集・削除

写真は容量を抑えるため、アップロード時に圧縮して各端末の `localStorage` に保存します。現時点では写真は家族間共有しません。

## 実運用での推奨構成

- Frontend: 今回の静的PWAをベースに改良
- Auth: Supabase Auth
- DB: Supabase PostgreSQL
- Storage: 将来、画像用Supabase Storage
- PWA: Push通知、オフライン閲覧、ホーム画面追加
- AI拡張: 週次要約、自然文検索、写真タグ候補、通院レポート
