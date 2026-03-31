/**
 * Lightweight HTTP server that receives outgoing webhook POSTs
 * from the Cloudflare Worker when LINE messages arrive.
 *
 * On receiving a message_received event, it:
 * 1. Stores the event in a ring buffer
 * 2. Fires MCP resource-updated notification
 * 3. Sends an MCP logging message so the client is alerted
 */

import { createServer, type Server as HttpServer } from "node:http";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: {
    friendId?: string;
    eventData?: Record<string, unknown>;
  };
}

/** Ring buffer of recent webhook events (max 50) */
const recentEvents: WebhookEvent[] = [];
const MAX_EVENTS = 50;

export function getRecentEvents(): readonly WebhookEvent[] {
  return recentEvents;
}

export function clearEvents(): void {
  recentEvents.length = 0;
}

/**
 * Start the webhook listener HTTP server.
 * Returns the server instance for cleanup.
 */
export function startWebhookListener(
  mcpServer: McpServer,
  port: number,
): HttpServer {
  const httpServer = createServer(async (req, res) => {
    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", events: recentEvents.length }));
      return;
    }

    // Webhook endpoint
    if (req.method === "POST" && req.url === "/webhook") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body) as WebhookEvent;

          // Store in ring buffer
          recentEvents.unshift(payload);
          if (recentEvents.length > MAX_EVENTS) {
            recentEvents.length = MAX_EVENTS;
          }

          // Extract useful info for logging
          const friendId = payload.data?.friendId ?? "unknown";
          const text =
            (payload.data?.eventData?.text as string) ?? "(non-text message)";
          const senderName =
            (payload.data?.eventData?.displayName as string) ?? friendId;

          // 1. Notify MCP client that the new-messages resource changed
          try {
            await mcpServer.server.sendResourceUpdated({
              uri: "line-harness://notifications/new-messages",
            });
          } catch {
            // Client may not support resource subscriptions — that's fine
          }

          // 2. Send a logging message the client can surface
          try {
            await mcpServer.sendLoggingMessage({
              level: "info",
              logger: "line-webhook",
              data: {
                type: "new_line_message",
                friendId,
                senderName,
                text,
                timestamp: payload.timestamp,
              },
            });
          } catch {
            // Client may not be connected yet
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true }));
        } catch (err) {
          console.error("Webhook parse error:", err);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // 404 for anything else
    res.writeHead(404);
    res.end("Not Found");
  });

  httpServer.listen(port, "127.0.0.1", () => {
    console.error(
      `Webhook listener running on http://127.0.0.1:${port}/webhook`,
    );
  });

  return httpServer;
}
