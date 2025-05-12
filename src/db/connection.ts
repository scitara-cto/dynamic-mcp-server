import mongoose from "mongoose";
import logger from "../utils/logger.js";

let isConnected = false;

export async function connectToDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error(
        "[CONFIG ERROR] MongoDB connection failed: MONGODB_URI environment variable is not set.\n" +
          "Please set MONGODB_URI in your environment or .env file.\n" +
          "Example: MONGODB_URI=mongodb://localhost:27017/dynamic-mcp\n" +
          "The server cannot start without a MongoDB connection.",
      );
    }

    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB || "dynamic-mcp-server",
    });

    isConnected = true;
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("Disconnected from MongoDB");
  } catch (error) {
    logger.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
}

// Handle application shutdown
type ShutdownHandler = () => Promise<void>;
const shutdown: ShutdownHandler = async () => {
  await disconnectFromDatabase();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
