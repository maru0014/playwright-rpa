/**
 * パターン3: フォーム自動入力デモ
 *
 * GitHub の Issue 作成フォームを「ブラウザ操作で」自動入力・送信するデモ。
 * APIではなく実際のブラウザUI操作なので、どんなWebフォームにも応用できる。
 *
 * 環境変数:
 *   GITHUB_LOGIN_EMAIL    - GitHub のログインメールアドレス
 *   GITHUB_LOGIN_PASSWORD - GitHub のパスワード
 *   GITHUB_REPO_OWNER     - リポジトリオーナー（例: maru0014）
 *   GITHUB_REPO_NAME      - リポジトリ名（例: playwright-rpa）
 *   ISSUE_TITLE           - 作成するIssueのタイトル
 *   ISSUE_BODY            - 作成するIssueの本文
 *   DRY_RUN               - "true" の場合、送信ボタンを押さずにスクリーンショットのみ
 *   SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL - 通知先（省略可）
 *
 * 出力:
 *   results/screenshots/form-before.png - 入力前のスクリーンショット
 *   results/screenshots/form-filled.png - 入力後のスクリーンショット
 *   results/screenshots/form-after.png  - 送信後のスクリーンショット（DRY_RUN=false時）
 */

import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { notify } from "./utils/notify";

// ── 設定 ────────────────────────────────────────────────────────────────────

const EMAIL = process.env.GITHUB_LOGIN_EMAIL ?? "";
const PASSWORD = process.env.GITHUB_LOGIN_PASSWORD ?? "";
const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "";
const ISSUE_TITLE =
  process.env.ISSUE_TITLE ?? `[RPA自動作成] テストIssue ${new Date().toISOString()}`;
const ISSUE_BODY =
  process.env.ISSUE_BODY ??
  "このIssueはPlaywright × GitHub ActionsによるRPAデモで自動作成されました。\n\n詳細: https://github.com/maru0014/playwright-rpa";
const DRY_RUN = process.env.DRY_RUN === "true";

const RESULTS_DIR = path.resolve("results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");

// ── メイン処理 ─────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // 必須パラメータチェック
  const missingVars: string[] = [];
  if (!EMAIL) missingVars.push("GITHUB_LOGIN_EMAIL");
  if (!PASSWORD) missingVars.push("GITHUB_LOGIN_PASSWORD");
  if (!REPO_OWNER) missingVars.push("GITHUB_REPO_OWNER");
  if (!REPO_NAME) missingVars.push("GITHUB_REPO_NAME");

  if (missingVars.length > 0) {
    console.warn(
      `[form-automation] 以下の環境変数が設定されていません: ${missingVars.join(", ")}`
    );
    console.log("[form-automation] 認証情報が未設定のためスキップします。Secretsを設定してください。");
    await notify({
      title: "⚠️ フォーム自動入力 スキップ",
      message: `必須の環境変数が設定されていないためスキップしました: ${missingVars.join(", ")}`,
      status: "warning",
    });
    process.exit(0);
  }

  console.log(`[form-automation] DRY_RUN: ${DRY_RUN}`);
  console.log(`[form-automation] Issue タイトル: ${ISSUE_TITLE}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    // GitHub がボットと判断しにくいよう一般的なUser-Agentを設定
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // ── Step 1: GitHub ログイン ─────────────────────────────────────────────
    console.log("[form-automation] Step 1: GitHubにログイン中...");
    await page.goto("https://github.com/login", {
      waitUntil: "domcontentloaded",
    });

    // 入力前スクリーンショット
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "form-before.png"),
    });
    console.log("[form-automation] スクリーンショット保存: form-before.png");

    if (EMAIL && PASSWORD) {
      await page.fill("#login_field", EMAIL);
      await page.fill("#password", PASSWORD);
      await page.click('[type="submit"]');
      await page.waitForURL(/github\.com(?!\/login)/, { timeout: 15000 });
      console.log("[form-automation] ログイン成功！");
    } else {
      console.log("[form-automation] 認証情報なし: ログインをスキップします。");
    }

    // ── Step 2: Issue 作成フォームへアクセス ─────────────────────────────────
    if (REPO_OWNER && REPO_NAME) {
      const issueUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new`;
      console.log(`[form-automation] Step 2: Issueフォームへ移動: ${issueUrl}`);
      await page.goto(issueUrl, { waitUntil: "domcontentloaded" });

      // ── Step 3: フォーム入力 ────────────────────────────────────────────────
      console.log("[form-automation] Step 3: フォームに入力中...");
      // GitHub 新UI対応: issue[title] セレクターは ID or name 属性で取得
      await page.waitForSelector('#issue_title, [name="issue[title]"]', { timeout: 15000 });
      await page.fill('#issue_title, [name="issue[title]"]', ISSUE_TITLE);
      // GitHub の Issue 本文: 新UIでは <textarea name="issue[body]"> を使用
      const bodyLocator = page.locator('textarea[name="issue[body]"]').first();
      await bodyLocator.click();
      await bodyLocator.fill(ISSUE_BODY);

      // 入力後スクリーンショット
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "form-filled.png"),
        fullPage: false,
      });
      console.log("[form-automation] スクリーンショット保存: form-filled.png");

      // ── Step 4: 送信（DRY_RUN=false の場合のみ）─────────────────────────────
      if (!DRY_RUN) {
        console.log("[form-automation] Step 4: Issueを送信中...");
        // GitHub 新UI対応: プライマリボタン（Submit new issue）をクリック
        await page.click('button.btn-primary[type="submit"], [data-disable-with]');
        // Issue 詳細ページへのリダイレクトを待つ
        await page.waitForURL(/\/issues\/\d+$/, { timeout: 15000 });

        const issuePageUrl = page.url();
        console.log(`[form-automation] Issue 作成成功！ URL: ${issuePageUrl}`);

        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, "form-after.png"),
          fullPage: false,
        });
        console.log("[form-automation] スクリーンショット保存: form-after.png");

        await notify({
          title: "📝 Issue 自動作成 完了",
          message: `Issue が正常に作成されました。`,
          status: "success",
          details: {
            タイトル: ISSUE_TITLE,
            URL: issuePageUrl,
            実行モード: "送信あり",
          },
        });
      } else {
        console.log("[form-automation] DRY_RUN モード: 送信をスキップしました。");
        await notify({
          title: "📝 フォーム自動入力 (DRY RUN)",
          message: "フォームへの入力は完了しましたが、送信はスキップしました。",
          status: "warning",
          details: {
            タイトル: ISSUE_TITLE,
            実行モード: "DRY RUN（送信なし）",
          },
        });
      }
    } else {
      console.log("[form-automation] リポジトリ情報なし: フォーム入力をスキップします。");
      await notify({
        title: "📝 フォーム自動入力デモ",
        message: "GITHUB_REPO_OWNER / GITHUB_REPO_NAME が未設定のため、ログインページのみ確認しました。",
        status: "warning",
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[form-automation] エラー:", errMsg);

    try {
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, "form-error.png"),
      });
    } catch {
      // スクリーンショット失敗は無視
    }

    await notify({
      title: "❌ フォーム自動入力 失敗",
      message: errMsg,
      status: "failure",
    });

    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log("[form-automation] 完了！");
})();
