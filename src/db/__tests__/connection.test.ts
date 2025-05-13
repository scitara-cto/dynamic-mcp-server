import { jest } from "@jest/globals";

// Helper to mock logger methods after import
function mockLogger(logger) {
  logger.info = jest.fn();
  logger.error = jest.fn();
}

describe("connectToDatabase", () => {
  let connectToDatabase, disconnectFromDatabase, logger, mongoose;

  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("mongoose", () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }));
    jest.doMock("../../utils/logger.js", () => ({
      __esModule: true,
      default: { info: jest.fn(), error: jest.fn() },
    }));
    ({ connectToDatabase, disconnectFromDatabase } = await import(
      "../connection.js"
    ));
    logger = (await import("../../utils/logger.js")).default;
    logger.info = jest.fn();
    logger.error = jest.fn();
    mongoose = await import("mongoose");
  });

  it("connects to MongoDB if not already connected", async () => {
    (mongoose.connect as jest.Mock).mockResolvedValue(undefined);
    await connectToDatabase();
    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB,
    });
    expect(logger.info).toHaveBeenCalledWith("Connected to MongoDB");
  });

  it("does not connect if already connected", async () => {
    (mongoose.connect as jest.Mock).mockResolvedValue(undefined);
    await connectToDatabase(); // first call
    (mongoose.connect as jest.Mock).mockClear();
    await connectToDatabase(); // second call
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  it("throws and logs error if MONGODB_URI is missing", async () => {
    delete process.env.MONGODB_URI;
    await expect(connectToDatabase()).rejects.toThrow(
      /MONGODB_URI environment variable is not set/,
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Error connecting to MongoDB:",
      expect.objectContaining({
        message: expect.stringContaining(
          "MONGODB_URI environment variable is not set",
        ),
      }),
    );
  });

  it("logs and rethrows error if mongoose.connect fails", async () => {
    process.env.MONGODB_URI = "mongodb://localhost:27017/test-db";
    (mongoose.connect as jest.Mock).mockRejectedValue(new Error("fail"));
    await expect(connectToDatabase()).rejects.toThrow("fail");
    expect(logger.error).toHaveBeenCalledWith(
      "Error connecting to MongoDB:",
      expect.any(Error),
    );
  });
});

describe("disconnectFromDatabase", () => {
  let connectToDatabase, disconnectFromDatabase, logger, mongoose;

  beforeEach(async () => {
    jest.resetModules();
    jest.doMock("mongoose", () => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    }));
    jest.doMock("../../utils/logger.js", () => ({
      __esModule: true,
      default: { info: jest.fn(), error: jest.fn() },
    }));
    ({ connectToDatabase, disconnectFromDatabase } = await import(
      "../connection.js"
    ));
    logger = (await import("../../utils/logger.js")).default;
    logger.info = jest.fn();
    logger.error = jest.fn();
    mongoose = await import("mongoose");
  });

  it("disconnects if connected", async () => {
    (mongoose.connect as jest.Mock).mockResolvedValue(undefined);
    (mongoose.disconnect as jest.Mock).mockResolvedValue(undefined);
    await connectToDatabase();
    await disconnectFromDatabase();
    expect(mongoose.disconnect).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("Disconnected from MongoDB");
  });

  it("does nothing if not connected", async () => {
    await disconnectFromDatabase();
    expect(mongoose.disconnect).not.toHaveBeenCalled();
  });

  it("logs and rethrows error if disconnect fails", async () => {
    (mongoose.connect as jest.Mock).mockResolvedValue(undefined);
    (mongoose.disconnect as jest.Mock).mockRejectedValue(new Error("fail"));
    await connectToDatabase();
    await expect(disconnectFromDatabase()).rejects.toThrow("fail");
    expect(logger.error).toHaveBeenCalledWith(
      "Error disconnecting from MongoDB:",
      expect.any(Error),
    );
  });
});
