import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DynamicMcpServer } from "../mcp/server.js";

export interface SessionInfo {
  sessionId: string;
  user: any;
  token: string;
  mcpServer: DynamicMcpServer;
}

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

export type Transport = StreamableHTTPServerTransport;

export interface TransportStorage {
  [sessionId: string]: Transport;
}