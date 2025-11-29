import type { ClassType } from "@hbb-emu/lib";

export namespace ParentalControl {
  export interface Contract {
    onParentalRatingChange?: OnParentalRatingChange;
    onParentalRatingError?: OnParentalRatingError;
    onDRMRightsError?: OnDRMRightsError;
  }

  export type OnParentalRatingChange = (
    contentID: string | null,
    ratings: unknown,
    DRMSystemID: string | null,
    blocked: boolean,
  ) => void;

  export type OnParentalRatingError = (contentID: string | null, ratings: unknown, DRMSystemID: string | null) => void;

  export type OnDRMRightsError = (
    errorState: number,
    contentID: string | null,
    DRMSystemID: string | null,
    rightsIssuerURL?: string,
  ) => void;
}

export const WithParentalControl = <T extends ClassType>(Base: T) =>
  class extends Base implements ParentalControl.Contract {
    onParentalRatingChange?: ParentalControl.OnParentalRatingChange;
    onParentalRatingError?: ParentalControl.OnParentalRatingError;
    onDRMRightsError?: ParentalControl.OnDRMRightsError;
  };
