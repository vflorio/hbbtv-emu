export * from "./avVideoBroadcast";
export * from "./avVideoDash";
export * from "./avVideoMp4";

// todo prendi da api backend:

export class VideoBackend {
  videoElement: HTMLVideoElement = document.createElement("video");
}
