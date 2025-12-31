import { createLogger } from "@hbb-emu/core";
import { createDefaultTabsManagerEnv, TabsManager, type TabsManangerEnv } from "./tabsManager";

export class BackgroundScript {
  public tabsManager: TabsManager;

  constructor(
    protected readonly logger = createLogger("BackgroundScript"),
    protected readonly tabsManagerEnv: Omit<TabsManangerEnv, "handlers">,
  ) {
    this.tabsManager = new TabsManager(
      {
        ...createDefaultTabsManagerEnv(),
        ...this.tabsManagerEnv,
        handlers: {
          onTabAdded: (tabId: number) => this.logger.info(`Tab added: ${tabId}`),
          onTabRemoved: (tabId: number) => this.logger.info(`Tab removed: ${tabId}`),
        },
      },
      logger,
    );
  }
}
