import type { InstanceEnv } from "../stateful/instance";
import { createObserverEnv, type ObserverEnv } from "./observer";

export type ConnectorEnv = ObserverEnv & InstanceEnv;

/** Create observer portion of ConnectorEnv (InstanceEnv must be provided separately) */
export const createConnectorObserverEnv = (): ObserverEnv => createObserverEnv();
