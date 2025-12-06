/**
 *  Provide strategy
 *  DOM Matcher
 *
 *  oipfObjectFactory       -> Inject (window.oipfObjectFactory)
 *  oipfApplicationManager  -> Proxy <object type="oipfApplicationManager" />
 *  oipfConfiguration       -> Proxy <object type="oipfConfiguration" />
 *  oipfCapabilities        -> Proxy <object type="oipfCapabilities" />
 *  avVideoBroadcast        -> Proxy <object type="video/broadcast" />          StateProvider, VideoBackend
 *  avVideoMp4              -> Proxy <object type="video/mp4" />                StateProvider, VideoBackend
 *  avVideoDash             -> Proxy <object type="application/dash+xml" />     StateProvider, VideoBackend
 *
 *  Inject (append window.[apiName])
 *
 *  Proxy (properties & methods interception)
 *      DomObserver
 *
 *  VideoBackend ("low-level" implementation of video playback)
 *     HTML5VideoElementBackend
 *     ObjectStyleMirror (<object> style interception)
 *
 *  BackendDash = VideoBackend + (HTML5VideoElementBackend + DashJS)
 *
 * StateProvider
 *
 * createHbbtvApi = (State, Backend) => ApiObject
 */
