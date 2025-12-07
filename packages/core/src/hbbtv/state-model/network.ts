/**
 * Network Configuration State
 */

import * as t from "io-ts";

// ─────────────────────────────────────────────────────────────────────────────
// Network Interface
// ─────────────────────────────────────────────────────────────────────────────

export const NetworkInterfaceCodec = t.partial({
  name: t.string,
  type: t.union([t.literal("ethernet"), t.literal("wifi"), t.literal("other")]),
  mac: t.string,
  ipv4: t.string,
  ipv6: t.string,
});

export type NetworkInterface = t.TypeOf<typeof NetworkInterfaceCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Network Config
// ─────────────────────────────────────────────────────────────────────────────

export const NetworkConfigCodec = t.partial({
  interfaces: t.array(NetworkInterfaceCodec),
  online: t.boolean,
});

export type NetworkConfig = t.TypeOf<typeof NetworkConfigCodec>;

// ─────────────────────────────────────────────────────────────────────────────
// Parental Control
// ─────────────────────────────────────────────────────────────────────────────

export const ParentalControlCodec = t.partial({
  rating: t.number,
  enabled: t.boolean,
});

export type ParentalControl = t.TypeOf<typeof ParentalControlCodec>;
