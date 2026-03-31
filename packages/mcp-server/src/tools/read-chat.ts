import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";

export function registerReadChat(server: McpServer): void {
  server.tool(
    "read_chat",
    "Read the full message history of a specific LINE chat. Returns all messages (incoming and outgoing) in chronological order. Get the chat ID from fetch_messages first.",
    {
      chatId: z.string().describe("The chat ID to read messages from"),
    },
    async ({ chatId }) => {
      try {
        const client = getClient();
        const chat = await client.chats.get(chatId);

        const header = `Chat with ${chat.friendName || "Unknown"} (${chat.status})`;
        const messages = chat.messages || [];

        if (messages.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `${header}\n\nNo messages yet.`,
              },
            ],
          };
        }

        const lines = messages.map((m) => {
          const dir = m.direction === "incoming" ? "👤" : "🤖";
          const time = m.createdAt;
          return `${dir} [${time}] ${m.content}`;
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `${header}\n${messages.length} messages:\n\n${lines.join("\n")}`,
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

  server.tool(
    "reply_to_chat",
    "Send a reply message in a LINE chat. Use this to respond to LINE users.",
    {
      chatId: z.string().describe("The chat ID to reply in"),
      content: z.string().describe("Message content to send"),
      messageType: z
        .enum(["text", "flex"])
        .default("text")
        .describe("Message type: 'text' for plain text, 'flex' for Flex Message"),
    },
    async ({ chatId, content, messageType }) => {
      try {
        const client = getClient();
        const result = await client.chats.send(chatId, content, messageType);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, messageId: result.messageId },
                null,
                2,
              ),
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
