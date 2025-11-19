import type { Constructor } from "../utils";

interface WithParentalControl {
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

export const WithParentalControl = <T extends Constructor>(Base: T) =>
  class extends Base implements WithParentalControl {
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
