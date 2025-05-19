# Tool Management Handler Test Script

**Instructions for MCP Client/Agent:**

This script contains a set of step-by-step instructions to test the tool management tools. As an MCP client or agent, you should execute each test step in order, autonomously, using the available tools. **Execute each step only once, in sequence. Do not repeat any step unless explicitly instructed. After the final summary, stop execution and do not restart or loop through the steps.** After each step, examine the tool response to determine correctness. At the end, provide a summary of the results, including any anomalies or unexpected outcomes.

**Important Note on Tool List Updates and Client Refresh Behavior:**
This test now includes an explicit check to determine whether the MCP client properly refreshes its tool list after receiving a 'tool list changed' notification from the server, as required by the MCP specification. If the client does not do this, changes to the user's used tool list may not be reflected until the client is reset or the connection is reopened. The test will detect this and, if necessary, prompt the user to manually refresh or reconnect the client after any tool list change. The test output should inform the user whether the client conforms to this part of the MCP specification. If not, recommend reconnecting or resetting the client after tool list changes to ensure correct behavior. **This has implications for the test: if the client does not auto-refresh, the script will pause and require manual intervention after any tool list change.**

**Pre-Script Instructions:**

- Execute the `list-tools` tool to get the current list of available and in-use tools.
- Use the `update-usedTools` tool to add a tool (e.g., `user-info` if not already present) to the user's used tools.
- Immediately attempt to call the tool you just added (e.g., call `user-info`).
  - **If the call fails** (e.g., tool not found or not usable), this indicates the MCP client is **not auto-refreshing** its tool list after a tool list change notification. In this case, after any tool list change in the test, you must pause and prompt the user to refresh or reconnect the MCP client before proceeding.
  - **If the call succeeds**, the client is properly refreshing the tool list. Continue the test as normal.
- Use the `user-info` tool (with no email) to determine the current user's role (admin, power-user, or user).
- Record the initial state of the user's used tools for restoration after the test.

---

## Test Flow

- If the current user is an **admin** or **power-user**, run both the Admin-Level Tests and the User-Level Tests.
- If the current user is a **regular user**, run only the User-Level Tests.

---

## Admin/Power-User-Level Tests

1. **List Tools**

   - Execute the `list-tools` tool.
   - Record the list of tools and their details.
   - Note the total number of tools before any changes.

2. **Add Tool (Test Add Functionality)**

   - Execute the `add-tool` tool to create a new tool named `list-stuff`.
   - Use the following definition:
     - **name:** `list-stuff`
     - **description:** `Show the user's stuff.`
     - **inputSchema:**
       ```json
       { "type": "object", "properties": {} }
       ```
     - **handler:**
       ```json
       { "type": "tool-management", "config": { "action": "list" } }
       ```
     - **rolesPermitted:** `["user", "power-user", "admin"]`
   - Check the response:
     - Confirm the tool was created.
     - Confirm the returned name and description match the input.
   - **If the tool does not appear in the tool list or cannot be used immediately, pause and prompt the user to refresh or reconnect the MCP client before proceeding.**

3. **List Tools (Verify Addition)**

   - Execute the `list-tools` tool again.
   - Confirm that `list-stuff` appears in the list of available tools.
   - **If not, prompt the user to refresh the MCP client.**

4. **Delete Tool**

   - Execute the `delete-tool` tool for the tool just created (`list-stuff`).
   - Check the response:
     - Confirm the tool was deleted.
     - Confirm the response indicates success.
   - **If the tool still appears in the tool list or cannot be removed, prompt the user to refresh the MCP client.**

5. **List Tools (Verify Deletion)**
   - Execute the `list-tools` tool again.
   - Confirm that `list-stuff` is no longer present in the list.
   - **If not, prompt the user to refresh the MCP client.**

---

## User-Level Tests (all users)

1. **List Tools**
   - Execute the `list-tools` tool.
   - Confirm the user can see the list of available tools.

---

## After Each Step

- Examine the tool response.
- Determine if the tool executed correctly (e.g., correct status, expected data).
- Note any errors, unexpected results, or anomalies.
- **If a tool list change was made and the expected change is not reflected, prompt the user to refresh the MCP client before proceeding.**

## Final Summary

- Provide a summary of each tool execution:
  - Success or failure.
  - Any anomalies or unexpected results.
- Confirm that the tool management tools work as expected end-to-end.
- **Explicitly state whether the MCP client conforms to the tool list refresh requirement. If not, recommend reconnecting or resetting the client after tool list changes.**

**Post-Script Instructions:**

- Use the `delete-tool` tool to remove any test tools created (e.g., `list-stuff`) if they still exist.
- Use the `update-usedTools` tool to restore the user's used tools to their pre-test state (remove any test tools added, re-add any that were removed).
- Optionally, execute `list-tools` to confirm the tool list matches the pre-test state.
