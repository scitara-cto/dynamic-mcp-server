import express, { Request, Response, RequestHandler } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import { McpServer } from "../../mcp/server.js";

export class HttpServer {
  private app: express.Application;
  private mcpServer: McpServer;
  private authMiddleware: RequestHandler;
  private transports: { [sessionId: string]: SSEServerTransport } = {};

  constructor(mcpServer: McpServer, authMiddleware: RequestHandler) {
    this.app = express();
    this.mcpServer = mcpServer;
    this.authMiddleware = authMiddleware;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Apply authentication middleware to MCP endpoints
    this.app.use("/sse", this.authMiddleware);
    this.app.use("/messages", this.authMiddleware);

    // SSE endpoint
    this.app.get("/sse", async (req: Request, res: Response) => {
      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Extract auth info from request
      const authHeader = req.headers.authorization as string | undefined;
      const token = authHeader?.split(" ")[1] || "";
      const user = (req as any).user;

      // Extract DLX API URL from query parameters
      const dlxApiUrl = req.query.dlxApiUrl as string | undefined;
      const dlxApiKey = req.query.dlxApiKey as string | undefined;

      // Require DLX API URL from client
      if (!dlxApiUrl) {
        logger.error("DLX API URL not provided by client");
        res.status(400).send("DLX API URL is required");
        return;
      }

      // Create a new SSE transport
      const transport = new SSEServerTransport("/messages", res);
      logger.info(`Transport created: ${transport.sessionId}`);

      // Store the transport
      this.transports[transport.sessionId] = transport;

      // Store auth info in McpServer
      this.mcpServer.setSessionInfo(transport.sessionId, {
        token,
        user,
        dlxApiUrl,
        dlxApiKey,
      });

      // Clean up when the connection closes
      res.on("close", () => {
        logger.info(`Transport closed: ${transport.sessionId}`);
        delete this.transports[transport.sessionId];
        this.mcpServer.removeSessionInfo(transport.sessionId);
      });

      // Connect the transport to the server
      await this.mcpServer.getServer().connect(transport);

      // Add debug logging for messages
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message: any) => {
        logger.debug(`SSE message for ${transport.sessionId}:`, message);
        originalOnMessage?.(message);
      };
    });

    // Message endpoint for handling MCP messages
    this.app.post("/messages", async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      logger.info(`Received message for session: ${sessionId}`);

      const transport = this.transports[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        logger.error(`No transport found for sessionId: ${sessionId}`);
        res.status(400).send("No transport found for sessionId");
      }
    });

    // Debug endpoint to list active sessions
    this.app.get(
      "/sessions",
      this.authMiddleware,
      (_req: Request, res: Response) => {
        res.json({
          activeSessions: Object.keys(this.transports),
          count: Object.keys(this.transports).length,
        });
      },
    );

    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });
  }

  public start(): void {
    try {
      this.app.listen(config.server.port, () => {
        logger.info(`MCP server started on port ${config.server.port}`);
      });
    } catch (error) {
      logger.error(`Failed to start MCP server: ${error}`);
    }
  }
}
