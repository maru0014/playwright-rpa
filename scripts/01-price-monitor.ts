/**
 * パターン1: 価格監視Bot
 *
 * 環境変数:
 *   WATCH_URLS       - 監視対象URL（カンマ区切り）例: https://example.com/item1,https://example.com/item2
 *   PRICE_SELECTOR   - 価格要素のCSSセレクタ（デフォルト: [class*="price"]）
 *   NAME_SELECTOR    - 商品名要素のCSSセレクタ（デフォルト: h1）
 *   PRICE_THRESHOLD  - この金額（円）を下回ったら通知（省略時は常に記録のみ）
 *   SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL - 通知先（省略可）
 *
 * 出力:
 *   results/prices.csv  - 日時・URL・商品名・価格を追記
 *   results/screenshots/ - スクリーンショット
 */

import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { notify } from "./utils/notify";

// ── 設定 ────────────────────────────────────────────────────────────────────

const WATCH_URLS = (process.env.WATCH_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const PRICE_SELECTOR = process.env.PRICE_SELECTOR ?? '[class*="price"]';
const NAME_SELECTOR = process.env.NAME_SELECTOR ?? "h1";
const PRICE_THRESHOLD = process.env.PRICE_THRESHOLD
  ? Number(process.env.PRICE_THRESHOLD)
  : null;

const RESULTS_DIR = path.resolve("results");
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, "screenshots");
const CSV_FILE = path.join(RESULTS_DIR, "prices.csv");

// ── ユーティリティ ────────────────────────────────────────────────────────────

/** 価格文字列から数値を抽出 例: "¥1,980" → 1980 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** CSVに1行追記 */
function appendCsv(row: string[]): void {
  if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, "timestamp,url,name,price\n", "utf-8");
  }
  const line = row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",") + "\n";
  fs.appendFileSync(CSV_FILE, line, "utf-8");
}

// ── メイン処理 ─────────────────────────────────────────────────────────────

(async () => {
  // デモ用: URL が指定されていない場合はサンプルURLを使用
  const targetUrls =
    WATCH_URLS.length > 0
      ? WATCH_URLS
      : ["https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"];

  console.log(`[price-monitor] 監視対象: ${targetUrls.length}件`);

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });

  const alertItems: { name: string; price: number; url: string }[] = [];
  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  for (const url of targetUrls) {
    const page = await context.newPage();
    try {
      console.log(`[price-monitor] アクセス中: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

      // 商品名を取得
      const nameEl = await page.$(NAME_SELECTOR);
      const rawName = nameEl ? (await nameEl.textContent()) ?? "" : "不明";
      const name = rawName.trim();

      // 価格を取得（複数ヒットした場合は最初の1件）
      const priceEl = await page.$(PRICE_SELECTOR);
      const rawPrice = priceEl ? (await priceEl.textContent()) ?? "" : "";
      const price = parsePrice(rawPrice.trim());

      console.log(`  商品名: ${name}`);
      console.log(`  価格: ${price !== null ? price : "取得失敗"}`);

      // スクリーンショット保存
      const screenshotName = `${Date.now()}-${encodeURIComponent(url).slice(0, 50)}.png`;
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, screenshotName),
        fullPage: false,
      });

      // CSV追記
      appendCsv([timestamp, url, name, price !== null ? String(price) : "N/A"]);

      // 閾値チェック
      if (price !== null && PRICE_THRESHOLD !== null && price <= PRICE_THRESHOLD) {
        alertItems.push({ name, price, url });
      }
    } catch (err) {
      console.error(`[price-monitor] エラー (${url}):`, err);
      appendCsv([timestamp, url, "ERROR", "N/A"]);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // 通知送信
  if (alertItems.length > 0) {
    const details: Record<string, string> = {};
    for (const item of alertItems) {
      details[item.name] = `¥${item.price} (${item.url})`;
    }
    await notify({
      title: "🛒 価格アラート！",
      message: `${alertItems.length}件の商品が閾値（¥${PRICE_THRESHOLD}）を下回りました。`,
      status: "warning",
      details,
    });
  } else {
    await notify({
      title: "価格監視 完了",
      message: `${targetUrls.length}件のURLをチェックしました。閾値アラートなし。`,
      status: "success",
      details: { 実行日時: timestamp, 対象件数: String(targetUrls.length) },
    });
  }

  console.log("[price-monitor] 完了！");
})();
