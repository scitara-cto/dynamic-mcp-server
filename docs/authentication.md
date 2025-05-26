# Authentication & Authorization

Authentication and authorization are distinct in the dynamic-mcp-server:

- **Authentication** is used to initiate an MCP session. It verifies the user's identity using an API key and allows the user to connect to the server.
- **Authorization** provides granular control over which tools a user can access and use, based on their roles, allowed tools, and shared tools in MongoDB.

## Authentication (API Key)

- Users authenticate via a unique `apiKey` assigned to them on creation.
- Clients must include the `apiKey` as a query parameter (e.g., `/sse?apiKey=...`) when connecting.
- The server validates the `apiKey` and looks up the user in the database.
- If the `apiKey` is valid, the user is authenticated and a session is created.

## Authorization

- User authorization is managed in MongoDB.
- On each request, the server checks the user's record to determine access to tools and management features.
- Admins are identified by the `admin` role in their user record.

## Tool Execution Flow

1. Client provides their `apiKey` as a query parameter to connect to the MCP server.
2. Server validates the `apiKey` and looks up the user.
3. If the user exists and is authorized, the tool is executed.
4. If the user does not exist or is not authorized, the server returns an error and logs the event.
5. Once the user is added/authorized, they can retry tool execution without restarting the session.

## Admin Bootstrapping

- The admin user's email is set via the `MCP_ADMIN_EMAIL` environment variable.
- The admin user is created automatically on server start if not present.
- Admins can view all user apiKeys in the logs to help set up and manage users.

See [User Management](./user-management.md) for more on user roles and access control.
