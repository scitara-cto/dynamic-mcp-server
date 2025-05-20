# Tool Visibility Refactor Implementation Plan

## 1. Rename `usedTools` to `hiddenTools` in the User Model

- [ ] Update the `IUser` interface and Mongoose schema
- [ ] Update all code references from `usedTools` to `hiddenTools`
- [ ] Update test data, seeders, and fixtures

## 2. Remove `alwaysUsed` from the Tool Model

- [ ] Remove `alwaysUsed` from the `ITool` interface and Mongoose schema
- [ ] Remove all code references to `alwaysUsed`
- [ ] Remove logic that checks or sets `alwaysUsed`

## 3. Change Tool Visibility Logic

- [ ] Update logic so all tools are visible to users by default
- [ ] Hide tools only if their ID is present in the user's `hiddenTools` array
- [ ] Remove logic that restricts visibility to only `alwaysUsed` or `usedTools`

## 4. Replace `update-usedTools` Tool with `hideTool` and `unHideTool` Tools

- [ ] Remove the `update-usedTools` tool definition from `userManagementTools`
- [ ] Add `hideTool` (adds tool ID to user's `hiddenTools` array)
- [ ] Add `unHideTool` (removes tool ID from user's `hiddenTools` array)
- [ ] Update handler logic to support these new actions

## 5. Update All References and Handlers

- [ ] Update all code that references `usedTools` or `alwaysUsed` (handlers, services, tests)
- [ ] Update UI or API documentation referencing tool visibility, `usedTools`, or `alwaysUsed`

## 6. Migration

- [ ] Write a migration script to rename `usedTools` to `hiddenTools` in the database
- [ ] Remove the `alwaysUsed` field from all tool documents

## 7. Testing

- [ ] Update/add tests for new tool visibility logic
- [ ] Ensure all users see all tools by default except those in their `hiddenTools` array
