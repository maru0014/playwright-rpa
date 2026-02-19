import * as https from "https";
import * as http from "http";

export type NotifyStatus = "success" | "failure" | "warning";

export interface NotifyPayload {
  title: string;
  message: string;
  status: NotifyStatus;
  details?: Record<string, string | number>;
}

/**
 * Slack / Discord の Webhook へ通知を送信する
 * 環境変数 SLACK_WEBHOOK_URL または DISCORD_WEBHOOK_URL が設定されている場合に送信
 */
export async function notify(payload: NotifyPayload): Promise<void> {
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;

  const color = {
    success: "#36a64f",
    failure: "#ff0000",
    warning: "#ffa500",
  }[payload.status];

  const emoji = {
    success: "✅",
    failure: "❌",
    warning: "⚠️",
  }[payload.status];

  const detailsText = payload.details
    ? Object.entries(payload.details)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join("\n")
    : "";

  const fullMessage = detailsText
    ? `${payload.message}\n${detailsText}`
    : payload.message;

  const promises: Promise<void>[] = [];

  if (slackUrl) {
    promises.push(
      postWebhook(slackUrl, {
        attachments: [
          {
            color,
            title: `${emoji} ${payload.title}`,
            text: fullMessage,
            footer: `playwright-rpa • ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
          },
        ],
      })
    );
  }

  if (discordUrl) {
    const discordColor = parseInt(color.replace("#", ""), 16);
    promises.push(
      postWebhook(discordUrl, {
        embeds: [
          {
            title: `${emoji} ${payload.title}`,
            description: fullMessage,
            color: discordColor,
            footer: {
              text: `playwright-rpa • ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
            },
          },
        ],
      })
    );
  }

  if (promises.length === 0) {
    console.log(
      "[notify] Webhook URL が設定されていません。通知をスキップします。"
    );
    console.log(`[notify] ${emoji} ${payload.title}: ${payload.message}`);
    return;
  }

  await Promise.allSettled(promises);
}

/** JSON を HTTP(S) POST する汎用関数 */
function postWebhook(url: string, body: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const lib = parsedUrl.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(
          new Error(`Webhook に失敗しました: HTTP ${res.statusCode} (${url})`)
        );
      }
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
