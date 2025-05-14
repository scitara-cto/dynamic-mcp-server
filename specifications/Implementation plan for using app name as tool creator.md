# Implementation Plan: App Name as Tool Creator

This plan describes how to support an `appName` property for the MCP server, so that tools created by downstream applications are clearly attributed and accessible, and access logic is robust and developer-friendly.

---

## Checklist

- [x] **Add `appName` to MCP Server Config**

  - [x] Update `DynamicMcpServer` config to accept an `appName` property.
  - [x] Store `appName` as a public property on the server instance.

- [x] **Default `creator` to `appName` in `addTool`**

  - [x] In `ToolGenerator.addTool`, if `creator` is not provided, use `this.mcpServer.appName`.
  - [x] Update all internal calls to `addTool` to use the new defaulting behavior.

- [~] **Update Access Logic**

  - [x] In `ToolRepository.getAvailableToolsForUser`, treat tools as system/app tools if their `creator` matches any of:
    - [x] "system"
    - [x] The current server's `appName`
  - [x] Pass or make `appName` available to this function as needed.
  - [ ] (Review and test access logic for all cases)

- [ ] **Update Example and Documentation**

  - [ ] Update example server instantiation to use `appName`.
  - [ ] Update tool authoring and main documentation to explain the new convention.

---

Edit and check off items as you complete them. Add notes or sub-tasks as needed.
