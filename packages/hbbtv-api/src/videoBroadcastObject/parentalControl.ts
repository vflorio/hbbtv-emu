import type { ClassType } from "@hbb-emu/lib";

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

export interface ParentalControl {
  onParentalRatingChange?: OnParentalRatingChange;
  onParentalRatingError?: OnParentalRatingError;
  onDRMRightsError?: OnDRMRightsError;
}

export const WithParentalControl = <T extends ClassType>(Base: T) =>
  class extends Base implements ParentalControl {
    onParentalRatingChange?: OnParentalRatingChange;
    onParentalRatingError?: OnParentalRatingError;
    onDRMRightsError?: OnDRMRightsError;
  };
