<div align="center">

# akkunlab.github.io

Notion をコンテンツ源にした、Astro 製の日英バイリンガル・ポートフォリオサイト

[![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![daisyUI](https://img.shields.io/badge/daisyUI-4-1AD1A5?logo=daisyui&logoColor=white)](https://daisyui.com/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Website-222222?logo=googlechrome&logoColor=white)](https://akkunlab.dev/)

<img src="docs/hero.png" alt="トップページのヒーロー表示" width="100%">

</div>

## 概要

作品・活動・経歴・スキルといったポートフォリオの中身を Notion データベースで管理し、ビルド時に取り込んで静的サイトとして生成します。Astro + Tailwind CSS + daisyUI で構築し、Cloudflare Pages で配信。Notion 側の更新は日次の自動リビルドで反映されます。

## 特徴

- **Notion 駆動** — 作品・活動・職歴・学歴・資格・スキル・リンクを Notion データベースから取得し、notion-to-md と remark で HTML 化する
- **日英バイリンガル** — 日本語をデフォルトに、英語版を `/en/` 配下で提供。未翻訳の項目は日本語にフォールバックする
- **多層キャッシュと画像最適化** — メモリ → Cloudflare KV → ローカルの順に参照し、変更のあったページだけ再取得。画像は sharp で WebP 化して Cloudflare R2 に配置する
- **SEO** — sitemap・画像 sitemap・hreflang・JSON-LD・OGP を出力し、ビルド成果物を圧縮する
- **自動更新** — GitHub Actions が毎日 0:00 JST に Cloudflare Pages の Deploy Hook を叩く。Notion Webhook を受ける Cloudflare Worker が本文の下書きを LLM で生成する

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| フレームワーク | [Astro](https://astro.build/) 5 / TypeScript |
| スタイル | [Tailwind CSS](https://tailwindcss.com/) 3 / [daisyUI](https://daisyui.com/) 4 / Noto Sans JP |
| コンテンツ | [Notion API](https://developers.notion.com/) / notion-to-md / remark |
| 画像 | sharp / Cloudflare R2 |
| インフラ | [Cloudflare Pages](https://pages.cloudflare.com/) / KV / Workers |
| LLM | OpenRouter |

## セットアップ

```bash
pnpm install
pnpm run dev       # http://localhost:4321
pnpm run build     # dist/ に出力
pnpm run preview   # ビルド結果のプレビュー
```

Notion と Cloudflare（KV / R2）の認証情報を `.env` に設定します。必要なキーは `src/env.d.ts` を参照してください。

## 構成

```text
src/
  pages/            ルーティング（/, /works, /activities, /en/…）
  components/       UI コンポーネント
  layouts/          共通レイアウト（メタタグ・hreflang・JSON-LD）
  i18n/             ロケール判定と翻訳辞書
  utils/            Notion 取得・キャッシュ・画像変換・Markdown 変換
scripts/            KV キャッシュ削除・SNS 投稿
workers/            Notion Webhook 用 Cloudflare Worker
.github/workflows/  日次リビルド
```
