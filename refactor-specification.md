# Dynamic MCP Server Refactor Specification: User-Based Tool Sharing, Modern Authentication, and Shared Database Access

---

## Recent Additions & Clarifications (May 2024)

- **Session-based tool loading:** Tools are loaded into memory per session based on user access, not globally at server start.
- **addTool method:** Downstream projects and examples should use `toolGenerator.addTool` to persist tools to the DB; `registerTool` is for in-memory registration only.
- **Tools collection:** User-created and built-in tools are persisted, and only loaded for sessions as needed.
- **Examples updated:** Weather server and other examples now use `addTool` for persistence.
- **Handler registration:** Handlers (handler factories) are registered globally at server startup and do not change at runtime. Tool registration is dynamic and per-session.
- **Tool sharing model clarified:**
  - `allowedTools` is a string array of tool names/IDs the user owns or is directly allowed to use.
  - `sharedTools` is an array of objects, each with `toolId`, `sharedBy`, `accessLevel` ("read"|"write"), and `sharedAt`.
  - Sharing/unsharing is managed by updating `sharedTools` on the recipient user record.

---

## 1. Introduction & Motivation

Dynamic MCP Server is a framework for building extensible, tool-driven AI servers. Its current authentication model is based on OAuth (e.g., Keycloak), which provides secure, standards-based user authentication. However, the server's ability to manage users, resources, and advanced features like tool sharing is limited without a dedicated user database. Most downstream projects manage their own database connections, leading to duplicated connections and inconsistent patterns.

**This refactor will:**

- Augment the existing OAuth-based authentication with a user authorization layer, using a MongoDB user database to manage access control, tool sharing, and user metadata.
- Enable user-based tool sharing and fine-grained access control.
- Export a single MongoDB connection/database object for all downstream projects, enforcing a repository pattern and extensibility.
- Export the HTTP server instance so downstream projects can add custom routes/handlers (e.g., for OAuth redirects) without running a separate HTTP server or consuming another port.
- **Persist tool definitions (built-in and user-created) in a tools collection, and load tools into memory per session based on user access.**
- **Provide a public addTool method for durable tool registration.**

**System Flow Overview:**

- Clients connect to the server and authenticate via OAuth (Keycloak).
- The client includes an access token in the `Authorization: Bearer <token>` header for all requests (including SSE and tool execution).
- The server validates the token and extracts user identity (e.g., email) from the token claims.
- On tool execution, the server checks the MongoDB user record for authorization.
- If the user is not found or not authorized, the server returns a response indicating the user should contact the administrator to be added.
- Once the admin adds the user, the user can retry tool execution without restarting the session.
- Downstream projects use the exported MongoDB connection to add their own collections/repositories.
- Downstream projects use the exported HTTP server to add custom routes/handlers as needed.
- **Downstream projects and examples use addTool to persist tool definitions; registerTool is for in-memory registration only.**
- **Handlers are registered globally at startup; tool registration is dynamic and per-session.**

---

## 2. System Architecture

**Components:**

- **dynamic-mcp-server**: Core server, manages users, tools, authentication (via OAuth), exports MongoDB connection, and exposes the HTTP server instance.
- **MCP Clients**: Connect via SSE/HTTP, authenticate via OAuth, interact with tools.
- **Downstream Projects**: Extend the server with new tools, collections, business logic, and custom HTTP routes.
- **MongoDB**: Single instance/connection, shared by all components.

**Architecture Diagram (textual):**

```
[MCP Client] --(OAuth Access Token)--> [dynamic-mcp-server]
                                 |
                                 |--[User Auth Flow (OAuth, SSO, etc.)]
                                 |
                                 |--[Exports MongoDB Connection]---> [Downstream Project: Custom Collections/Repos]
                                 |
                                 |--[Exports HTTP Server]---> [Downstream Project: Custom HTTP Routes/Handlers]
                                 |
                                 |--[Tool Sharing, User Management, User Authorization]
                                 |
                              [MongoDB]
```

---

## 3. Database & Repository Pattern

- **MongoDB Connection:**

  - The server creates and exports a single MongoDB connection (e.g., a `MongoClient` or Mongoose instance).
  - Downstream projects import and use this connection for all collections/models.

