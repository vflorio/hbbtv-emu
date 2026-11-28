import { describe, expect, it } from "vitest";
import { type ActivationEnv, createActivation, receiveKey, tellActivation } from "./activation";

const env = (activated: boolean) => {
  const log: string[] = [];
  const activation = createActivation(activated);
  const activationEnv: ActivationEnv = {
    activation,
    reapplyKeyset: () => {
      log.push(`reapply:${activation.activated()}`);
      return 0;
    },
    report: () => void log.push("report"),
  };
  return { activation, activationEnv, log };
};

describe("activation (TS 102 796 §10.2.2.1)", () => {
  it("an application the TV AUTOSTARTed is activated by its first key event, which the host hears once", () => {
    const { activation, activationEnv, log } = env(false);

    receiveKey(activationEnv)();
    receiveKey(activationEnv)();

    expect(activation.activated()).toBe(true);
    // The keyset does not change by itself on activation.
    expect(log).toEqual(["report"]);
  });

  it("an application launched activated tells the host nothing on its keys", () => {
    const { activationEnv, log } = env(true);

    receiveKey(activationEnv)();

    expect(log).toEqual([]);
  });

  it("the TV's word replaces what the page assumed, and the keyset is what it would have been", () => {
    const { activation, activationEnv, log } = env(false);

    tellActivation(false)(activationEnv)();
    tellActivation(true)(activationEnv)();
    tellActivation(false)(activationEnv)();

    expect(activation.activated()).toBe(false);
    expect(log).toEqual(["reapply:true", "reapply:false"]);
  });

  it("once a key event activated the application, a TV that has not heard yet does not undo it", () => {
    const { activation, activationEnv, log } = env(false);

    receiveKey(activationEnv)();
    tellActivation(false)(activationEnv)();

    expect(activation.activated()).toBe(true);
    expect(log).toEqual(["report"]);
  });
});
