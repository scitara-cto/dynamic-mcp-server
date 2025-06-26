import { jest } from "@jest/globals";
import { UserRepository } from "../UserRepository.js";
import { User } from "../../models/User.js";

// Mock the User model
jest.mock("../../models/User.js");

describe("UserRepository.removeToolFromHiddenToolsForAuthorizedUsers", () => {
  let userRepository: UserRepository;
  let mockUpdateMany: jest.Mock;

  beforeEach(() => {
    userRepository = new UserRepository();
    mockUpdateMany = jest.fn();
    (User.updateMany as jest.Mock) = mockUpdateMany;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should remove tool from hiddenTools arrays of users who had access", async () => {
    const toolName = "test-tool";
    const toolCreator = "creator@example.com";
    const rolesPermitted = ["admin", "user"];
    const namespacedName = `${toolCreator}:${toolName}`;
    
    await userRepository.removeToolFromHiddenToolsForAuthorizedUsers(
      toolName,
      toolCreator,
      rolesPermitted
    );

    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        $and: [
          {
            $or: [
              { email: toolCreator },
              { "sharedTools.toolId": toolName },
              { roles: { $in: rolesPermitted } }
            ]
          },
          { hiddenTools: namespacedName }
        ]
      },
      { $pull: { hiddenTools: namespacedName } }
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("should handle tool without role permissions", async () => {
    const toolName = "test-tool";
    const toolCreator = "creator@example.com";
    const namespacedName = `${toolCreator}:${toolName}`;
    
    await userRepository.removeToolFromHiddenToolsForAuthorizedUsers(
      toolName,
      toolCreator
    );

    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        $and: [
          {
            $or: [
              { email: toolCreator },
              { "sharedTools.toolId": toolName }
            ]
          },
          { hiddenTools: namespacedName }
        ]
      },
      { $pull: { hiddenTools: namespacedName } }
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("should handle tool with empty roles array", async () => {
    const toolName = "test-tool";
    const toolCreator = "creator@example.com";
    const rolesPermitted: string[] = [];
    const namespacedName = `${toolCreator}:${toolName}`;
    
    await userRepository.removeToolFromHiddenToolsForAuthorizedUsers(
      toolName,
      toolCreator,
      rolesPermitted
    );

    expect(mockUpdateMany).toHaveBeenCalledWith(
      {
        $and: [
          {
            $or: [
              { email: toolCreator },
              { "sharedTools.toolId": toolName }
            ]
          },
          { hiddenTools: namespacedName }
        ]
      },
      { $pull: { hiddenTools: namespacedName } }
    );
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
  });
});