# Dynamic MCP Server Tools

The Dynamic MCP Server is a flexible, extensible backend for MCP clients (like Cursor or Claude). It provides a powerful tool system for managing users, tools, and access control, supporting both administrative and end-user workflows.

---

## What is the Dynamic MCP Server Framework?

Dynamic MCP Server is not just a standalone server—it is a framework that other MCP servers can be built on. It provides:

- **Dynamic tool management:** The ability to create, update, and remove tools at runtime, not just at startup.
- **User management:** Built-in user authentication, authorization, and sharing models.

Other MCP servers (like the DLX MCP Server) can extend this framework to add their own domain-specific tools and integrations, while inheriting all the dynamic and user management features.

---

## About the Tool System

Dynamic MCP Server tools allow you to:

- Manage users and roles
- Share, hide, or unhide tools
- List, update, or delete tools
- Reset your API key

Tools are grouped by access level:

- **Administrative Tools**: For server administrators
- **User Tools**: For all users, with some tools available to power-users and admins only

---

## Tool Groups

- [Administrative Tools](Dynamic_MCP_Server_Administrative_Tools.md)
- [User Tools](Dynamic_MCP_Server_User_Tools.md)

See each page for a full list and details on how to use each tool.
