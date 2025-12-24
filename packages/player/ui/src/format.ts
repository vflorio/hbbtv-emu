export const formatTime = (ms: number) => {
  const d = new Date(ms);
  const iso = d.toISOString();
  return iso.split("T")[1]?.split("Z")[0] ?? iso;
};
