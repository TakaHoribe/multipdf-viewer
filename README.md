# Multi-PDF Sync Viewer

複数のPDFを横並びで表示し、スクロールとズームを同期できるWebアプリケーションです。

## 機能

- 複数のPDFを横並びで表示（最大4つ）
- スクロール同期機能（ON/OFF可能）
- ズーム同期機能（ON/OFF可能）
- ドラッグ&ドロップでPDFファイルを読み込み
- "add pages"ボタンでPDF表示スペースを追加
- 各スペースの"-"ボタンでスペースを削除
- 透明感のあるモダンなデザイン

## セキュリティ

- PDFファイルはブラウザ内で処理され、外部に送信されません
- すべての処理はクライアントサイドで完結します

## 開発

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## GitHub Pagesへのデプロイ

1. GitHubリポジトリを作成
2. `vite.config.js`の`base`パスをリポジトリ名に合わせて設定
3. リポジトリのSettings > PagesでGitHub Pagesを有効化
4. メインブランチにプッシュすると自動的にデプロイされます

## 技術スタック

- React + Vite
- PDF.js (CDN経由)
- CSS (ガラスモーフィズムデザイン)
