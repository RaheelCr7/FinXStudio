/**
 * The Studio preview runs the app's React Native renderer on the web through react-native-web. react-native-svg's web build
 * still imports two things only the native runtime has (the TurboModule registry and the asset registry). The preview never
 * uses either, so they are answered with empty values here and the rest is react-native-web unchanged.
 */
export * from "react-native-web";
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => ({}) };
