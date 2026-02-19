/**
 * パターン3: フォーム自動入力デモ
 *
 * GitHub Pagesへ公開したダミーのお問い合わせフォームを自動入力・送信するデモ。
 *
 * 環境変数:
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

const DRY_RUN = process.env.DRY_RUN === "true";
const TARGET_URL = process.env.TARGET_URL ?? "https://maru0014.github.io/playwright-rpa/form.html";

const RESULTS_DIR = path.resolve("results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");

// ── メイン処理 ─────────────────────────────────────────────────────────────

(async () => {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log(`[form-automation] DRY_RUN: ${DRY_RUN}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });

  const page = await context.newPage();

  try {
    // ── Step 1: フォームへアクセス ──────────────────────────────────────────
    console.log(`[form-automation] Step 1: フォームへ移動: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });

    // 入力前スクリーンショット
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "form-before.png") });
    console.log("[form-automation] スクリーンショット保存: form-before.png");

    // ── Step 2: フォーム入力 ────────────────────────────────────────────────
    console.log("[form-automation] Step 2: フォームに入力中...");

    await page.fill("#company", "株式会社 Playwright RPA");
    await page.fill("#name", "RPA Bot");
    await page.fill("#email", "bot@example.com");
    await page.selectOption("#category", "support");
    await page.fill("#message", "自動入力のテストです。\nこのメッセージはGitHub Actionsから送信されています。");

    // 入力後スクリーンショット
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "form-filled.png"), fullPage: false });
    console.log("[form-automation] スクリーンショット保存: form-filled.png");

    // ── Step 3: 送信（DRY_RUN=false の場合のみ）─────────────────────────────
    if (!DRY_RUN) {
      console.log("[form-automation] Step 3: フォームを送信中...");

      await page.click("#submit-button");

      // 送信完了画面の表示を待つ (URLハッシュの変更を待つ)
      await page.waitForURL(/form\.html#success/, { timeout: 10000 });

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "form-after.png"), fullPage: false });
      console.log("[form-automation] スクリーンショット保存: form-after.png");

      await notify({
        title: "📝 フォーム自動入力 完了",
        message: `ダミーフォームへのお問い合わせ入力と送信が完了しました。`,
        status: "success",
        details: { 実行モード: "送信あり" },
      });
    } else {
      console.log("[form-automation] DRY_RUN モード: 送信をスキップしました。");
      await notify({
        title: "📝 フォーム自動入力 (DRY RUN)",
        message: "ダミーフォームへの入力は完了しましたが、送信はスキップしました。",
        status: "success",
        details: { 実行モード: "DRY RUN（送信なし）" },
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[form-automation] エラー:", errMsg);

    try {
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "form-error.png") });
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
