# Tool Management & Sharing

## Tool Registration

- Use `publishTool` to register a tool with the server (in-memory, per session).
- Use `addTool` to persist a tool to the database (durable registration).
- Tools are loaded into memory per session based on user access (not globally at server start).

## Durable Tool Storage

- All tools (built-in and user-created) are persisted in MongoDB.
- Tools are loaded for each user session based on their access rights.

## Tool Access Model

A user can access a tool if **any** of the following are true:

- The user's roles overlap with the tool's `rolesPermitted` array.
- The tool is in the user's `sharedTools`.
- The user is the creator of the tool.
- The tool is a built-in system tool.

The set of tools a user can access is called their **available tools**. This is computed dynamically and not stored on the user record.

## Tool Usage (usedTools)

- Users can "activate" (select for use) any tool from their available tools list. The set of tools a user has chosen to use is stored in the `usedTools` array.
- The `usedTools` array is for personalization/filtering only. **It does not grant access to tools.**
- To add a tool to your `usedTools`, use the `use-tools` action.

## Tool Management Tools

- **List Tools**: View all tools available to the user. Each tool in the list includes:
  - `available`: Whether the user is permitted to use the tool (see above).
  - `inUse`: Whether the tool is in the user's `usedTools` array.
- **Add Tool**: Register a new tool (admin or owner only).
- **Delete Tool**: Remove a tool (admin or owner only).
- **Share Tool**: Share a tool with another user.
- **Unshare Tool**: Revoke sharing of a tool.

## Real-Time Updates

- When tools are added, deleted, or shared/unshared, all affected user sessions are notified in real time.

See [User Management](./user-management.md) for how tool access is managed per user.
