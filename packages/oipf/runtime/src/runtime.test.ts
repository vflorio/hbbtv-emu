import { DEFAULT_EXTENSION_STATE } from "@hbb-emu/extension-common";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeEnv, type RuntimeHandle, runtime } from "./runtime";

/** MutationObserver callbacks are microtasks. */
const flushMutations = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const started: RuntimeHandle[] = [];

const startRuntime = () => {
  const handle = runtime(createRuntimeEnv({ ...DEFAULT_EXTENSION_STATE, channels: [] }))();
  started.push(handle);
  return handle;
};

const addObject = (type: string) => {
  const element = document.createElement("object");
  element.setAttribute("type", type);
  document.body.appendChild(element);
  return element as HTMLObjectElement & Record<string, unknown>;
};

afterEach(() => {
  for (const handle of started.splice(0)) handle.stop()();
  document.body.innerHTML = "";
});

describe("runtime", () => {
  it("once started, binds OIPF objects added to the document", async () => {
    startRuntime();

    const appMgr = addObject("application/oipfApplicationManager");
    await flushMutations();

    expect(typeof appMgr.getOwnerApplication).toBe("function");
  });

  it("binds non-visual objects with a working API", async () => {
    startRuntime();

    const appMgr = addObject("application/oipfApplicationManager") as unknown as {
      getOwnerApplication: (doc: Document) => {
        privateData: { keyset: { setValue: (v: number) => void; value: number } };
      };
    };
    await flushMutations();
    const keyset = appMgr.getOwnerApplication(document).privateData.keyset;
    keyset.setValue(0x1f);

    expect(keyset.value).toBe(0x1f);
  });

  it("stops binding objects once stopped", async () => {
    startRuntime().stop()();

    const appMgr = addObject("application/oipfApplicationManager");
    await flushMutations();

    expect(appMgr.getOwnerApplication).toBeUndefined();
  });
});
