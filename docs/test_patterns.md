# Test Patterns and Mocking Strategies

This document describes the recommended patterns and libraries for writing robust, reliable tests in this project, with a focus on mocking, dependency injection, and handling ESM/TypeScript quirks.

---

## 1. **General Testing Approach**

- **Test runner:** [Jest](https://jestjs.io/) (with ESM and TypeScript support)
- **Test style:** Use `@jest/globals` for all Jest globals (e.g., `import { jest } from "@jest/globals";`).
- **Test location:** Place test files alongside or in `__tests__` directories near the code under test.

---

## 2. **Mocking Patterns**

### **A. Pure Functions and Stateless Modules**

- Use `jest.doMock` before dynamic `import()` of the module under test.
- After import, forcibly override any methods (e.g., `logger.debug = jest.fn()`) to guarantee they are Jest spies.
- Example:
  ```js
  jest.doMock("../../utils/logger.js", () => ({
    default: { debug: jest.fn() },
  }));
  const { myFunction } = await import("../my-module.js");
  const logger = (await import("../../utils/logger.js")).default;
  logger.debug = jest.fn();
  ```

### **B. Classes That Read Config/Logger at Construction**

- **Preferred pattern:** Refactor the class to accept `config` and `logger` as constructor arguments (dependency injection), defaulting to the real modules.
- In tests, pass mocks directly:
  ```js
  const config = { ... };
  const logger = { info: jest.fn(), error: jest.fn(), ... };
  new MyServer(config, logger);
  ```
- **Why:** ESM module caching makes it impossible to reliably mock config/logger with `jest.doMock` if the class or its dependencies are imported before the mock.

### **C. MongoDB Integration**

- Use [mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server) for integration tests that require a real MongoDB instance.
- Start/stop the in-memory server in `beforeAll`/`afterAll`, and clear collections in `beforeEach`.
- Example:
  ```js
  import { MongoMemoryServer } from "mongodb-memory-server";
  let mongoServer;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), ...);
  });
  afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
  beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });
  ```

### **D. Repository/Class Method Mocking (Recommended for Most Tests)**

- For most repository and service classes, mock methods using `jest.spyOn` on the class prototype.
- This pattern works for both ESM and CJS, and is the most common in this codebase.
- Example:

  ```js
  import { ToolRepository } from "../repositories/ToolRepository.js";
  import { syncBuiltinTools } from "../toolSync.js";
  import { jest } from "@jest/globals";

  it("mocks repository methods", async () => {
    const upsertMany = jest
      .spyOn(ToolRepository.prototype, "upsertMany")
      .mockResolvedValue(undefined);
    const list = jest
      .spyOn(ToolRepository.prototype, "list")
      .mockResolvedValue([
        /* ...mock tools... */
      ]);
    // ... your test ...
  });
  ```

- **Note:** This pattern requires that you import the repository and code under test at the top of the file.

### **Note on Running Tests in ESM/TypeScript Projects**

For ESM/TypeScript projects like this one, always run tests using `npm test` or `npm run test` (which uses `node --experimental-vm-modules ...`) for ESM import support. Running `npx jest` directly will not work for ESM/TS tests in this setup. To run a single test file, use:

```
npm test -- path/to/file.test.ts
```

This ensures the correct Node flags are used and all tests will run as expected.

---

## 3. **Common Pitfalls and Solutions**

### **A. ESM Module Caching**

- **Problem:** `jest.doMock` only works if the module under test (and its dependencies) have not been imported anywhere before the mock is set up.
- **Solution:**
  - Use only dynamic imports (`await import(...)`) after all mocks are set up.
  - For classes that read config/logger at construction, use dependency injection.

### **B. Logger/Config Not Being Mocked**

- **Problem:** Logger or config is not a Jest spy, causing `expect(...).toHaveBeenCalledWith(...)` to fail.
- **Solution:**
  - After import, forcibly override methods: `logger.info = jest.fn(); logger.error = jest.fn(); ...`
  - Or, inject mocks via constructor.

### **C. Async Test Patterns**

- Use `async`/`await` for all tests that involve dynamic imports or async setup.
- For `jest.isolateModulesAsync`, always `await` it and mark the test as `async`.

### **D. Express App Mocking**

- Mock the express app with all required methods (`use`, `get`, `post`, `listen`, etc.) as `jest.fn()`.
- If the code uses `express.json`, mock it as well:
  ```js
  jest.doMock("express", () => {
    const express = jest.fn(() => appMock);
    express.json = jest.fn(() => (req, res, next) => next());
    return express;
  });
  ```

---

## 4. **Watchouts and Best Practices**

- **Never import the module under test (or its dependencies) at the top of the test file** if you plan to mock them.
- **Reset modules and clear mocks in `beforeEach`:**
  ```js
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });
  ```
- **Prefer dependency injection for config/logger** in new code.
- **For integration tests, use real DBs (mongodb-memory-server) and avoid mocking models.**
- **If you see a Jest error about a mock not being a spy, forcibly override the method after import.**
- **If you see a Jest module resolution error, check your import paths and avoid unnecessary `jest.doMock` for modules you don't use directly.**

---

## 5. **Example: Robust Test for a Server Class**

```js
import { jest } from "@jest/globals";
describe("MyServer", () => {
  let config, logger, appMock;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    config = { server: { port: 1234 } };
    logger = { info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    appMock = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      listen: jest.fn((port, cb) => cb && cb()),
    };
    jest.doMock("express", () => jest.fn(() => appMock));
  });
  it("starts the server and logs info", async () => {
    const { MyServer } = await import("../my-server.js");
    new MyServer(config, logger).start();
    expect(appMock.listen).toHaveBeenCalledWith(1234, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith("Server started on port 1234");
  });
});
```

---

## 6. **Further Reading**

- [Jest ESM docs](https://jestjs.io/docs/ecmascript-modules)
- [mongodb-memory-server docs](https://github.com/nodkz/mongodb-memory-server)
- [Jest manual mocks](https://jestjs.io/docs/manual-mocks)
