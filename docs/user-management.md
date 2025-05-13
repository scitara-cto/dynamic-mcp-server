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
  usedTools?: string[]; // Tools the user has chosen to "activate" for their session (personalization only)
}
```

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

## User Management Tools

The server provides built-in tools for user CRUD operations:

- **List Users**: Retrieve a paginated list of users.
- **Add User**: Create a new user.
- **Delete User**: Remove a user by email.
- **Update User**: Update user fields (name, roles, shared tools, etc.).
- **Use Tools**: Add one or more tool IDs to a user's `usedTools` array. This allows the user to personalize their tool list. Inputs:
  - `email` (string, required): The user's email address. If unknown, use the `list-users` tool to find users.
  - `toolIds` (string[], required): An array of tool IDs to add. Use the `list-tools` tool to get a list of available tool IDs.
  - Example input:
    ```json
    {
      "email": "user@example.com",
      "toolIds": ["list-tools", "weather-tool"]
    }
    ```
  - This tool will not add duplicate tool IDs to the user's `usedTools` array.

These tools are available to users with the `admin` role.

## Admin User Bootstrapping

- The admin user's email is set via the `MCP_ADMIN_EMAIL` environment variable.
- On server start, if the admin user does not exist, it is created automatically with admin privileges.

## Roles & Authorization

- Users with the `admin` role can manage users and tools.
- Tool access is controlled via `rolesPermitted` (on the tool), `sharedTools` (on the user), and creator/system status.
- The `usedTools` array is for personalization only and does not grant access.

## MongoDB Integration

- All user data is stored in MongoDB.
- Downstream projects can use the exported MongoDB connection to add custom collections or extend the user model.

See [Authentication & Authorization](./authentication.md) for more details on how users are authenticated and authorized.
