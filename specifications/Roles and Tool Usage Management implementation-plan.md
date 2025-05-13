# Implementation Plan: Roles and Tool Usage Management

**Status: Migration Complete**

_All code and tests have been fully migrated to the new RBAC and tool usage model. All references to `allowedTools` are removed. Tests now cover role-based access, sharing, and user tool selection. Further iteration and review can be performed as needed._

## Overview

This plan describes how to implement hard-coded roles and a robust tool usage system for the MCP server. The goal is to:

- Define three hard-coded roles: `admin`, `power-user`, and `user`.
- Control tool access based on these roles.
- Allow users to select which tools they want to "use" from those available to them.

---

## Checklist

### 1. Define Roles

- [x] Create a constant or enum in the codebase for the three roles:
  - [x] `admin`: Can create/modify users, and do everything a power user or user can do.
  - [x] `power-user`: Can create/share tools, and use tools available to power users and users.
  - [x] `user`: Can use tools marked as available to this role, or tools shared with them.
- [x] Example:
  ```typescript
  export const ROLES = {
    ADMIN: "admin",
    POWER_USER: "power-user",
    USER: "user",
  };
  ```

---

### 2. Add `rolesPermitted` to Tool Definitions

- [x] Update all tool definitions to include a `rolesPermitted` array, e.g.:
  - [x] `rolesPermitted: ["admin"]`
  - [x] `rolesPermitted: ["power-user", "admin"]`
  - [x] `rolesPermitted: ["user", "power-user", "admin"]`
- [x] Ensure this determines which roles can access each tool by default.

---

### 3. Update User Model

- [x] Ensure each user has a `roles` array (already present).
- [x] Add a `usedTools` (or `toolsInUse`) array to the user model to track which tools the user has chosen to "activate" from their allowed set.

---

### 4. Refactor Access Logic

- [x] MongoDB is the source of truth for all tools (built-in and user-created).
- [x] Add a function to `ToolRepository` that returns all tools available to a user, considering:
  - [x] Tools where `creator` is "system" (built-in) or the user's email (user-created).
  - [x] Tools where the user's roles intersect with `rolesPermitted`.
  - [x] Tools that are in the user's `sharedTools` array.
- [x] Refactor all code that uses `allowedTools` to instead:
  - [x] Use the user's roles and the tool's `rolesPermitted` for role-based access.
  - [x] Use `sharedTools` for tools shared with the user.
  - [x] Use `usedTools` for tools the user has chosen to activate.
- [x] Update or remove any tests that reference `allowedTools`.
- [x] Remove the `allowedTools` field from the user model and schema.

---

### 5. Tool Filtering Logic

- [x] When listing tools for a user:
  - [x] Compute "available tools" by filtering the master tool list for tools where the user's roles intersect with the tool's `rolesPermitted`, or the tool is shared/created by the user, or is a system tool.
  - [x] For each tool, indicate:
    - [x] `available`: Whether the user can use the tool (based on roles or sharing).
    - [x] `inUse`: Whether the tool is in the user's `usedTools` array.
- [x] For admin/power-user UIs, optionally show all tools, but indicate which are accessible.

---

### 6. Sharing Logic

- [x] Allow any tool to be shared with a user, regardless of their role.
- [x] Ensure shared tools appear in the user's available tools, even if their role would not normally allow it.

---

### 7. Update Documentation

- [x] Document the three roles and their permissions.
- [x] Document the new tool selection and sharing logic.
- [x] Update user and tool model documentation to reflect these changes.
- [x] Update API reference to describe available/inUse flags and new access model.

---

### 8. User-Facing Tool for Selecting "Used" Tools

- [x] Implement a tool (e.g., `use-tools`) that allows a user to choose which of their available tools they want to "use" (i.e., add to their `usedTools` array).
- [x] This tool:
  - [x] Lists all available tools for the user.
  - [x] Allows the user to select one or more tools to add to their `usedTools`.
  - [x] Updates the user's `usedTools` array accordingly.

---

### 9. Migration

- [x] If `allowedTools` is currently stored on the user, migrate to the new model (computed from roles and sharing).
- [x] Ensure backward compatibility or provide a migration script if needed.

---

### 10. Testing

- [x] Add/Update tests to cover:
  - [x] Role-based tool access
  - [x] Sharing logic
  - [x] User selection of "used" tools

---

### 11. Review & Iterate

- [x] Review the implementation with stakeholders.
- [x] Iterate based on feedback and real-world usage.

---

**Note:**

- The codebase and documentation are now up to date with the new roles/tool usage model. Remaining work is focused on additional review and future iteration as needed.
