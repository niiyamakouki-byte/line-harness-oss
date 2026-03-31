import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

export function registerFetchMessages(server: McpServer): void {
  server.tool(
    "fetch_messages",
    "Fetch recent LINE chats with their latest messages. Returns a list of conversations sorted by most recent activity. Use this to see what LINE users have been saying.",
    {
      status: z
        .enum(["open", "in_progress", "resolved", "closed"])
        .optional()
        .describe("Filter by chat status"),
      accountId: z
        .string()
        .optional()
        .describe("Filter by LINE account ID (for multi-account setups)"),
    },
    async ({ status, accountId }) => {
      try {
        const client = getClient();
        const chats = await client.chats.list({ status, accountId });

        if (chats.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No chats found.",
              },
            ],
          };
        }

        const lines = chats.map((chat) => {
          const name = chat.friendName || "Unknown";
          const time = chat.lastMessageAt || "N/A";
          return `[${chat.id}] ${name} (status: ${chat.status}) — last message: ${time}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `${chats.length} chats found:\n\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: false, error: String(error) },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