- **Repository Pattern:**
  - All DB access is performed through repository classes.
  - Example (TypeScript):

```typescript
// Exported from dynamic-mcp-server
export const mongoClient: MongoClient = ...;

// In downstream project
import { mongoClient } from 'dynamic-mcp-server';

const db = mongoClient.db('mydb');
const myCollection = db.collection('myCustomCollection');

class MyRepository {
  constructor(private collection = myCollection) {}
  async findById(id: string) { return this.collection.findOne({ _id: id }); }
  // ...
}
```

- **No duplicate connections:** Only one MongoDB instance per process.

---

## 4. HTTP Server Extensibility

- **Exported HTTP Server:**

  - The dynamic-mcp-server will export or provide access to its HTTP server instance (e.g., an Express app or Node HTTP server).
  - Downstream projects can use this to add custom routes/handlers (e.g., for OAuth redirects, webhooks, or custom endpoints) without needing to create a separate HTTP server or consume another port.

- **Example Usage in a Downstream Project:**

```typescript
// Exported from dynamic-mcp-server
export const httpServer: Express = ...;

// In downstream project
import { httpServer } from 'dynamic-mcp-server';

httpServer.get('/custom/oauth/callback', (req, res) => {
  // Handle custom OAuth redirect
  res.send('OAuth callback handled!');
});
```

- **Benefits:**
  - Avoids port conflicts and duplicated HTTP servers.
  - Centralizes all HTTP endpoints for the application.
  - Makes it easy to add new routes for authentication, webhooks, or custom APIs.

---

## 5. User Model & Extensibility

