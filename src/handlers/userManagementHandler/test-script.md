# User Management Handler Test Script

**Instructions for MCP Client/Agent:**

This script contains a set of step-by-step instructions to test the user management tools. As an MCP client or agent, you should execute each test step in order, autonomously, using the available tools. **Execute each step only once, in sequence. Do not repeat any step unless explicitly instructed. After the final summary, stop execution and do not restart or loop through the steps.** After each step, examine the tool response to determine correctness. At the end, provide a summary of the results, including any anomalies or unexpected outcomes.

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

**Tools to test:**

- list-users
- add-user
- update-user
- delete-user
- update-usedTools
- remove-user

## Test Flow

- If the current user is an **admin**, run both the Admin-Level Tests and the User-Level Tests.
- If the current user is a **power-user** or **regular user**, run only the User-Level Tests.

## Admin-Level Tests (admin only)

1. **Add User**

   - Execute the `add-user` tool with a new, unique email (e.g., `test.user+<timestamp>@example.com`), a name (e.g., "Test User"), and a role (e.g., `user`).
   - Check the response:
     - Confirm the user was created.
     - Confirm the returned email and name match the input.
   - **If the user does not appear in the user list or cannot be used immediately, pause and prompt the user to refresh or reconnect the MCP client before proceeding.**

2. **Update User**

   - Execute the `update-user` tool for the user just created.
   - Change the user's name (e.g., to "Updated Test User").
   - Check the response:
     - Confirm the user's name was updated.
     - Confirm the email remains unchanged.
   - **If the update is not reflected, prompt the user to refresh the MCP client.**

3. **User Info (Other User)**

   - Execute the `user-info` tool with the test user's email.
   - Check the response:
     - As admin, confirm full user info is returned.
   - **If the info is not updated, prompt the user to refresh the MCP client.**

4. **Delete User**

   - Execute the `delete-user` tool for the user just created/updated.
   - Check the response:
     - Confirm the user was deleted.
     - Confirm the response indicates success.
   - **If the user still appears in the user list, prompt the user to refresh the MCP client.**

5. **Remove User (Irreversible)**

   - Execute the `add-user` tool again to create a new user (e.g., `test.remove+<timestamp>@example.com`).
   - Execute the `remove-user` tool for this user.
   - Check the response:
     - Confirm the user was removed.
     - Confirm the response indicates success and that the user cannot be found in subsequent `user-info` calls.
   - **If the user still appears in the user list, prompt the user to refresh the MCP client.**

## User-Level Tests (all users)

1. **User Info (Self)**

   - Execute the `user-info` tool with no email argument.
   - Check the response:
     - Confirm the returned info matches the current user.

2. **User Info (Other User)**

   - Execute the `user-info` tool with another user's email (e.g., an admin or test user).
   - Check the response:
     - If not admin, confirm only existence and name are returned (no sensitive info).

3. **Update Used Tools**

   - Execute the `update-usedTools` tool to add a tool (e.g., `list-users`) to the user's used tools.
   - Check the response:
     - Confirm the tool was added to the user's used tools.
   - Then, execute the `update-usedTools` tool to remove the tool from the user's used tools.
   - Check the response:
     - Confirm the tool was removed from the user's used tools.
   - Attempt to execute the removed tool (e.g., `list-users`).
     - Confirm that an error is returned indicating the tool is not available or not authorized. This is the expected behavior.
   - **If the tool list does not update as expected, prompt the user to refresh the MCP client.**

## After Each Step

- Examine the tool response.
- Determine if the tool executed correctly (e.g., correct status, expected data).
- Note any errors, unexpected results, or anomalies.
- **If a tool list change was made and the expected change is not reflected, prompt the user to refresh the MCP client before proceeding.**

## Final Summary

- Provide a summary of each tool execution:
  - Success or failure.
  - Any anomalies or unexpected results.
- Confirm that the user management tools work as expected end-to-end.
- **Explicitly state whether the MCP client conforms to the tool list refresh requirement. If not, recommend reconnecting or resetting the client after tool list changes.**

**Post-Script Instructions:**

- Use the `update-usedTools` tool to restore the user's used tools to their pre-test state (remove any test tools added, re-add any that were removed).
- Ensure all test users created during the test are deleted/removed.
- Optionally, execute `list-tools` to confirm the tool list matches the pre-test state.
