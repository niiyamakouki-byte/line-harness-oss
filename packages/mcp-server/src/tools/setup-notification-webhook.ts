/**
 * Tool: setup_notification_webhook
 *
 * Registers (or verifies) the outgoing webhook in the LINE Harness
 * so that message_received events are POSTed to the local listener.
 *
 * Uses the Worker API directly (same credentials as the SDK client).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const DEFAULT_PORT = 3456;
const WEBHOOK_NAME = "mcp-realtime-notifications";

interface OutgoingWebhook {
  id: string;
  name: string;
  url: string;
  eventTypes: string[];
  isActive: boolean;
}

/** Make an authenticated request to the LINE Harness Worker API */
async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiUrl = process.env.LINE_HARNESS_API_URL;
  const apiKey = process.env.LINE_HARNESS_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "LINE_HARNESS_API_URL and LINE_HARNESS_API_KEY are required",
    );
  }

  const url = `${apiUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const options: RequestInit = { method, headers };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export function registerSetupNotificationWebhook(server: McpServer): void {
  server.tool(
    "setup_notification_webhook",
    "Register the outgoing webhook so LINE messages trigger real-time MCP notifications. Run this once to enable real-time alerts. The webhook is registered in the CRM's outgoing_webhooks table.",
    {
      port: z
        .number()
        .optional()
        .describe(
          `Local port the MCP webhook listener is on (default: ${DEFAULT_PORT})`,
        ),
      action: z
        .enum(["setup", "status", "remove"])
        .default("setup")
        .describe(
          "setup = create/verify webhook, status = check current state, remove = delete webhook",
        ),
    },
    async ({ port, action }) => {
      const listenerPort =
        port ?? (Number(process.env.MCP_WEBHOOK_PORT) || DEFAULT_PORT);
      const webhookUrl = `http://127.0.0.1:${listenerPort}/webhook`;

      try {
        if (action === "status") {
          const resp = await apiRequest<{
            data: OutgoingWebhook[];
          }>("GET", "/api/webhooks/outgoing");

          const ours = resp.data?.find((w) => w.name === WEBHOOK_NAME);
          if (ours) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Notification webhook is registered:\n  ID: ${ours.id}\n  URL: ${ours.url}\n  Events: ${JSON.stringify(ours.eventTypes)}\n  Active: ${ours.isActive ? "yes" : "no"}`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text" as const,
                text: "No notification webhook found. Run setup_notification_webhook with action='setup' to create one.",
              },
            ],
          };
        }

        if (action === "remove") {
          const resp = await apiRequest<{
            data: OutgoingWebhook[];
          }>("GET", "/api/webhooks/outgoing");

          const ours = resp.data?.find((w) => w.name === WEBHOOK_NAME);
          if (!ours) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No notification webhook found to remove.",
                },
              ],
            };
          }

          await apiRequest("DELETE", `/api/webhooks/outgoing/${ours.id}`);
          return {
            content: [
              {
                type: "text" as const,
                text: `Removed notification webhook (${ours.id}).`,
              },
            ],
          };
        }

        // action === "setup"
        const resp = await apiRequest<{
          data: OutgoingWebhook[];
        }>("GET", "/api/webhooks/outgoing");

        const ours = resp.data?.find((w) => w.name === WEBHOOK_NAME);

        if (ours) {
          if (ours.url !== webhookUrl) {
            await apiRequest("PUT", `/api/webhooks/outgoing/${ours.id}`, {
              url: webhookUrl,
              eventTypes: ["message_received"],
              isActive: true,
            });
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Updated notification webhook URL to ${webhookUrl} (ID: ${ours.id})`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text" as const,
                text: `Notification webhook already set up at ${webhookUrl} (ID: ${ours.id}). No changes needed.`,
              },
            ],
          };
        }

        // Create new
        const result = await apiRequest<{
          data: { id: string };
        }>("POST", "/api/webhooks/outgoing", {
          name: WEBHOOK_NAME,
          url: webhookUrl,
          eventTypes: ["message_received"],
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Notification webhook created!\n  ID: ${result.data?.id ?? "unknown"}\n  URL: ${webhookUrl}\n  Events: message_received\n\nReal-time LINE message notifications are now active.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to ${action} notification webhook: ${String(error)}\n\nManual setup: Add an outgoing webhook in the CRM dashboard with:\n  Name: ${WEBHOOK_NAME}\n  URL: ${webhookUrl}\n  Events: ["message_received"]`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
