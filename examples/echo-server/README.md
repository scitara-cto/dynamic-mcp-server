# Echo MCP Server Example

This example demonstrates how to use the DynamicMcpServer to create a simple MCP server with an echo handler.

## Features

- Uses DynamicMcpServer for MCP protocol handling
- Implements a simple echo handler that returns the input message
- Includes OAuth authentication
- Demonstrates tool registration and event handling

## Running the Example

1. Make sure you have the required environment variables set up in your `.env` file:

   ```
   KEYCLOAK_AUTH_SERVER_URL=your_auth_server_url
   KEYCLOAK_REALM=your_realm
   KEYCLOAK_CLIENT_ID=your_client_id
   KEYCLOAK_CLIENT_SECRET=your_client_secret
   PORT=4001
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the example:
   ```bash
   npm run example:echo
   ```

## Testing the Server

Once the server is running, you can test it using any MCP client. The server will:

1. Accept OAuth-authenticated connections
2. Register the echo handler as a tool
3. Process echo requests and return the input message

Example request:

```json
{
  "jsonrpc": "2.0",
  "method": "echo",
  "params": {
    "message": "Hello, MCP!"
  }
}
```

Expected response:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "message": "Echo: Hello, MCP!"
  }
}
```
