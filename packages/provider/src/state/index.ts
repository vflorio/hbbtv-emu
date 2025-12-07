import type { ClassType } from "@hbb-emu/core";
import { pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as S from "fp-ts/State";

export type BridgeState = Readonly<{}>;

export type AppState = {};

export const WithAppState = <T extends ClassType>(Base: T) => class extends Base implements AppState {};
