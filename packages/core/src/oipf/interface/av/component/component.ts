/**
 * HbbTV A/V Component API
 *
 * Defines interfaces for audio, video, and subtitle components
 * in broadcast and on-demand content.
 *
 * @see OIPF DAE Specification Section 7.16.5
 * @see HbbTV Specification
 */

// ============================================================================
// Component Type Constants
// ============================================================================

/**
 * Component type constants.
 *
 * Used to identify the type of media component.
 */
export enum ComponentType {
  /** Video component (any encoding) */
  VIDEO = 0,

  /** Audio component (any encoding) */
  AUDIO = 1,

  /**
   * Subtitle component (any format).
   *
   * May also represent closed captioning within a video stream.
   */
  SUBTITLE = 2,
}

// ============================================================================
// Base Component Interface
// ============================================================================

/**
 * Base interface for all A/V components.
 *
 * Components represent individual streams within a broadcast or
 * on-demand content item.
 */
export interface AVComponentBase {
  /**
   * The type of component.
   *
   * @see ComponentType
   */
  readonly componentType: ComponentType;

  /**
   * The component tag (PID for MPEG-2 TS).
   *
   * Unique identifier for the component within the stream.
   */
  readonly componentTag: number;

  /**
   * The PID (Packet Identifier) for MPEG-2 transport streams.
   */
  readonly pid?: number;

  /**
   * The encoding/codec type of the component.
   *
   * For example: "video/h264", "audio/aac", "application/x-teletext".
   */
  readonly encoding?: string;

  /**
   * Indicates whether this component is encrypted.
   */
  readonly encrypted?: boolean;
}

// ============================================================================
// Audio Component Interface
// ============================================================================

/**
 * Audio component types.
 */
export enum AudioType {
  /** Normal audio track */
  NORMAL = 0,

  /** Audio description for visually impaired */
  AUDIO_DESCRIPTION = 1,

  /** Clean audio (no commentary) */
  CLEAN_AUDIO = 2,

  /** Spoken subtitles */
  SPOKEN_SUBTITLES = 3,
}

/**
 * Represents an audio component in the stream.
 *
 * @example
 * ```typescript
 * const components = videoBroadcast.getComponents(ComponentType.AUDIO);
 * if (components) {
 *   for (let i = 0; i < components.length; i++) {
 *     const audio = components.item(i) as AVAudioComponent;
 *     console.log(`Audio: ${audio.language} (${audio.audioChannels}ch)`);
 *   }
 * }
 * ```
 */
export interface AVAudioComponent extends AVComponentBase {
  readonly componentType: ComponentType.AUDIO;

  /**
   * The ISO 639-2 language code for this audio track.
   *
   * Three-letter language code (e.g., "eng", "deu", "fra").
   */
  readonly language?: string;

  /**
   * Indicates whether hearing-impaired features are available.
   */
  readonly hearingImpaired?: boolean;

  /**
   * The type of audio track.
   *
   * @see AudioType
   */
  readonly audioType?: AudioType;

  /**
   * A human-readable description of this audio track.
   */
  readonly audioDescription?: string;

  /**
   * The number of audio channels.
   *
   * For example: 2 for stereo, 6 for 5.1 surround.
   */
  readonly audioChannels?: number;

  /**
   * The audio coding format.
   *
   * For example: "MP2", "AC3", "AAC", "E-AC3", "HE-AAC".
   */
  readonly audioCoding?: string;

  /**
   * Indicates if this is the default audio track.
   */
  readonly defaultAudio?: boolean;
}

// ============================================================================
// Video Component Interface
// ============================================================================

/**
 * Represents a video component in the stream.
 */
export interface AVVideoComponent extends AVComponentBase {
  readonly componentType: ComponentType.VIDEO;

  /**
   * The aspect ratio of the video.
   *
   * Common values: "16:9", "4:3", "2.35:1".
   */
  readonly aspectRatio?: string;

  /**
   * The horizontal resolution in pixels.
   */
  readonly width?: number;

  /**
   * The vertical resolution in pixels.
   */
  readonly height?: number;

  /**
   * The frame rate in frames per second.
   */
  readonly frameRate?: number;

