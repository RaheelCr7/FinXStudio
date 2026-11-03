/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@finx/renderer-native", "@finx/renderer-web", "@finx/renderer-core", "@finx/ui-kit", "@finx/journey-schema", "@finx/codegen", "@finx/mock-bank-api",
    "react-native-web", "react-native-svg",
  ],
  turbopack: {
    // The preview renders the real React Native renderer on the web.
    resolveAlias: { "react-native": "./lib/react-native-shim.ts", "@react-native/assets-registry/registry": "./lib/assets-registry-stub.ts" },
    resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};
