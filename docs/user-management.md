# User Management

## User Model

Users are stored in MongoDB and have the following structure:

```typescript
interface SharedTool {
  toolId: string;
  sharedBy: string; // email or user ID of the sharer
  accessLevel: "read" | "write";
  sharedAt: Date;
}

interface IUser {
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  roles?: string[]; // e.g., ["admin", "power-user", "user"]
  sharedTools: SharedTool[]; // Tools shared with the user, with metadata
  hiddenTools?: string[]; // Tools the user has chosen to hide from their session (personalization only)
  apiKey: string; // Unique API key for authentication
}
```

> **Note:** Each user is assigned a unique `apiKey` for authentication. This key must be provided as a query parameter when connecting to the server.

## Tool Access Model

A user can access a tool if **any** of the following are true:

- The user's roles overlap with the tool's `rolesPermitted` array.
- The tool is in the user's `sharedTools`.
- The user is the creator of the tool.
- The tool is a built-in system tool.

The set of tools a user can access is called their **available tools**. This is computed dynamically and not stored on the user record.

## Tool Visibility (hiddenTools)

- All tools are visible to users by default.
- Users can "hide" any tool from their available tools list. The set of tools a user has chosen to hide is stored in the `hiddenTools` array.
- The `hiddenTools` array is for personalization/filtering only. **It does not grant or restrict access to tools.**
- To hide a tool, use the `hideTool` action.
- To unhide a tool, use the `unHideTool` action.

## User Management Tools

The server provides built-in tools for user CRUD operations:

- **List Users**: Retrieve a paginated list of users.
- **Add User**: Create a new user.
- **Delete User**: Remove a user by email.
- **Update User**: Update user fields (name, roles, shared tools, etc.).
- **Hide Tool**: Add a tool to a user's `hiddenTools` array. This allows the user to personalize their tool list by hiding tools they do not wish to see.
- **Unhide Tool**: Remove a tool from a user's `hiddenTools` array.

These tools are available to users with the `admin` role.

## Admin User Bootstrapping

- The admin user's email is set via the `MCP_ADMIN_EMAIL` environment variable.
- On server start, if the admin user does not exist, it is created automatically with admin privileges.
- **The admin user's apiKey is logged to the console at startup for easy access.**

## Roles & Authorization

- Users with the `admin` role can manage users and tools.
- Tool access is controlled via `rolesPermitted` (on the tool), `sharedTools` (on the user), and creator/system status.
- The `hiddenTools` array is for personalization only and does not grant or restrict access.

## MongoDB Integration

- All user data is stored in MongoDB.
- Downstream projects can use the exported MongoDB connection to add custom collections or extend the user model.

See [Authentication & Authorization](./authentication.md) for more details on how users are authenticated and authorized.
