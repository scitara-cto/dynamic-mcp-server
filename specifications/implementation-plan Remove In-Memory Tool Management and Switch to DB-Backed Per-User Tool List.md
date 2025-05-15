# Implementation Plan: Remove In-Memory Tool Management and Switch to DB-Backed Per-User Tool List

## Overview

This plan details the steps to remove legacy in-memory tool management (ToolRegistry, SessionToolManager, etc.) and refactor the codebase to use a database-backed, per-user tool list (via `usedTools` in the user model and repository). The new approach will simplify tool listing and ensure session/user-specific tool availability.

---

## 1. Remove/Refactor Old In-Memory Tool Management

### A. Remove ToolRegistry

- [x] **Delete**: `src/mcp/toolGenerator/ToolRegistry.ts`
- [x] **Remove all imports and usages** of `ToolRegistry` in:
  - [x] `src/mcp/toolGenerator/ToolGenerator.ts`
  - [x] `src/mcp/toolGenerator/index.ts`
  - [x] Any tests referencing ToolRegistry
- [x] **Remove methods** in `ToolGenerator` that delegate to ToolRegistry:
  - [x] `getRegisteredToolNames`
  - [x] `getTool`
  - [x] `publishTool` (if only used for in-memory)
  - [x] `removeTool`

### B. Remove SessionToolManager

- [x] **Delete**: `src/mcp/toolGenerator/SessionToolManager.ts`
- [x] **Remove all imports and usages** of `SessionToolManager` in:
  - [x] `src/mcp/toolGenerator/ToolGenerator.ts`
  - [x] `src/mcp/toolGenerator/index.ts`
  - [x] Any tests referencing SessionToolManager
- [x] **Remove/replace** `cleanupSession` logic in `ToolGenerator`

### C. Refactor ToolGenerator

- [x] Remove all code that registers, fetches, or manages tools in memory.
- [x] Refactor or remove:
  - [x] `registerHandlerFactory` (if only used for in-memory handler registration)
  - [x] Any logic that wraps handlers for in-memory tools
- [x] Update constructor to remove ToolRegistry and SessionToolManager

### D. Update Tests

- [ ] Remove or refactor tests that depend on in-memory tool management (see `src/mcp/toolGenerator/__tests__/ToolGenerator.test.ts` and others).

---

## 2. Implement New DB-Backed, Per-User Tool Listing

### A. UserRepository

- [x] **Add method**: `getUserTools(email: string): Promise<ToolDefinition[]>`
  - [x] Fetch user by email
  - [x] Get their `usedTools` array
  - [x] Query ToolRepository for those tool names
  - [x] Return only tools the user is authorized to use (roles, shared, etc.)

### B. Tool Listing Handler

- [x] In `ToolGenerator.initialize`, update the `ListToolsRequestSchema` handler:
  - [x] Get user email from session
  - [x] Call `UserRepository.getUserTools(email)`
  - [x] Return the resulting tool list

### C. Tool Authorization

- [x] Ensure that `UserRepository.getUserTools` only returns tools the user is authorized to use (roles, shared, etc.)
- [x] Optionally, keep `ToolAuthorization` for call-time checks, but listing should be filtered at the DB query level

### D. Add/Remove Tool Usage

- [ ] Ensure endpoints/actions for adding/removing tools from a user's `usedTools` list are present and working (see `update-usedTools` logic in user management handler)

### E. Documentation

- [ ] Update docs to reflect the new, simpler tool management approach

---

## 3. Clean Up and Test

- [ ] Remove any remaining references to in-memory tool management
- [ ] Test tool listing, adding/removing tools, and authorization for multiple users/sessions
- [ ] Ensure no user can see or use tools not in their `usedTools` list or not authorized for their roles

---

## 4. Optional: Remove/Refactor ToolAuthorization

- [ ] If all authorization is handled in the DB query, consider simplifying or removing `ToolAuthorization`

---

## Summary Table

| Step                          | File(s) / Class(es) / Methods(s)                  | Action                 |
| ----------------------------- | ------------------------------------------------- | ---------------------- |
| [x] Remove ToolRegistry       | ToolRegistry.ts, ToolGenerator.ts, index.ts       | Delete/Remove          |
| [x] Remove SessionToolManager | SessionToolManager.ts, ToolGenerator.ts, index.ts | Delete/Remove          |
| [x] Refactor ToolGenerator    | ToolGenerator.ts                                  | Remove in-memory logic |
| [ ] Update Tests              | **tests** dirs                                    | Remove/refactor        |
| [x] Add getUserTools          | UserRepository.ts                                 | Implement              |
| [x] Update List Handler       | ToolGenerator.ts                                  | Use getUserTools       |
| [ ] Clean Up                  | All                                               | Remove old refs        |

---

**Next step: Implement handler execution logic in ToolGenerator for executing tool calls.**
