# 🎭 Playwright × GitHub Actions 無料 RPA サンプル集

GitHub Actions の**無料枠**で動く Playwright ブラウザ自動操作（RPA）のサンプルリポジトリです。
**サーバー不要・費用ゼロ**で、スケジュール実行からフォーム自動入力まで実現できます。

## 📦 3つのサンプルパターン

| # | パターン | 内容 | トリガー |
|:---:|:--------|:-----|:-------:|
| 1 | 🛒 **価格監視Bot** | 商品ページを毎日巡回し価格をCSV記録。閾値以下でSlack/Discord通知 | 毎日 AM9:00 |
| 2 | 🟢 **サイト死活監視** | URLのHTTPステータス・レスポンスタイムを1時間ごとにチェック | 1時間ごと |
| 3 | 📝 **フォーム自動入力** | GitHubのIssue作成フォームをブラウザ操作で自動入力するデモ | 手動実行 |

---

## 🚀 セットアップ

### 1. このリポジトリをフォーク（またはテンプレートから作成）

```bash
# クローン後ローカルで試す場合
git clone https://github.com/maru0014/playwright-rpa.git
cd playwright-rpa
npm install
npx playwright install chromium
```

### 2. GitHub Secrets を設定

`Settings` → `Secrets and variables` → `Actions` → `New repository secret` から登録します。

#### 共通（任意）

| Secret名 | 説明 | 例 |
|---------|-----|-----|
| `SLACK_WEBHOOK_URL` | Slack 通知先 Webhook URL | `https://hooks.slack.com/services/...` |
| `DISCORD_WEBHOOK_URL` | Discord 通知先 Webhook URL | `https://discord.com/api/webhooks/...` |

#### パターン1: 価格監視

| Secret名 | 説明 | 例 |
|---------|-----|-----|
| `WATCH_URLS` | 監視対象URL（カンマ区切り） | `https://example.com/item1,https://example.com/item2` |
| `PRICE_THRESHOLD` | 閾値（円）。この金額以下で通知 | `1980` |

#### パターン2: 死活監視

| Secret名 | 説明 | 例 |
|---------|-----|-----|
| `MONITOR_URLS` | 監視対象URL（カンマ区切り） | `https://mysite.com,https://api.mysite.com/health` |

#### パターン3: フォーム自動入力

Secretsへの追加設定は不要です。

### 3. ワークフローを有効化

リポジトリの `Actions` タブ → `I understand my workflows, go ahead and enable them` をクリック。

---

## ▶️ 実行方法

### スケジュール実行（自動）
設定後は何もしなくても自動で動きます。

### 手動実行
1. GitHub の `Actions` タブを開く
2. 実行したいワークフローを選択
3. `Run workflow` ボタンをクリック
4. パラメータを入力して実行

### ローカルで実行

```bash
# パターン1: 価格監視
WATCH_URLS="https://maru0014.github.io/playwright-rpa/price.html" \
npm run rpa:price-monitor

# パターン2: 死活監視
MONITOR_URLS="https://maru0014.github.io/playwright-rpa/health.html" \
npm run rpa:health-check

# パターン3: フォーム自動入力（DRY RUN）
DRY_RUN="true" \
npm run rpa:form-automation
```

---

## 📊 実行結果の確認

ワークフロー完了後、`Actions` タブ → 実行したジョブ → `Artifacts` からダウンロードできます。

| パターン | Artifact の内容 |
|---------|----------------|
| 価格監視 | `prices.csv`（価格履歴）、スクリーンショット |
| 死活監視 | `health-report.json`（チェック結果）、スクリーンショット |
| フォーム自動入力 | 実行前後のスクリーンショット |

---

## 💰 GitHub Actions 無料枠について

| プラン | 月間無料時間 |
|-------|------------|
| パブリックリポジトリ | **無制限** ✨ |
| プライベートリポジトリ | 2,000 分/月 |

Playwright の実行は 1 回あたり約 1〜3 分なので、**余裕を持って使えます。**

---

## 🛡️ 注意事項

- 対象サイトの**利用規約（ToS）**を必ず確認してください
- 過度なアクセスはサーバーに負荷をかけます。スケジュール頻度は適切に設定してください
- ログインを伴う操作では**専用サブアカウント**の使用を推奨します

---

## 🔧 カスタマイズ

`scripts/` 以下のファイルを編集して、自分のユースケースに合わせてください。
Playwright の豊富な API を使えば、ほとんどのブラウザ操作を自動化できます。

- [Playwright 公式ドキュメント](https://playwright.dev/docs/intro)
- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)

---

## ライセンス

MIT
