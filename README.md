# Ragdoll Care PWA

家族で共有する、ラグドール向けの体調・行動・写真ログPWAプロトタイプです。

## 起動

```bash
npm start
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

Publishable keyは `app.js` に設定済みです。Secret keyはブラウザ用アプリには入れません。

### Supabase側で先に行うこと

1. SupabaseのSQL Editorを開きます。
2. `docs/supabase-join-family.sql` の中身を貼り付けます。
3. `Run` を押します。
4. アプリでアカウント作成またはログインします。
5. 1人目は「新しい家族を作る」を押します。
6. 2人目以降は、設定画面に表示される招待コードで参加します。

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
