/** @type {import('next').NextConfig} */
export default {
  transpilePackages: [
    "@finx/components", "@finx/renderer-native", "@finx/renderer-core", "@finx/ui-kit", "@finx/journey-schema", "@finx/codegen", "@finx/mock-bank-api", "@finx/mcp",
    "react-native-web", "react-native-svg",
  ],
  turbopack: {
    // The preview renders the real React Native renderer on the web.
    resolveAlias: { "react-native": "./lib/react-native-shim.ts", "@react-native/assets-registry/registry": "./lib/assets-registry-stub.ts" },
    resolveExtensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
};
