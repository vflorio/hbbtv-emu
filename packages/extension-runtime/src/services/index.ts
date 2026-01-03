import { createLogger, type Logger } from "@hbb-emu/core";
import { type AdapterConfig, type AdapterEnv, type BaseMessage, createAdapterEnv } from "..";

export * from "./background";
//export * from "./bridge";
//export * from "./content";
//export * from "./ui";

export interface ServiceEnv<TState, TEvents extends BaseMessage> {
  readonly adapter: AdapterEnv<TState, TEvents>;
  readonly config: AdapterConfig;
  readonly logger: Logger;
}

export const createServiceEnv = <TState, TEvents extends BaseMessage>(
  config: AdapterConfig,
  logger?: Logger,
): ServiceEnv<TState, TEvents> => ({
  config: config,
  adapter: createAdapterEnv<TState, TEvents>(config),
  logger: logger ?? createLogger("Unknown Service"),
});
