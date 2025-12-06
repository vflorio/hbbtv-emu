/* ----------------------------------------------------------------------
 * application/oipfConfiguration
 * -------------------------------------------------------------------- */

/** Configuration object (oipfConfiguration) for device settings. */
export interface Configuration {
  countryId?: string;
  language?: string;
  preferredAudioLanguage?: string[];
  preferredSubtitleLanguage?: string[];
  setHbbTVAppAutoStart?(enabled: boolean): void;

  network?: {
    interfaces?: Array<{
      name?: string;
      type?: "ethernet" | "wifi" | "other";
      mac?: string;
      ipv4?: string;
      ipv6?: string;
    }>;
    online?: boolean;
  };

  parentalControl?: {
    rating?: number;
    enabled?: boolean;
  };

  getValue?(key: string): unknown;
  setValue?(key: string, value: unknown): void;
}
