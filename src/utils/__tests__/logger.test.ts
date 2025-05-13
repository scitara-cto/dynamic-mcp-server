import logger from "../logger.js";
import winston from "winston";
import { config } from "../../config/index.js";
import { Writable } from "stream";

describe("logger utility", () => {
  let logs: string[];
  let transport: winston.transport;
  beforeEach(() => {
    logs = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        logs.push(chunk.toString());
        callback();
      },
    });
    transport = new winston.transports.Stream({ stream: writable });
    logger.add(transport);
  });
  afterEach(() => {
    logger.remove(transport);
  });

  it("logs at different levels", () => {
    const originalLevel = logger.level;
    logger.level = "debug";
    logger.error("error message");
    logger.warn("warn message");
    logger.info("info message");
    logger.http("http message");
    logger.debug("debug message");
    logger.level = originalLevel;
    expect(logs.join(" ")).toMatch(/error message/);
    expect(logs.join(" ")).toMatch(/warn message/);
    expect(logs.join(" ")).toMatch(/info message/);
    expect(logs.join(" ")).toMatch(/http message/);
    expect(logs.join(" ")).toMatch(/debug message/);
  });

  it("includes timestamp and level in output", () => {
    logger.info("timestamp test");
    const log = logs.find((l) => l.includes("timestamp test"));
    expect(log).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{2,3}/); // timestamp (2 or 3 digits)
    expect(log).toMatch(/info/); // level
  });

  it("handles args and error fields", () => {
    logger.info("msg", { args: { foo: 1 }, error: new Error("fail") });
    const log = logs.find((l) => l.includes("msg"));
    expect(log).toMatch(/foo/);
    expect(log).toMatch(/error: {}/);
  });

  it("respects config.logging.level", () => {
    expect(logger.level).toBe(config.logging.level);
  });
});
