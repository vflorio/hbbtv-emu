import type { AVControlMimeType } from "./constants";

export * from "./avControl";
export * from "./constants";
export * from "./events";

export const AV_CONTROL_MIME_TYPES: AVControlMimeType[] = [
  "video/mp4",
  "audio/mp4",
  "video/mpeg",
  "audio/mpeg",
  "video/webm",
  "audio/webm",
  "video/broadcast",
  "application/dash+xml",
  "application/vnd.apple.mpegurl",
];
