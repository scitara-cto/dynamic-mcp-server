import winston from "winston";
import { config } from "../config/index.js";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

// Add colors to Winston
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    let output = `${info.timestamp} ${info.level}: ${info.message}`;

    if (info.args) {
      output += ` ${JSON.stringify(info.args)}`;
    }
    if (info.error) {
      output += ` error: ${JSON.stringify(info.error)}`;
    }

    return output;
  }),
);

// Define which transports to use based on environment
const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console(),
];

// Add file transport for errors in production
if (process.env.NODE_ENV === "production") {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/all.log" }),
  );
}

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level, // Use the log level from config
  levels,
  format,
  transports,
});

export default logger;
