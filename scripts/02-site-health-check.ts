/**
 * パターン2: サイト死活監視
 *
 * 環境変数:
 *   MONITOR_URLS           - 監視対象URL（カンマ区切り）
 *   RESPONSE_TIME_THRESHOLD - レスポンスタイムの警告閾値（ms、デフォルト: 5000）
 *   SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL - 通知先（省略可）
 *
 * 出力:
 *   results/health-report.json - チェック結果のJSON
 *   results/screenshots/       - 各URLのスクリーンショット
 */

import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { notify } from "./utils/notify";

// ── 設定 ────────────────────────────────────────────────────────────────────

const MONITOR_URLS = (process.env.MONITOR_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const RESPONSE_TIME_THRESHOLD = Number(
  process.env.RESPONSE_TIME_THRESHOLD ?? 5000
);

const RESULTS_DIR = path.resolve("results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");
const REPORT_FILE = path.join(RESULTS_DIR, "health-report.json");

// ── 型定義 ───────────────────────────────────────────────────────────────────

interface HealthResult {
  url: string;
  status: "ok" | "slow" | "error";
  httpStatus: number | null;
  responseTimeMs: number | null;
  error: string | null;
  screenshotFile: string | null;
  checkedAt: string;
}

// ── メイン処理 ─────────────────────────────────────────────────────────────

(async () => {
  // デモ用: URL が指定されていない場合はサンプル
  const targetUrls =
    MONITOR_URLS.length > 0
      ? MONITOR_URLS
      : [
          "https://example.com",
          "https://playwright.dev",
        ];

  console.log(`[health-check] 監視対象: ${targetUrls.length}件`);
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });

  const results: HealthResult[] = [];
  const checkedAt = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  for (const url of targetUrls) {
    const page = await context.newPage();
    let httpStatus: number | null = null;
    let screenshotFile: string | null = null;
    let errorMessage: string | null = null;
    let responseTimeMs: number | null = null;

    try {
      console.log(`[health-check] チェック中: ${url}`);

      const startTime = Date.now();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      responseTimeMs = Date.now() - startTime;

      httpStatus = response?.status() ?? null;
      console.log(`  HTTP ${httpStatus} / ${responseTimeMs}ms`);

      // スクリーンショット保存
      const filename = `health-${Date.now()}-${encodeURIComponent(url).slice(0, 40)}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      screenshotFile = filename;

      // ステータス判定
      const isOk = httpStatus !== null && httpStatus >= 200 && httpStatus < 400;
      const isSlow = isOk && responseTimeMs > RESPONSE_TIME_THRESHOLD;
      const status = !isOk ? "error" : isSlow ? "slow" : "ok";

      results.push({
        url,
        status,
        httpStatus,
        responseTimeMs,
        error: null,
        screenshotFile,
        checkedAt,
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`  エラー: ${errorMessage}`);

      // エラー時もスクリーンショットを試みる
      try {
        const filename = `health-error-${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        screenshotFile = filename;
      } catch {
        // スクリーンショットも失敗した場合は無視
      }

      results.push({
        url,
        status: "error",
        httpStatus,
        responseTimeMs,
        error: errorMessage,
        screenshotFile,
        checkedAt,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // レポートJSON保存
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`[health-check] レポート保存: ${REPORT_FILE}`);

  // 結果サマリ
  const okCount = results.filter((r) => r.status === "ok").length;
  const slowCount = results.filter((r) => r.status === "slow").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  console.log(`\n結果サマリ: OK=${okCount} / 遅延=${slowCount} / エラー=${errorCount}`);

  // 通知
  const hasProblems = slowCount > 0 || errorCount > 0;
  const details: Record<string, string> = {};

  for (const r of results) {
    const icon = r.status === "ok" ? "✅" : r.status === "slow" ? "⚠️" : "❌";
    const time = r.responseTimeMs !== null ? `${r.responseTimeMs}ms` : "N/A";
    const status = r.httpStatus !== null ? `HTTP ${r.httpStatus}` : "接続失敗";
    details[`${icon} ${r.url}`] = `${status} / ${time}`;
  }

  await notify({
    title: hasProblems ? "🚨 サイト異常を検知" : "🟢 全サイト正常",
    message: `${targetUrls.length}件チェック完了 | OK: ${okCount} / 遅延: ${slowCount} / エラー: ${errorCount}`,
    status: errorCount > 0 ? "failure" : slowCount > 0 ? "warning" : "success",
    details,
  });

  // エラーがあった場合はプロセスを異常終了させて GitHub Actions に失敗を伝える
  if (errorCount > 0) {
    process.exit(1);
  }

  console.log("[health-check] 完了！");
})();