  /**
   * The video coding format.
   *
   * For example: "MPEG2", "H.264", "H.265", "VP9", "AV1".
   */
  readonly videoCoding?: string;

  /**
   * Indicates if the video is interlaced (true) or progressive (false).
   */
  readonly interlaced?: boolean;

  /**
   * Indicates if HDR (High Dynamic Range) is used.
   */
  readonly hdr?: boolean;

  /**
   * The HDR type if applicable.
   *
   * For example: "HDR10", "HDR10+", "HLG", "Dolby Vision".
   */
  readonly hdrType?: string;
}

// ============================================================================
// Subtitle Component Interface
// ============================================================================

/**
 * Subtitle types.
 */
export enum SubtitleType {
  /** Normal subtitles */
  NORMAL = 0,

  /** Subtitles for hearing impaired */
  HEARING_IMPAIRED = 1,
}

/**
 * Represents a subtitle component in the stream.
 *
 * @example
 * ```typescript
 * const components = videoBroadcast.getComponents(ComponentType.SUBTITLE);
 * if (components) {
 *   for (let i = 0; i < components.length; i++) {
 *     const subtitle = components.item(i) as AVSubtitleComponent;
 *     console.log(`Subtitle: ${subtitle.language}`);
 *     if (subtitle.hearingImpaired) {
 *       console.log('  (for hearing impaired)');
 *     }
 *   }
 * }
 * ```
 */
export interface AVSubtitleComponent extends AVComponentBase {
  readonly componentType: ComponentType.SUBTITLE;

  /**
   * The ISO 639-2 language code for these subtitles.
   *
   * Three-letter language code (e.g., "eng", "deu", "fra").
   */
  readonly language?: string;

  /**
   * Indicates whether these subtitles are for hearing-impaired viewers.
   */
  readonly hearingImpaired?: boolean;

  /**
   * A human-readable label for these subtitles.
   */
  readonly label?: string;

  /**
   * The type of subtitle.
   *
   * @see SubtitleType
   */
  readonly subtitleType?: SubtitleType;

  /**
   * The subtitle format.
   *
   * For example: "DVB", "Teletext", "TTML", "WebVTT", "EBU-TT".
   */
  readonly subtitleFormat?: string;

  /**
   * For teletext subtitles, the magazine number.
   */
  readonly teletextMagazine?: number;

  /**
   * For teletext subtitles, the page number.
   */
  readonly teletextPage?: number;

  /**
   * Indicates if these are the default subtitles.
   */
  readonly defaultSubtitle?: boolean;
}

// ============================================================================
// Union Type for All Components
// ============================================================================

/**
 * Union type representing any A/V component.
 */
export type AVComponent = AVAudioComponent | AVVideoComponent | AVSubtitleComponent;

// ============================================================================
// Component Collection Interface
// ============================================================================

/**
 * Collection of AVComponent objects.
 *
 * Provides array-like access to media components.
 */
export interface AVComponentCollection {
  /**
   * The number of components in the collection.
   */
  readonly length: number;

  /**
   * Returns the component at the specified index.
   *
   * @param index - The zero-based index
   * @returns The AVComponent at the index, or undefined if out of bounds
   */
  item(index: number): AVComponent | undefined;

  /**
   * Array-like index access.
   */
  [index: number]: AVComponent;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a component is an audio component.
 *
 * @param component - The component to check
 * @returns `true` if the component is an audio component
 */
export const isAudioComponent = (component: AVComponent): component is AVAudioComponent =>
  component.componentType === ComponentType.AUDIO;

/**
 * Type guard to check if a component is a video component.
 *
 * @param component - The component to check
 * @returns `true` if the component is a video component
 */
export const isVideoComponent = (component: AVComponent): component is AVVideoComponent =>
  component.componentType === ComponentType.VIDEO;

/**
 * Type guard to check if a component is a subtitle component.
 *
 * @param component - The component to check
 * @returns `true` if the component is a subtitle component
 */
export const isSubtitleComponent = (component: AVComponent): component is AVSubtitleComponent =>
  component.componentType === ComponentType.SUBTITLE;
