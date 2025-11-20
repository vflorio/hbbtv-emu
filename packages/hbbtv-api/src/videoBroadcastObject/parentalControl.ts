import type { ClassType } from "../utils";

export interface ParentalControl {
  onParentalRatingChange?: (
    contentID: string | null,
    ratings: unknown,
    DRMSystemID: string | null,
    blocked: boolean,
  ) => void;
  onParentalRatingError?: (contentID: string | null, ratings: unknown, DRMSystemID: string | null) => void;
  onDRMRightsError?: (
    errorState: number,
    contentID: string | null,
    DRMSystemID: string | null,
    rightsIssuerURL?: string,
  ) => void;
}

export const WithParentalControl = <T extends ClassType>(Base: T) =>
  class extends Base implements ParentalControl {
    onParentalRatingChange?: (
      contentID: string | null,
      ratings: unknown,
      DRMSystemID: string | null,
      blocked: boolean,
    ) => void;
    onParentalRatingError?: (contentID: string | null, ratings: unknown, DRMSystemID: string | null) => void;
    onDRMRightsError?: (
      errorState: number,
      contentID: string | null,
      DRMSystemID: string | null,
      rightsIssuerURL?: string,
    ) => void;
  };
