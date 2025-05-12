# Authentication & Authorization

Authentication and authorization are distinct in the dynamic-mcp-server:

- **Authentication** is used to initiate an MCP session. It verifies the user's identity using OAuth (e.g., Keycloak) and allows the user to connect to the server.
- **Authorization** provides granular control over which tools a user can access and use, based on their roles, allowed tools, and shared tools in MongoDB.

## Authentication

- Users authenticate via OAuth (e.g., Keycloak).
- Clients obtain an access token and include it in the `Authorization: Bearer <token>` header for all requests.
- The server validates the token and extracts user identity (email, roles, etc.) from the token claims.

## Authorization

- User authorization is managed in MongoDB.
- On each request, the server checks the user's record to determine access to tools and management features.
- Admins are identified by the `admin` role in their user record.

## Tool Execution Flow

1. Client authenticates via OAuth and receives an access token.
2. Client connects to the MCP server and includes the access token in all requests.
3. Server validates the token and extracts user info.
4. Server looks up the user in MongoDB.
5. If the user exists and is authorized, the tool is executed.
6. If the user does not exist or is not authorized, the server returns an error and logs the event.
7. Once the user is added/authorized, they can retry tool execution without restarting the session.

## Admin Bootstrapping

- The admin user's email is set via the `MCP_ADMIN_EMAIL` environment variable.
- The admin user is created automatically on server start if not present.

See [User Management](./user-management.md) for more on user roles and access control.
