import React from "react";
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { ICON_SHAPES } from "@finx/ui-kit";

export function Icon({ name, size = 22, color, stroke = 2 }: { name: string; size?: number; color: string; stroke?: number }) {
  const shapes = ICON_SHAPES[name];
  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {shapes?.map((sh, i) => ("d" in sh ? <Path key={i} d={sh.d} /> : <Rect key={i} x={sh.rect.x} y={sh.rect.y} width={sh.rect.width} height={sh.rect.height} rx={sh.rect.rx} />))}
        </G>
      </Svg>
    </View>
  );
}