- **Base User Schema:**

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
  // Downstream projects can extend this
}
```

- **Example User Record:**

```json
{
  "email": "alice@example.com",
  "allowedTools": ["get-weather", "my-custom-tool"],
  "sharedTools": [
    {
      "toolId": "team-dashboard",
      "sharedBy": "bob@example.com",
      "accessLevel": "read",
      "sharedAt": "2024-05-09T18:00:00Z"
    }
  ]
}
```

- **Access Control:**
  - `allowedTools`: User can use (and possibly manage) these tools because they own or are directly allowed to use them.
  - `sharedTools`: User can use these tools because another user shared them, with the specified access level ("read" or "write").
  - Sharing/unsharing is managed by updating the `sharedTools` array on the recipient user record.

---

## 5a. User Management Tools (CRUD)

As part of the new user model and repository implementation, the dynamic-mcp-server MUST provide a set of user management tools for basic CRUD operations:

- **List Users**: Retrieve a paginated list of users.
- **Add User**: Create a new user (with required fields).
- **Delete User**: Remove a user by ID or email.
- **Update User**: Update user fields (e.g., name, roles, allowed tools, etc.).

These tools should be implemented as MCP tools and/or HTTP endpoints, following the same extensibility and security patterns as other server tools.

**Purpose:**

- These tools will serve as a testable milestone after the MongoDB/user repository work (Phase 2).
- They provide a foundation for user management, admin operations, and integration testing of the new infrastructure.

**Example Tool Definitions:**

```typescript
{
  name: "list-users",
  description: "List all users in the system",
  inputSchema: { ... },
  handler: { ... }
}
{
  name: "add-user",
  description: "Add a new user",
  inputSchema: { ... },
  handler: { ... }
}
{
  name: "delete-user",
  description: "Delete a user by ID or email",
  inputSchema: { ... },
  handler: { ... }
}
{
  name: "update-user",
  description: "Update user fields",
  inputSchema: { ... },
  handler: { ... }
}
```

---

## 5b. Admin User Bootstrapping

As part of the user model and repository implementation, the dynamic-mcp-server MUST support bootstrapping an initial admin user:

- **Admin User Identification:**
  - The email address of the admin user should be specified via an environment variable (e.g., `MCP_ADMIN_EMAIL`).
- **Admin User Creation:**
  - On server start, the system should check if a user with this email exists in the user database.
  - If not, it should create the admin user with appropriate admin privileges/role.
- **Purpose:**
  - This ensures there is always at least one user with access to user management tools and administrative actions, even on a fresh deployment.

---

## 6. Authentication Flow & Providers

- **Step-by-Step Flow:**

  1. Client authenticates the user via OAuth (Keycloak) and receives an access token.
  2. Client connects to the MCP server and includes the access token in the `Authorization: Bearer <token>` header for all requests (including SSE and tool execution).
  3. Server validates the token and extracts user identity (e.g., email) from the token claims.

---

## 6.1 Tool Execution Authorization Flow

- On tool execution request:
  1. The server extracts user identity from the validated OAuth token (e.g., email).
  2. The server looks up the user in the MongoDB user collection using the unique identifier from the token.
  3. If the user exists and is authorized, the tool is executed.
  4. If the user does not exist or is not authorized, the server returns a response indicating the user should contact the administrator to be added.
  5. The user can retry tool execution after being added, without needing to restart the session.
  6. All authorization events are logged for audit purposes.

---

## 7. Tool Sharing Model

- **Data Model:**
  - Each user has a `sharedTools` array:

```typescript
sharedTools: {
  toolId: string;
  sharedBy: string;
  accessLevel: "read" | "write";
  sharedAt: Date;
}
[];
```

- **API Endpoints:**

  - `POST /tools/share` — Share a tool with another user.
  - `GET /tools/shared` — List tools shared with the user.
  - `DELETE /tools/share` — Revoke sharing.

- **Event Payloads:**
  - Tool list update events (SSE/WebSocket):

```json
{
  "event": "toolListUpdate",
  "tools": [ ... ]
}
```

- **Access Control & Error Handling:**
  - Only owners can share/revoke.
  - Recipients see shared tools in their tool list.
  - Errors: unauthorized, not found, already shared, etc.

---

## 8. Security & Privacy

- **Encryption:**
  - Sensitive fields encrypted at rest (e.g., using AES-256).
- **Audit Logging:**
  - All auth and sharing events logged (user, action, timestamp, outcome).

---

## 9. Configuration & Environment

- **MongoDB:**
  - URI, database name, and options via environment variables or config file.
- **Auth Providers:**
  - Configurable via JSON/YAML/env.
- **Other Settings:**
  - API key management, server port, etc.

---

## 10. Migration & Compatibility

- **Migration Scripts:**
  - Scripts/utilities to move user data from downstream projects to the new core user repository.
- **Legacy Clients:**
  - Backwards compatibility for API key auth and legacy flows (phased deprecation).
- **Process:**
  - Step-by-step migration guide for downstream projects.

---

## 11. Testing & Developer Guidance

- **Required Tests:**
  - Unit, integration, and end-to-end tests for user, auth, sharing, and DB logic.
- **Mocking Strategies:**
  - Mock MongoDB and auth providers for tests.
- **How to Add a Repository/Collection:**

```typescript
import { mongoClient } from "dynamic-mcp-server";
const db = mongoClient.db("mydb");
const myCollection = db.collection("custom");
class CustomRepo {
  /* ... */
}
```

- **How to Register/Share a Tool:**
  - Register via server API, share via `/tools/share` endpoint.
- **Error Handling:**
  - Standard error codes/messages for all APIs.
- **How to Add a Custom HTTP Route:**

```typescript
import { httpServer } from "dynamic-mcp-server";
httpServer.post("/my/custom/endpoint", (req, res) => {
  // Custom logic here
  res.json({ ok: true });
});
```

---

## 12. Example Flows

- **User Authentication & Authorization:**

  1. User authenticates via OAuth and receives an access token.
  2. Client connects to the MCP server and includes the access token in the `Authorization` header for all requests.
  3. On tool execution, the server extracts user info from the token and looks up the user in MongoDB.
  4. If the user exists and is authorized, the tool is executed.
  5. If the user does not exist, the server returns a response indicating the user should contact the administrator to be added.
  6. The user can retry tool execution after being added, without needing to restart the session.

---

## 13. Open Questions & Future Work

- How to support multiple authentication providers per user?
- Should tool sharing support groups/roles?
- How to handle tool versioning and updates for shared tools?
- Extending user schema in downstream projects (plugin model)?
- How to handle multi-tenant scenarios?
