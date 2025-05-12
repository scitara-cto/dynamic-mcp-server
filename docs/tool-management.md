# Tool Management & Sharing

## Tool Registration

- Use `publishTool` to register a tool with the server (in-memory, per session).
- Use `addTool` to persist a tool to the database (durable registration).
- Tools are loaded into memory per session based on user access (not globally at server start).

## Durable Tool Storage

- All tools (built-in and user-created) are persisted in MongoDB.
- Tools are loaded for each user session based on their access rights.

## Tool Sharing Model

- Tools can be shared with other users.
- Sharing is managed by updating the `sharedTools` array on the recipient user record.
- Each shared tool entry includes:
  - `toolId`: The tool being shared
  - `sharedBy`: The user who shared the tool
  - `accessLevel`: "read" or "write"
  - `sharedAt`: Timestamp of sharing

## Tool Management Tools

- **List Tools**: View all tools available to the user.
- **Add Tool**: Register a new tool (admin or owner only).
- **Delete Tool**: Remove a tool (admin or owner only).
- **Share Tool**: Share a tool with another user.
- **Unshare Tool**: Revoke sharing of a tool.

## Real-Time Updates

- When tools are added, deleted, or shared/unshared, all affected user sessions are notified in real time.

See [User Management](./user-management.md) for how tool access is managed per user.
