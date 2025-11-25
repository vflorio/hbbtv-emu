// TODO: Rimuovere

export const getStorageValue = (key: string, defaultValue: string): string => {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaultValue;
  }
  return window.localStorage.getItem(key) ?? defaultValue;
};

export const setStorageValue = (key: string, value: string) => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(key, value);
  }
};

export const getHbbTVVersion = (): string => {
  return getStorageValue("hbbtv_emu_version", "1.0.0");
};

export const getCountryCode = (): string => {
  return getStorageValue("hbbtv_emu_country", "ENG");
};

export const getCapabilities = (): string => {
  const defaultCapabilities =
    "<profilelist>" +
    '<ui_profile name="OITF_HD_UIPROF+META_SI+META_EIT+TRICKMODE+RTSP+AVCAD+DRM+DVB_T">' +
    "<ext>" +
    "<colorkeys>true</colorkeys>" +
    '<video_broadcast type="ID_DVB_T" scaling="arbitrary" minSize="0">true</video_broadcast>' +
    '<parentalcontrol schemes="dvb-si">true</parentalcontrol>' +
    "</ext>" +
    '<drm DRMSystemID="urn:dvb:casystemid:19219">TS MP4</drm>' +
    '<drm DRMSystemID="urn:dvb:casystemid:1664" protectionGateways="ci+">TS</drm>' +
    "</ui_profile>" +
    '<audio_profile name="MPEG1_L3" type="audio/mpeg"/>' +
    '<audio_profile name="HEAAC" type="audio/mp4"/>' +
    '<video_profile name="TS_AVC_SD_25_HEAAC" type="video/mpeg"/>' +
    '<video_profile name="TS_AVC_HD_25_HEAAC" type="video/mpeg"/>' +
    '<video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4"/>' +
    '<video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4"/>' +
    '<video_profile name="MP4_AVC_SD_25_HEAAC" type="video/mp4" transport="dash"/>' +
    '<video_profile name="MP4_AVC_HD_25_HEAAC" type="video/mp4" transport="dash"/>' +
    "</profilelist>";

  return getStorageValue("hbbtv_emu_capabilities", defaultCapabilities);
};
