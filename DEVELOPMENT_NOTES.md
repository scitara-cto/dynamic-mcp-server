# Development Notes

This file contains important patterns, decisions, and best practices that should be consistently followed in this codebase.

## Testing Patterns

### Service Mocking

When mocking services in tests, always use `jest.spyOn()` instead of `jest.mock()`. This pattern:

- Preserves TypeScript type checking
- Works better with ES modules
- Is consistent with existing test patterns
- Avoids module resolution issues with Jest's ES module support

✅ Correct Pattern:

```typescript
// Mock the service with proper types
const mockServiceMethod =
  jest.fn<(params: ParamType) => Promise<ResponseType>>();
jest.spyOn(service, "methodName").mockImplementation(mockServiceMethod);

// Usage in test
mockServiceMethod.mockResolvedValue(mockResult);
// or
mockServiceMethod.mockRejectedValue(new Error("error message"));
```

❌ Avoid this Pattern:

```typescript
jest.mock("path/to/service");
(service.methodName as jest.Mock).mockImplementation(...);
```

