/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@finx/renderer-native", "@finx/renderer-core", "@finx/ui-kit", "@finx/journey-schema", "@finx/mock-bank-api",
    "react-native-web",
  ],
  turbopack: {
    // The preview renders the real React Native renderer on the web.
    resolveAlias: { "react-native": "react-native-web" },
    resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};
