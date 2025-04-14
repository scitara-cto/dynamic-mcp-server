# DLX MCP Server

A Model Context Protocol (MCP) server for the DLX application that provides tools and resources for AI agents.

## Features

- OAuth2 authentication with Keycloak
- HTTP with SSE transport for robust communication
- Tools for interacting with the DLX application
- Debug endpoints for troubleshooting

## Prerequisites

- Node.js 18.19.0 or higher
- npm 9.0.0 or higher
- Access to a Keycloak server

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/dlx-mcp-server.git
   cd dlx-mcp-server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your Keycloak configuration:
   ```bash
   KEYCLOAK_AUTH_SERVER_URL=https://your-keycloak-server
   KEYCLOAK_REALM=your-realm
   KEYCLOAK_CLIENT_ID=your-client-id
   KEYCLOAK_CLIENT_SECRET=your-client-secret
   PORT=3000
   ```

## Development

To run the server in development mode:

```bash
npm run dev
```

This will start the server on the port specified in your `.env` file (default: 3000).

## Building and Running

To build and run the server:

```bash
npm run build
npm start
```

## Connecting with Cursor

To connect this MCP server with Cursor, create a `.cursor/mcp.json` file with the following content:

```json
{
  "mcpServers": {
    "dlx-mcp-server": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

## API Endpoints

- `/sse` - SSE endpoint for establishing a connection with the MCP server
- `/messages` - Endpoint for handling MCP messages
- `/sessions` - Debug endpoint to list active sessions
- `/health` - Health check endpoint

## Authentication

The server uses OAuth2 authentication with Keycloak. To authenticate:

1. Obtain a token from your Keycloak server
2. Include the token in the Authorization header: `Authorization: Bearer <token>`

## Troubleshooting

If you encounter issues with the SSE connection:

1. Check the server logs for any errors
2. Visit the `/sessions` endpoint to see active sessions
3. Ensure your Keycloak configuration is correct
4. Check that the client has the necessary scopes

## License

[MIT](LICENSE)
