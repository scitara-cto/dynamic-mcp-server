# Dynamic MCP Server Refactor Implementation Plan

---

## Recent Improvements (May 2024)

- Admin user is now created with access to all user and tool management tools by default.
- All tool outputs are now MCP protocol-compliant (output formatting enforced for all tools).
- User management tools (list, add, update, delete) are implemented and provide schema guidance for finding users and valid tools.
- The update-user tool now supports updating allowedTools and sharedTools.
- **Session-based tool loading:** Tools are loaded into memory per session based on user access, not globally at server start.
- **addTool method:** Downstream projects and examples should use `toolGenerator.addTool` to persist tools to the DB; `registerTool` is for in-memory registration only.
- **Tools collection:** User-created and built-in tools are persisted, and only loaded for sessions as needed.
- **Examples updated:** Weather server and other examples now use `addTool` for persistence.
- **Tool sharing model:**
  - `allowedTools` is a string array of tool names/IDs the user owns or is directly allowed to use.
  - `sharedTools` is an array of objects, each with `toolId`, `sharedBy`, `accessLevel` ("read"|"write"), and `sharedAt`.
  - Sharing/unsharing is managed by updating `sharedTools` on the recipient user record.
- **share-tool and unshare-tool:** Added to user management tools and implemented, allowing tool creators to share/unshare tools with other users.
- **Refactored tool sharing logic:** share-tool and unshare-tool now use a single, maintainable implementation for updating sharing state and notifying user sessions.

---

## Phase 1: Preparation & Discovery

- [x] Review the current codebase (especially `src/mcp/server.ts`, `src/http/mcp/mcp-http-server.ts`, and any DB connection logic).
- [x] Inventory all current exports and identify what is and isn't exposed to downstream projects.
- [x] Identify all places where MongoDB and HTTP server instances are created/used.
- [x] **Note:** MongoDB is not currently used in dynamic-mcp-server. For reference implementations of MongoDB integration, user schema, and repository pattern, see the knowledge-mcp-server project in `~/code/knowledge-mcp-server`.
- [x] Review downstream projects (e.g., knowledge-mcp-server) for their current usage patterns and extension needs.

---

## Phase 2: Core Infrastructure Refactor & User Management Tools

**Reference Implementation:**

- For MongoDB connection and user repository/model, see:
  - `knowledge-mcp-server/src/db/connection.ts`
  - `knowledge-mcp-server/src/db/models/User.ts`
  - `knowledge-mcp-server/src/db/models/repositories/UserRepository.ts`
- Use these as the basis for the new implementation in `dynamic-mcp-server`.

### 2.1 MongoDB Connection Refactor

- [x] Add MongoDB support to dynamic-mcp-server, following the implementation and repository pattern used in knowledge-mcp-server.
- [x] Refactor MongoDB connection logic to ensure a single instance is created (e.g., in a new `src/db/connection.ts` or similar).
- [x] Export the MongoDB client/connection from the main entrypoint or a dedicated module.
- [x] Update all internal repositories/models to use the shared connection.
- [x] Remove any duplicate/legacy connection logic.

### 2.2 HTTP Server Refactor

- [ ] Refactor HTTP server initialization to ensure a single Express app or HTTP server instance is created.
- [ ] Export the HTTP server/Express app from the main entrypoint or a dedicated module.
- [ ] Update all internal route/handler registration to use this instance.
- [ ] Remove any duplicate/legacy HTTP server logic.
- [ ] Provide clear documentation and code examples for:
  - Registering new collections/repositories using the exported MongoDB connection.
  - Adding custom HTTP routes/handlers using the exported HTTP server.
- [ ] Add tests to ensure downstream projects can successfully extend both the DB and HTTP server.
- [ ] Share the user repository with downstream projects. **(Note: It is still under review whether the entire repository should be shared or just read-only access.)**

### 2.3 User Model & Repository Implementation

- [x] Implement the core user schema and repository using the shared MongoDB connection.
- [x] Ensure the user model supports extensibility (e.g., via schema extension or plugins).
- [x] Add support for tool sharing and roles as per the new schema.

### 2.4 Admin User Bootstrapping

- [x] On server start, check for an admin user (email from env var, e.g., MCP_ADMIN_EMAIL) and create it if it does not exist.
- [x] Encapsulate the admin user check and creation logic in a static method on the UserRepository (e.g., ensureAdminUser).
- [x] Call this method from the main server startup to guarantee an initial admin is available for accessing user management tools and performing administrative operations.
- [x] Admin user is now created with access to all user and tool management tools by default.

### 2.5 Tool Execution Authorization Flow

- [x] Implement logic to extract user identity from the validated OAuth token on tool execution requests.
- [x] Look up the user in the MongoDB user collection and check authorization for the requested tool.
- [x] If the user does not exist or is not authorized, return a response indicating the user should contact the administrator to be added.
- [x] Allow the user to retry tool execution after being added, without needing to restart the session.
- [x] Implement audit logging for authorization events.
- [x] Follow the detailed flow as described in the specification.
- [x] Refactor: Modularize the ToolGenerator class into multiple files for maintainability (`SessionToolManager`, `ToolAuthorization`, `ToolRegistry`).
- [x] Output formatting for all tools is now enforced.
- [x] **Session-based tool loading:** Tools are loaded into memory per session based on user access, not globally at server start.
- [x] **addTool method:** Downstream projects and examples should use `toolGenerator.addTool` to persist tools to the DB; `registerTool` is for in-memory registration only.
- [x] **Tools collection:** User-created and built-in tools are persisted, and only loaded for sessions as needed.

---

## Phase 3: User Management Tools (CRUD)

- [x] Implement user management tools (list, add, delete, update users) as MCP tools and/or HTTP endpoints.
- [x] Ensure these tools follow the extensibility and security patterns of other server tools.
- [x] Use these tools as a testable milestone and stopping point before proceeding to tool sharing features.
- [x] User management tools now provide schema guidance for finding users and valid tools.
- [x] Update-user tool now allows updating allowedTools and sharedTools, with guidance to use list-tools for valid tool names.
- [x] **share-tool and unshare-tool:** Added and implemented for managing tool sharing via the user record.
- [x] **Refactored tool sharing logic:** share-tool and unshare-tool now use a single, maintainable implementation for updating sharing state and notifying user sessions.

---

## Phase 4: Tool Sharing Model & APIs

- [x] Implement the tool sharing schema in the user model (allowedTools as string[], sharedTools as array of objects with toolId, sharedBy, accessLevel, sharedAt).
- [x] Add share-tool and unshare-tool to user management tools.
- [x] Implement logic to update sharedTools on the recipient user record for sharing/unsharing.
- [x] Implement tool list update events (SSE/WebSocket) for sharing/discovery.

---

## Phase 6: Testing

- [ ] Add unit, integration, and end-to-end tests for all new/refactored logic.

---

## Phase 7: Documentation & Developer Guidance

- [ ] Update README and API docs for new user/authorization/sharing model and enhanced exports.
- [ ] Provide migration and integration guides for downstream projects.
- [ ] Document extensibility points for user schema, MongoDB, and HTTP server.
- [ ] Provide code samples for common extension scenarios.

---

