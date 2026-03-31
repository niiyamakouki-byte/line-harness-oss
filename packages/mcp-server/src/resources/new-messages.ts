/**
 * MCP resource: line-harness://notifications/new-messages
 *
 * Returns the queue of recent incoming LINE messages received via webhook.
 * Clients that subscribe to this resource will be notified in real-time
 * when new messages arrive (via the webhook listener).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getRecentEvents, clearEvents } from "../webhook-listener.js";

export function registerNewMessagesResource(server: McpServer): void {
  server.resource(
    "New LINE Messages",
    "line-harness://notifications/new-messages",
    {
      description:
        "Real-time queue of incoming LINE messages. Subscribe to this resource to be notified when new messages arrive. Reading clears the queue.",
      mimeType: "application/json",
    },
    async (_uri) => {
      const events = getRecentEvents();

      // Format events into a readable summary
      const messages = events
        .filter((e) => e.event === "message_received")
        .map((e) => ({
          friendId: e.data?.friendId,
          senderName: e.data?.eventData?.displayName ?? e.data?.friendId,
          text: e.data?.eventData?.text ?? "(non-text)",
          timestamp: e.timestamp,
        }));

      const result = {
        pendingCount: messages.length,
        messages,
      };

      // Clear after reading so the client doesn't see duplicates
      clearEvents();

      return {
        contents: [
          {
            uri: "line-harness://notifications/new-messages",
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
