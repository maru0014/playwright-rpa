import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  /* 最大タイムアウト: 60秒 */
  timeout: 60 * 1000,
  /* GitHub Actions 環境では並列実行しない */
  workers: process.env.CI ? 1 : undefined,
  use: {
    /* ヘッドレスモード (GitHub Actions では必須) */
    headless: true,
    /* ビューポートサイズ */
    viewport: { width: 1280, height: 720 },
    /* スクリーンショットは常に保存 */
    screenshot: "on",
    /* 動画は失敗時のみ保存 */
    video: "retain-on-failure",
    /* ロケールを日本語に設定 */
    locale: "ja-JP",
    /* タイムゾーンを JST に設定 */
    timezoneId: "Asia/Tokyo",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /* テスト結果の出力先 */
  outputDir: "results/test-results",
});
