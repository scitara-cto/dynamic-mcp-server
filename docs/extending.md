# Extending the Server

## Adding Custom HTTP Routes

To add a custom route to the server, use the exported `addHttpRoute` function:

```typescript
import { DynamicMcpServer, addHttpRoute } from "dynamic-mcp-server";

addHttpRoute(mcpServer, "get", "/custom-endpoint", (req, res) => {
  // Handle the request
  res.send("Custom endpoint handled!");
});
```

This ensures you do not overwrite core routes and provides a safe extension point.

> **Note:** Authentication for all core endpoints is handled via API key as a query parameter. If you add custom endpoints that require authentication, you should manually check the apiKey in your handler.

## Adding MongoDB Collections/Repositories

You can use the exported MongoDB connection to add your own collections and repositories:

```typescript
import { mongoClient } from "dynamic-mcp-server";
const db = mongoClient.db("mydb");
const myCollection = db.collection("custom");
class CustomRepo {
  /* ... */
}
```

## Extending the User or Tool Model

Downstream projects can extend the user or tool model by adding fields to the MongoDB documents or by subclassing the repository classes.

See [User Management](./user-management.md) and [Tool Management](./tool-management.md) for more details.
