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

## 保存について

このプロトタイプはブラウザの `localStorage` に保存します。実運用では、認証、DB、画像ストレージ、権限管理を追加します。

## 実運用での推奨構成

- Frontend: React または Next.js
- Auth: ファミリーID + 個別ユーザーアカウント
- DB: PostgreSQL
- Storage: 画像用 Object Storage
- PWA: Push通知、オフライン閲覧、ホーム画面追加
- AI拡張: 週次要約、自然文検索、写真タグ候補、通院レポート
