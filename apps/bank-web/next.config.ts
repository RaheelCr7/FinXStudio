import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared packages ship TypeScript source, so Next compiles them with the app.
  transpilePackages: ["@finx/bank-client", "@finx/renderer-core", "@finx/renderer-web", "@finx/ui-kit", "@finx/journey-schema", "@finx/mock-bank-api"],
  poweredByHeader: false,
};
export default config;
