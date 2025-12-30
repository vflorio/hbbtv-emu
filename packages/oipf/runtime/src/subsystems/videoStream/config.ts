/**
 * VideoStream Configuration Types
 */

/**
 * Video source configuration
 */
export type VideoStreamSource = Readonly<{
  url: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  drm?: {
    system: string;
    licenseUrl: string;
    headers?: Record<string, string>;
  };
}>;
