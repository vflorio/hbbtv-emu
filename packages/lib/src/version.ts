export const parseVersion = (version: string) => version.split(".").map(Number);

export const compareVersions = (v1: string, v2: string) => {
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);

  for (let index = 0; index < Math.max(parts1.length, parts2.length); index++) {
    const num1 = parts1[index] || 0;
    const num2 = parts2[index] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
};

export const version = (version: string) => ({
  isGreaterThan: (other: string) => compareVersions(version, other) > 0,
  isGreaterThanOrEqual: (other: string) => compareVersions(version, other) >= 0,
  isLessThan: (other: string) => compareVersions(version, other) < 0,
  isLessThanOrEqual: (other: string) => compareVersions(version, other) <= 0,
  isEqual: (other: string) => compareVersions(version, other) === 0,
});
