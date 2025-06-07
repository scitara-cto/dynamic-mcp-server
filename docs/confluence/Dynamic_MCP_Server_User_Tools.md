# Dynamic MCP Server User Tools

These tools are available to all users, with some requiring power-user or admin roles. They allow you to manage your account, view users and tools, and share or hide tools.

---

## User Tools

### List Users (`list-users`)

- **Description:** List all users in the system.
- **How to use:**
  - Just ask to see all users, or filter by name if you know part of the user's name.
  - **Example:** "Show me all users named Alice."

### User Info (`user-info`)

- **Description:** Retrieve information about a user. If email is omitted, returns info for the current user.
- **How to use:**
  - You can ask for your own info, or specify a user's email (or name, and the agent will look it up).
  - **Example:** "Show me info for Bob Smith."

### Hide Tool (`hide-tool`)

- **Description:** Hide one or more tools from your view.
- **How to use:**
  - Just say which tool(s) you want to hide by name. The agent will use list-tools to find the correct tool ID.
  - **Example:** "Hide the 'delete-user' tool."

### Unhide Tool (`unhide-tool`)

- **Description:** Unhide one or more tools for your account.
- **How to use:**
  - Say which tool(s) you want to unhide by name. The agent will look up the correct tool ID.
  - **Example:** "Unhide the 'add-user' tool."

### Reset API Key (`reset-api-key`)

- **Description:** Reset your API key (or another user's, if admin).
- **How to use:**
  - Ask to reset your API key, or (if admin) specify a user's email. The agent will confirm before proceeding.
  - **Example:** "Reset my API key."

### List Tools (`list-tools`)

- **Description:** List all tools available in the system.
- **How to use:**
  - Just ask to see all tools, or filter by name.
  - **Example:** "Show me all tools related to user management."

### Share Tool (`share-tool`)

- **Description:** Share a tool with another user (adds to their shared tools).
- **How to use:**
  - Say which tool you want to share and with whom (by name or email). The agent will look up the correct tool and user.
  - **Example:** "Share the 'list-users' tool with Alice."
  - **Note:** Requires power-user or admin role.

### Unshare Tool (`unshare-tool`)

- **Description:** Unshare a tool from a user (removes from their shared tools).
- **How to use:**
  - Say which tool you want to unshare and from whom. The agent will look up the correct tool and user.
  - **Example:** "Unshare the 'delete-tool' tool from Bob."
  - **Note:** Requires power-user or admin role.

### Delete Tool (`delete-tool`)

- **Description:** Delete a tool from the system.
- **How to use:**
  - Specify the tool by name. The agent will look up the correct tool ID.
  - **Example:** "Delete the 'old-report' tool."
  - **Note:** Requires power-user or admin role.

### Update Tool (`update-tool`)

- **Description:** Update an existing tool's definition or properties.
- **How to use:**
  - Specify the tool by name and what you want to update. The agent will look up the correct tool ID.
  - **Example:** "Update the description for the 'list-users' tool."
  - **Note:** Requires power-user or admin role.

---

For admin-only tools, see the [Administrative Tools](Dynamic_MCP_Server_Administrative_Tools.md) page.
