# Extending the Server

## Adding Custom HTTP Routes

To add a custom route (e.g., for OAuth callbacks), use the provided API. **Do not include the `/custom` prefix in your route path; it will be automatically prepended.**

```typescript
import { DynamicMcpServer, addAuthHttpRoute } from "dynamic-mcp-server";

addAuthHttpRoute(mcpServer, "get", "/custom-callback", (req, res) => {
  // Handle the callback
  res.send("Custom callback handled!");
});
```

This ensures you do not overwrite core routes and provides a safe extension point.

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
