import { createApplicationManager, type OipfApplicationManager } from "./applicationManager";
import { createOipfCapabilities, type OipfCapabilities } from "./capabilities";
import { createOipfConfiguration, type OipfConfiguration } from "./configuration";
import { createObjectFactory, type OipfObjectFactory } from "./objectFactory";
import { createOipf, type Oipf } from "./oipf";

type HbbtvApi = {
  oipf?: Oipf;
  oipfObjectFactory?: OipfObjectFactory;
  oipfApplicationManager?: OipfApplicationManager;
  oipfConfiguration?: OipfConfiguration;
  oipfCapabilities?: OipfCapabilities;
};

declare global {
  interface Window extends HbbtvApi {}
}

const hbbtvApi: HbbtvApi = {
  oipf: createOipf(),

  // 7.1 Object factory API
  oipfObjectFactory: createObjectFactory(),

  // 7.2.1 Application Manager
  oipfApplicationManager: createApplicationManager(),

  // 7.3.1 Configuration
  oipfConfiguration: createOipfConfiguration(),

  // 7.15.3 Capabilities
  oipfCapabilities: createOipfCapabilities(),
};

export default hbbtvApi;
