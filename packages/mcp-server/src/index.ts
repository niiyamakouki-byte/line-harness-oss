import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";
import { startWebhookListener } from "./webhook-listener.js";

const DEFAULT_WEBHOOK_PORT = 3456;

const server = new McpServer({
  name: "line-harness",
  version: "0.7.0",
});

registerAllTools(server);
registerAllResources(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE Harness MCP Server running on stdio");

  // Start the webhook listener for real-time notifications
  const webhookPort =
    Number(process.env.MCP_WEBHOOK_PORT) || DEFAULT_WEBHOOK_PORT;
  const httpServer = startWebhookListener(server, webhookPort);

  // Graceful shutdown
  const cleanup = () => {
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
