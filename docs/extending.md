# Extending the Server

## Adding Custom HTTP Routes

Custom HTTP routes can be added to the server by defining them in a `HandlerPackage`. The `authRoutes` property should be an array of `AuthRoute` objects, each with a `path`, `method`, and `handler` function.

```typescript
import { HandlerPackage } from "dynamic-mcp-server";

const myHandlerPackage: HandlerPackage = {
  name: "my-handler",
  tools: [],
  handler: async () => {},
  authRoutes: [
    {
      path: "/custom-endpoint",
      method: "get",
      handler: (req, res) => {
        // Handle the request
        res.send("Custom endpoint handled!");
      },
    },
  ],
};
```

## Initialization Logic

If a handler requires some initialization logic to be run when it is registered, you can provide an `init` method in the `HandlerPackage`.

```typescript
import { HandlerPackage } from "dynamic-mcp-server";

const myHandlerPackage: HandlerPackage = {
  name: "my-handler",
  tools: [],
  handler: async () => {},
  init: async () => {
    // Perform initialization logic here
    console.log("Initializing my-handler");
  },
};
```

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
