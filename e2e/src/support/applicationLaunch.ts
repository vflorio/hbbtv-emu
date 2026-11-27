/**
 * What `basic-app/index.xhtml` does, in the page, in the createApplication() scenario
 * both hosts run (TS 102 796 §6.2.2.6.1, §6.2.2.5.6, §9.2). Each host's suite drives
 * the TV; these run in the page (`page.evaluate`, of Playwright or Puppeteer).
 */

/** The application starts another at `uri`; the page is marked, to tell it from the next one. */
export const createApplicationIn = (uri: string): boolean => {
  Object.assign(window, { __stayed: true });
  type AppMgr = { getOwnerApplication: (d: Document) => { createApplication: (u: string, c: boolean) => unknown } };
  const app = (document.getElementById("appmgr") as unknown as AppMgr).getOwnerApplication(document);
  return app.createApplication(uri, false) !== null;
};

/**
 * The application starts another at `uri`, which the TV cannot load: what its
 * application manager heard (property and DOM event), and whether the page stayed.
 */
export const createApplicationThatFails = (uri: string): Promise<{ heard: string[]; stayed: boolean }> => {
  type Appl = { show: () => void };
  type AppMgr = HTMLObjectElement & {
    getOwnerApplication: (d: Document) => { createApplication: (u: string, c: boolean) => Appl | null };
    onApplicationLoadError: ((appl: Appl) => void) | null;
  };
  const appMgr = document.getElementById("appmgr") as unknown as AppMgr;
  const heard: string[] = [];
  let launched: Appl | null = null;
  Object.assign(window, { __stayed: true });
  return new Promise((resolve) => {
    appMgr.addEventListener("ApplicationLoadError", (event) => {
      heard.push((event as Event & { appl: Appl }).appl === launched ? "event" : "event of another");
    });
    appMgr.onApplicationLoadError = (appl) => {
      heard.push(appl === launched ? "property" : "property of another");
      setTimeout(() => resolve({ heard, stayed: "__stayed" in window }), 500);
    };
    launched = appMgr.getOwnerApplication(document).createApplication(uri, false);
  });
};

/** What a broadcast-independent application sees of the broadcast: no channel, an unrealized object. */
export const broadcastSeen = () => {
  type Vb = { currentChannel: { ccid: string } | null; playState: number };
  type AppMgr = { getOwnerApplication: (d: Document) => { privateData: { currentChannel: { ccid: string } | null } } };
  const video = document.getElementById("video") as unknown as Vb;
  const appMgr = document.getElementById("appmgr") as unknown as AppMgr;
  return {
    application: appMgr.getOwnerApplication(document).privateData.currentChannel?.ccid ?? null,
    videoBroadcast: video.currentChannel?.ccid ?? null,
    playState: video.playState,
  };
};

/** The application selects a service by its triplet (`setChannel()`). */
export const selectService = ({ onid, tsid, sid }: { onid: number; tsid: number; sid: number }): void => {
  type Vb = {
    createChannelObject: (idType: number, onid: number, tsid: number, sid: number) => unknown;
    setChannel: (channel: unknown) => void;
  };
  const video = document.getElementById("video") as unknown as Vb;
  video.setChannel(video.createChannelObject(12 /* ID_DVB_T */, onid, tsid, sid));
};
