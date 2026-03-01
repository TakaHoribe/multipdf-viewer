# Code Quality Improvement Plan

## 現状サマリー

- **構成**: React + Vite、PDF.js（CDN）、約620行のPDFViewer.jsx
- **主な懸念**: 本番向けでないデバッグ出力、ハードコード、PDF.jsのCDN依存

---

## 1. デバッグログの削減（優先度: 高）

本番でコンソールが埋まるのを防ぐ。

| ファイル | 内容 |
|----------|------|
| src/main.jsx | 7-12行目: 起動時の console.log、15-24行目: グローバルエラーハンドラ |
| src/App.jsx | 13-17行目: useEffect 内の console.log |
| src/components/PDFViewer.jsx | 多数の console.log |

**提案**: `import.meta.env.DEV` で囲むか、`console.log` を削除する。エラーハンドラは `console.error` のみ残す。

---

## 2. パッケージ管理（優先度: 高）

**package.json**

- `"private": true` → 公開リポジトリなら `false` に変更
- `"version": "0.0.0"` → `"1.0.0"` などセマンティックバージョンに変更

**PDF.js の扱い**

- 現状: CDN（cdnjs）から動的読み込み、cmaps/standard_fonts は jsDelivr
- 課題: バージョンが複数箇所にハードコード、CDN障害時の影響が大きい
- 提案: `pdfjs-dist` を npm 依存に追加し、`import` で読み込む。バージョンは `package.json` で一元管理。

---

## 3. 定数・マジックナンバーの整理（優先度: 中）

| 場所 | 現状 | 提案 |
|------|------|------|
| src/App.jsx | `viewers.length < 10` が2箇所 | `const MAX_VIEWERS = 10` を定義 |
| src/components/PDFViewer.jsx | PDF.js URL、バージョンが複数箇所 | 定数 `PDFJS_VERSION` や `PDFJS_CDN_BASE` に集約 |
| src/components/PDFViewer.jsx | `1000 * scale`, `20`（ページ間隔）, `50`, `100`（タイムアウト） | 名前付き定数に置き換え |

---

## 4. メンテナンス性（優先度: 中）

**PDFViewer.jsx の分割**

- 約620行で責務が集中している
- 提案: `usePDFLoader`（PDF読み込み）、`usePDFRender`（レンダリング）、`useScrollSync` などのカスタムフックに分割
- または `PDFViewer.jsx` / `PDFViewerToolbar.jsx` / `PDFDropZone.jsx` のようにコンポーネント分割

**コメントの言語**

- 日本語コメントが多数 → 公開リポジトリでは英語に統一するか、必要最小限に整理

---

## 5. その他の改善（優先度: 低〜中）

| 項目 | 現状 | 提案 |
|------|------|------|
| LICENSE | なし | MIT など適切なライセンスを追加 |
| favicon | `href="/vite.svg"` | 実際の favicon を用意するか、存在するパスに変更 |
| main.jsx のエラー表示 | `document.body.innerHTML` で上書き | React の Error Boundary に移行 |
| ESLint / Prettier | 設定なし | ルートに設定を追加してフォーマットを統一 |

---

## 6. 実装の優先順位

1. **即時対応**: デバッグログ削減、`MAX_VIEWERS` 定数化、`private`/`version` 修正
2. **短期**: PDF.js の定数化、LICENSE 追加、favicon 修正
3. **中期**: PDF.js の npm 化
4. **長期**: PDFViewer の分割、ESLint/Prettier 導入

---

## 変更対象ファイル一覧

- `package.json` - private, version
- `src/main.jsx` - デバッグログ削減
- `src/App.jsx` - デバッグログ削減、定数化
- `src/components/PDFViewer.jsx` - デバッグログ削減、定数化
- `index.html` - favicon
- 新規: `LICENSE`, `src/constants.js`（または各ファイル内の定数）
