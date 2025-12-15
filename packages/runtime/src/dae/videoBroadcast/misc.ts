import type { ClassType } from "@hbb-emu/core";
import type { OIPF } from "@hbb-emu/oipf";
import type { VideoBroadcastEnv } from ".";

export interface MiscAPI {
  // State
  _programmes: OIPF.DAE.Broadcast.Programme[];
  // Properties
  data: string;
  programmes: OIPF.DAE.Broadcast.ProgrammeCollection;
  // Events
  onProgrammesChanged: OIPF.DAE.Broadcast.VideoBroadcast["onProgrammesChanged"];
  onParentalRatingChange: OIPF.DAE.Broadcast.VideoBroadcast["onParentalRatingChange"];
  onParentalRatingError: OIPF.DAE.Broadcast.VideoBroadcast["onParentalRatingError"];
  onDRMRightsError: OIPF.DAE.Broadcast.VideoBroadcast["onDRMRightsError"];
}

export const WithMisc = <T extends ClassType<VideoBroadcastEnv>>(Base: T) =>
  class extends Base implements MiscAPI {
    _programmes: OIPF.DAE.Broadcast.Programme[] = [];

    get data(): string {
      return "";
    }

    set data(_value: string) {
      // Setting data property has no effect for video/broadcast
    }

    get programmes(): OIPF.DAE.Broadcast.ProgrammeCollection {
      return {
        length: this._programmes.length,
        item: (index: number) => this._programmes[index],
      };
    }

    onProgrammesChanged: OIPF.DAE.Broadcast.OnProgrammesChangedHandler | null = null;
    onParentalRatingChange: OIPF.DAE.Broadcast.OnParentalRatingChangeHandler | null = null;
    onParentalRatingError: OIPF.DAE.Broadcast.OnParentalRatingErrorHandler | null = null;
    onDRMRightsError: OIPF.DAE.Broadcast.OnDRMRightsErrorHandler | null = null;
  };
