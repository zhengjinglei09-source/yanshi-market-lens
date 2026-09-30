import type { NextConfig } from "next";
const mode = process.env.DATA_MODE ?? "live";
if (!["mock", "live"].includes(mode))
  throw new Error("DATA_MODE must be mock or live");
const config: NextConfig = {
  ...(process.env.NEXT_OUTPUT_EXPORT === "1"
    ? { output: "export" as const }
    : {}),
  trailingSlash: true,
  env: { NEXT_PUBLIC_DATA_MODE: mode },
  images: { unoptimized: true },
};
export default config;
