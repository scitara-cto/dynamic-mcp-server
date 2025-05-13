# Unit Testing Plan for dynamic-mcp-server

## Progress Tracking

- [x] Jest test framework set up
- [x] Initial server tests in place (see `src/mcp/__tests__/server.test.ts`)
- [x] ToolRepository tests
- [x] UserRepository tests
- [x] ToolGenerator tests
- [x] UserManagementHandler tests (see `src/handlers/userManagementHandler/__tests__/index.test.ts`)
- [x] ToolManagementHandler tests
- [x] Session-based tool loading tests
- [x] Utility function tests
- [x] Server bootstrapping & maintenance tests (see `src/mcp/__tests__/server.test.ts`)
- [ ] Code coverage reporting
- [ ] CI integration for tests
- [ ] Documentation & extensibility tests

---

## 1. Testing Framework Recommendation

- [x] **Jest** is recommended for TypeScript Node projects and is likely compatible with your setup.
- [x] If not already present, add:
  ```bash
  npm install --save-dev jest ts-jest @types/jest
  ```

---

## 2. Key Areas to Test

### A. Core Logic

- [x] **ToolRepository**: CRUD, upsert, sync, stale tool removal
- [x] **UserRepository**: CRUD, admin bootstrapping, tool sharing
- [x] **ToolGenerator**: Tool registration, handler factories, session tool sets
- [x] **SessionToolManager**: Per-session tool loading, isolation, cleanup
- [x] **Handlers**: User and tool management, error handling, action dispatch
- [x] **Utilities**: Logger, config, etc.
- [x] **Server Bootstrapping & Maintenance**: Built-in tool sync, user tool cleanup (see `src/services/toolSync.ts`)

### B. Integration

- [x] Session-based tool loading and authorization
- [x] Tool sharing and real-time updates
- [x] Admin user creation and access

### C. Extensibility & Developer Experience

- [ ] HTTP server/Express extensibility (custom route registration)
- [ ] Downstream project integration (examples)
- [ ] Documentation and code samples

---

## 3. Suggested Test Structure

```
src/
  db/
    repositories/
      __tests__/
        ToolRepository.test.ts
        UserRepository.test.ts
  handlers/
    userManagementHandler/
      __tests__/
        index.test.ts
    toolManagementHandler/
      __tests__/
        index.test.ts
  mcp/
    toolGenerator/
      __tests__/
        ToolGenerator.test.ts
    __tests__/
      server.test.ts
  utils/
    __tests__/
      logger.test.ts
```

---

## 4. Example Test Cases

### ToolRepository.test.ts

- [x] Should create, find, update, and delete a tool.
- [x] Should upsert tools and not duplicate.
- [x] Should remove stale built-in tools.

### UserRepository.test.ts

- [x] Should create, find, update, and delete a user.
- [x] Should update allowedTools/sharedTools correctly.
- [x] Should check tool access for allowed and shared tools.
- [x] Should bootstrap admin user if not present.

### UserManagementHandler.test.ts

- [ ] Should add, update, delete, and list users.
- [ ] Should share and unshare tools.
- [ ] Should handle errors (e.g., missing email).

### ToolManagementHandler.test.ts

- [ ] Should add, delete, and list tools.
- [ ] Should handle errors (e.g., missing tool name).

### ToolGenerator.test.ts

- [ ] Should publish and add tools.
- [ ] Should wrap handlers and format output.
- [ ] Should not register duplicate tools.

### server.test.ts

- [ ] Should sync built-in tools and remove stale ones.
- [ ] Should clean up user tool references after tool removal.

---

## 5. Mocking and Isolation

- [x] **Mock MongoDB**: Use an in-memory MongoDB instance (e.g., `mongodb-memory-server`) for repository tests.
- [ ] **Mock Handlers**: Use simple handler functions for handler tests.
- [ ] **Mock Auth**: For server tests, mock out OAuth and token validation.

---

## 6. Test Coverage Goals

- [ ] **Repositories**: 90%+ (CRUD, edge cases, error handling)
- [ ] **Handlers**: 80%+ (all actions, error paths)
- [ ] **Server Bootstrapping**: 80%+ (sync, cleanup, startup logic)
- [ ] **Utilities**: 90%+

---

## 7. Notes

- **Maintenance logic** (tool sync, user tool cleanup) is now in a dedicated service module (`src/services/toolSync.ts`), not in the server class. Tests cover both the service and its integration in server startup.
- **ESM/TypeScript**: All imports use `.js` extensions for ESM compatibility; tests and build scripts are updated accordingly.
- **All core and maintenance tests are green.**

---

## 8. Next Steps

- [ ] Add/verify code coverage reporting
- [ ] Expand documentation and extensibility tests

All handler, repository, and generator tests are now passing. Next: session-based tool loading tests.
