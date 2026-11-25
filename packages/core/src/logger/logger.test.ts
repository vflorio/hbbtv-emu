import type * as IO from "fp-ts/IO";
import { describe, expect, it } from "vitest";
import type { ConsoleAdapter, LoggerEntryLevel, LoggerState } from ".";
import { DEFAULT_LOGGER_STATE } from "./constants";
import { Logger } from "./logger";

type Call = { readonly level: LoggerEntryLevel; readonly text: string };

const createRecordingConsole = () => {
  const calls: Call[] = [];
  const record =
    (level: LoggerEntryLevel) =>
    (msg: string, ...args: unknown[]): IO.IO<void> =>
    () => {
      calls.push({ level, text: [msg, ...args].map(String).join(" ") });
    };
  const adapter: ConsoleAdapter = {
    debug: record("debug"),
    info: record("info"),
    warn: record("warning"),
    error: record("error"),
  };
  return { adapter, calls };
};

const onlyLevels = (levels: Partial<LoggerState["enabledLevels"]>): LoggerState => ({
  ...DEFAULT_LOGGER_STATE,
  enabledLevels: { debug: false, info: false, warning: false, error: false, ...levels },
});

describe("Logger", () => {
  it("writes the section and the message to the matching console level", () => {
    const { adapter, calls } = createRecordingConsole();
    const logger = new Logger("Background", DEFAULT_LOGGER_STATE, adapter);

    logger.warn("storage is empty")();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.level).toBe("warning");
    expect(calls[0]?.text).toContain("Background");
    expect(calls[0]?.text).toContain("storage is empty");
  });

  it("is lazy: nothing is written until the IO is run", () => {
    const { adapter, calls } = createRecordingConsole();
    const logger = new Logger("Background", DEFAULT_LOGGER_STATE, adapter);

    const io = logger.info("hello");

    expect(calls).toHaveLength(0);
    io();
    expect(calls).toHaveLength(1);
  });

  it("does not write levels that are disabled in the config", () => {
    const { adapter, calls } = createRecordingConsole();
    const logger = new Logger("Background", onlyLevels({ error: true }), adapter);

    logger.debug("d")();
    logger.info("i")();
    logger.warn("w")();
    logger.error("e")();

    expect(calls.map((c) => c.level)).toEqual(["error"]);
  });

  it("create() nests the subsection under the parent section", () => {
    const { adapter, calls } = createRecordingConsole();
    const logger = new Logger("Background", DEFAULT_LOGGER_STATE, adapter).create("TabsManager");

    logger.info("ready")();

    expect(calls[0]?.text).toContain("Background | TabsManager");
  });

  it("withConfig() overrides single levels and keeps the others", () => {
    const { adapter, calls } = createRecordingConsole();
    const logger = new Logger("Background", DEFAULT_LOGGER_STATE, adapter).withConfig({
      enabledLevels: { ...DEFAULT_LOGGER_STATE.enabledLevels, debug: false },
    });

    logger.debug("d")();
    logger.info("i")();

    expect(calls.map((c) => c.level)).toEqual(["info"]);
  });
});
