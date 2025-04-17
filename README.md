# DLX MCP Server

A Model Context Protocol (MCP) server for the DLX application that provides tools and resources for AI agents.

## Features

- OAuth2 authentication with Keycloak
- HTTP with SSE transport for robust communication
- Tools for interacting with the DLX application
- Debug endpoints for troubleshooting
- TypeScript support
- Comprehensive logging system
- Test suite with Jest

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

4. Update the `.env` file with your configuration:

   ```bash
   # Server Configuration
   MCP_PORT=4001
   AUTH_PORT=4000

   # Keycloak Configuration
   KEYCLOAK_AUTH_SERVER_URL=https://your-keycloak-server
   KEYCLOAK_REALM=your-realm
   KEYCLOAK_CLIENT_ID=your-client-id
   KEYCLOAK_CLIENT_SECRET=your-client-secret
   KEYCLOAK_REDIRECT_URI=http://localhost:4000/callback

   # Logging Configuration
   LOG_LEVEL=info
   LOG_FILE_PATH=logs
   ```

## Development

To run the server in development mode:

```bash
npm run dev
```

This will start the server on the ports specified in your `.env` file (default: MCP_PORT=4001, AUTH_PORT=4000).

## Building and Running

To build and run the server:

```bash
npm run build
npm start
```

## Testing

The project includes a test suite using Jest. To run tests:

```bash
npm test
```

For watch mode during development:

```bash
npm run test:watch
```

## Authentication Utilities

The project includes several utility scripts for working with Keycloak authentication:

- `npm run get-token` - Get an authentication token
- `npm run check-realm` - Check realm configuration
- `npm run get-client-token` - Get a client token
- `npm run get-auth-url` - Get the authentication URL
- `npm run get-token-with-code` - Get a token using an authorization code

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
  - Query Parameters:
    - `dlxApiUrl` - (Optional) The URL of the DLX API to use for this connection. If not provided, the default URL from the server configuration will be used.
- `/messages` - Endpoint for handling MCP messages
- `/sessions` - Debug endpoint to list active sessions
- `/health` - Health check endpoint

## Authentication

The server uses OAuth2 authentication with Keycloak. To authenticate:

1. Obtain a token from your Keycloak server
2. Include the token in the Authorization header: `Authorization: Bearer <token>`

## Logging

The server uses Winston for logging. Logs are stored in the `logs` directory by default. The log level can be configured in the `.env` file using the `LOG_LEVEL` variable.

## Troubleshooting

If you encounter issues:

1. Check the server logs in the `logs` directory
2. Visit the `/sessions` endpoint to see active sessions
3. Ensure your Keycloak configuration is correct
4. Check that the client has the necessary scopes
5. Verify that both MCP_PORT and AUTH_PORT are available and correctly configured

## License

[MIT](LICENSE)
