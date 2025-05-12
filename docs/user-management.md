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
  roles?: string[];
  allowedTools?: string[]; // Tools the user owns or is directly allowed to use
  sharedTools: SharedTool[]; // Tools shared with the user, with metadata
}
```

## User Management Tools

The server provides built-in tools for user CRUD operations:

- **List Users**: Retrieve a paginated list of users.
- **Add User**: Create a new user.
- **Delete User**: Remove a user by email.
- **Update User**: Update user fields (name, roles, allowed tools, etc.).

These tools are available to users with the `admin` role.

## Admin User Bootstrapping

- The admin user's email is set via the `MCP_ADMIN_EMAIL` environment variable.
- On server start, if the admin user does not exist, it is created automatically with admin privileges.

## Roles & Authorization

- Users with the `admin` role can manage users and tools.
- Tool access is controlled via `allowedTools` and `sharedTools`.

## MongoDB Integration

- All user data is stored in MongoDB.
- Downstream projects can use the exported MongoDB connection to add custom collections or extend the user model.

See [Authentication & Authorization](./authentication.md) for more details on how users are authenticated and authorized.
