export const textToHex = (text: string): string =>
  Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");

export const hexToText = (hex: string): string => {
  const cleanHex = hex.replace(/\s/g, "");
  if (!/^[0-9A-Fa-f]*$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
    return "";
  }

  const bytes = new Uint8Array(cleanHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) || []);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
};

export const isValidHex = (str: string): boolean => {
  const cleanHex = str.replace(/\s/g, "");
  return /^[0-9A-Fa-f]*$/.test(cleanHex) && cleanHex.length % 2 === 0;
};
