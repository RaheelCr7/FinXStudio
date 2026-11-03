import React from "react";
/** Stands in for react-native-svg in tests (its source needs a Flow-aware build). Draws plain DOM svg. */
export default function Svg({ children, ...p }: any) { return <svg {...p}>{children}</svg>; }
export const G = ({ children, ...p }: any) => <g {...p}>{children}</g>;
export const Path = (p: any) => <path {...p} />;
export const Rect = (p: any) => <rect {...p} />;
