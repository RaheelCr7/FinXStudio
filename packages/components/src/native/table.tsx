import React from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { DataTableProps, StatusChipProps, TimelineProps } from "../props";
import { Icon } from "./Icon";
import { useKit } from "./kit";

const tabular = { fontVariant: ["tabular-nums" as const] };
const ICON = { positive: "check", warning: "clock", negative: "x", info: "info", neutral: "minus" } as const;

export function StatusChip({ label, tone = "neutral", icon }: StatusChipProps) {
  const { c, r } = useKit();
  const pair = { positive: [c.positiveBg, c.positive], warning: [c.warningBg, c.warning], negative: [c.negativeBg, c.negative], info: [c.infoBg, c.info], neutral: [c.surfaceMuted, c.textMuted] } as const;
  const [bg, fg] = pair[tone];
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingVertical: 2, paddingLeft: 7, paddingRight: 9, borderRadius: r.pill, backgroundColor: bg }}>
      <Icon name={icon ?? ICON[tone]} size={13} color={fg} stroke={2.5} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: fg }}>{label}</Text>
    </View>
  );
}

const GLYPH = { done: "check", current: "clock", upcoming: "", failed: "x" } as const;

export function Timeline({ label, items, strings }: TimelineProps) {
  const { c } = useKit();
  return (
    <View accessibilityLabel={label} accessibilityRole="list">
      {items.map((it, i) => {
        const state = it.state ?? "done";
        const ring = { done: c.positive, current: c.accent, upcoming: c.borderStrong, failed: c.negative }[state];
        const filled = state === "done" || state === "failed";
        return (
          <View key={it.id} accessible accessibilityLabel={[it.title, strings?.[state], it.text, it.time].filter(Boolean).join(", ")} style={{ flexDirection: "row", gap: 12, paddingBottom: i === items.length - 1 ? 0 : 18 }}>
            <View style={{ width: 24, alignItems: "center" }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ring, borderStyle: state === "upcoming" ? "dashed" : "solid", backgroundColor: filled ? ring : c.surface }}>
                {GLYPH[state] ? <Icon name={GLYPH[state]} size={12} stroke={3} color={filled ? c.surface : ring} /> : null}
              </View>
              {i < items.length - 1 ? <View style={{ position: "absolute", top: 24, bottom: -18, width: 0, borderLeftWidth: 2, borderLeftColor: state === "done" ? c.positive : c.borderStrong, borderStyle: state === "upcoming" ? "dashed" : "solid" }} /> : null}
            </View>
            <View style={{ flex: 1, paddingTop: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: state === "upcoming" ? "500" : "600", color: state === "failed" ? c.negative : state === "upcoming" ? c.textMuted : c.text }}>{it.title}</Text>
              {it.text ? <Text style={{ marginTop: 2, fontSize: 13, color: c.textMuted }}>{it.text}</Text> : null}
              {it.time ? <Text style={[{ marginTop: 2, fontSize: 12, color: c.textMuted }, tabular]}>{it.time}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Tick({ on, partial, label, onPress }: { on: boolean; partial?: boolean; label: string; onPress?: () => void }) {
  const { c } = useKit();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: partial ? "mixed" : on }} onPress={onPress} hitSlop={10}
      style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on || partial ? c.accent : c.borderStrong, backgroundColor: on || partial ? c.accent : c.surface, alignItems: "center", justifyContent: "center" }}>
      {on || partial ? <Icon name={partial ? "minus" : "check"} size={14} stroke={3} color={c.accentOn} /> : null}
    </Pressable>
  );
}

const cell = (text: string, chip: any, color: string) => (chip ? <StatusChip {...chip} /> : <Text style={{ fontSize: 14, color }}>{text}</Text>);

export function DataTable({ label, layout = "table", columns, rows, onSort, selectable, all = "none", onToggleRow, onToggleAll, selection, search, filters, page, empty, onClear, strings }: DataTableProps) {
  const { c, r } = useKit();
  const first = columns[0]!;
  const sorted = columns.find((x) => x.sort);
  const sortable = columns.filter((x) => x.sortable);
  const chip = (on: boolean, text: string, press: () => void, key: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={press} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: r.pill, borderWidth: 1, borderColor: on ? c.accent : c.borderStrong, backgroundColor: on ? c.accent : c.surface, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 13, color: on ? c.accentOn : c.text }}>{text}</Text>
    </Pressable>
  );
  const body = rows.length === 0 ? (
    <View accessibilityRole="summary" style={{ padding: 24, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong, borderRadius: r.lg }}>
      <Text style={{ fontSize: 14, color: c.textMuted, textAlign: "center" }}>{empty}</Text>
      {onClear ? <Pressable accessibilityRole="button" onPress={onClear} style={{ paddingVertical: 8, paddingHorizontal: 8 }}><Text style={{ color: c.accent, fontWeight: "600" }}>{strings.clear}</Text></Pressable> : null}
    </View>
  ) : layout === "cards" ? (
    <View style={{ gap: 10 }}>
      {rows.map((row) => (
        <View key={row.id} style={{ padding: 14, borderWidth: 1, borderColor: row.selected ? c.accent : c.border, borderRadius: r.lg, backgroundColor: row.selected ? c.accentSoft : c.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {selectable ? <Tick on={!!row.selected} label={strings.selectRow.replace("{name}", row.cells[first.key]?.text ?? "")} onPress={() => onToggleRow?.(row.id)} /> : null}
            {row.onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${strings.open} ${row.cells[first.key]?.text ?? ""}`} onPress={row.onPress} style={{ flex: 1, minHeight: 32, justifyContent: "center" }}><Text style={{ fontSize: 15, fontWeight: "600", color: c.accent }}>{row.cells[first.key]?.text}</Text></Pressable>
              : <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: c.text }}>{row.cells[first.key]?.text}</Text>}
          </View>
          <View style={{ marginTop: 10, gap: 6 }}>
            {columns.slice(1).map((col) => (
              <View key={col.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 12, color: c.textMuted }}>{col.label}</Text>
                <View style={{ alignItems: "flex-end" }}>{cell(row.cells[col.key]?.text ?? "", row.cells[col.key]?.chip, c.text)}</View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  ) : (
    <ScrollView horizontal style={{ borderWidth: 1, borderColor: c.border, borderRadius: r.lg, backgroundColor: c.surface }}>
      <View accessibilityRole="grid" style={{ minWidth: "100%" as any }}>
        <View style={{ flexDirection: "row", backgroundColor: c.surfaceMuted }}>
          {selectable ? <View style={{ width: 44, alignItems: "center", justifyContent: "center", paddingVertical: 10 }}><Tick on={all === "all"} partial={all === "some"} label={strings.selectAll} onPress={onToggleAll} /></View> : null}
          {columns.map((col) => (
            <Pressable key={col.key} disabled={!col.sortable} accessibilityRole="button" accessibilityLabel={col.label} accessibilityState={{ disabled: !col.sortable }} onPress={() => onSort?.(col.key)}
              style={{ minWidth: 120, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: col.align === "end" ? "flex-end" : "flex-start", gap: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.textMuted }}>{col.label}</Text>
              {col.sortable ? <Icon name={col.sort === "asc" ? "up" : col.sort === "desc" ? "down" : "minus"} size={12} stroke={2.5} color={c.textMuted} /> : null}
            </Pressable>
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.id} style={{ flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: c.border, backgroundColor: row.selected ? c.accentSoft : "transparent" }}>
            {selectable ? <View style={{ width: 44, alignItems: "center" }}><Tick on={!!row.selected} label={strings.selectRow.replace("{name}", row.cells[first.key]?.text ?? "")} onPress={() => onToggleRow?.(row.id)} /></View> : null}
            {columns.map((col, i) => (
              <View key={col.key} style={{ minWidth: 120, flex: 1, paddingHorizontal: 14, paddingVertical: 10, alignItems: col.align === "end" ? "flex-end" : "flex-start" }}>
                {i === 0 && row.onPress ? <Pressable accessibilityRole="button" onPress={row.onPress}><Text style={{ fontSize: 14, fontWeight: "600", color: c.accent }}>{row.cells[col.key]?.text}</Text></Pressable>
                  : <View style={col.align === "end" ? undefined : undefined}>{cell(row.cells[col.key]?.text ?? "", row.cells[col.key]?.chip, c.text)}</View>}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
  return (
    <View accessibilityLabel={label} style={{ gap: 12 }}>
      {search ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: c.borderStrong, borderRadius: r.md, backgroundColor: c.surface }}>
          <Icon name="search" size={16} color={c.textMuted} />
          <TextInput accessibilityLabel={strings.search} placeholder={strings.search} placeholderTextColor={c.textFaint} value={search.value} onChangeText={search.onChange} autoCapitalize="none" autoCorrect={false}
            style={[{ flex: 1, height: 44, fontSize: 15, color: c.text }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} />
        </View>
      ) : null}
      {filters?.map((f) => (
        <ScrollView key={f.key} horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={f.label} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: c.textMuted, marginRight: 4 }}>{f.label}</Text>
          {[{ value: "", label: strings.all }, ...f.options].map((o) => chip(f.value === o.value, o.label, () => f.onChange(o.value), o.value || "all"))}
        </ScrollView>
      ))}
      {layout === "cards" && sortable.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 13, color: c.textMuted, marginRight: 4 }}>{strings.sortBy}</Text>
          {sortable.map((col) => chip(sorted?.key === col.key, sorted?.key === col.key ? `${col.label} ${sorted.sort === "asc" ? "↑" : "↓"}` : col.label, () => onSort?.(col.key), col.key))}
        </ScrollView>
      ) : null}
      {selection ? <Text accessibilityLiveRegion="polite" style={{ padding: 10, borderRadius: r.md, backgroundColor: c.accentSoft, color: c.text, fontSize: 13, fontWeight: "600" }}>{selection}</Text> : null}
      {body}
      {page ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
          {page.pages > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={strings.prev} disabled={page.index <= 0} onPress={page.onPrev} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong, borderRadius: r.md, opacity: page.index <= 0 ? 0.45 : 1 }}><Icon name="back" size={16} color={c.text} /></Pressable> : null}
          <Text style={[{ fontSize: 13, color: c.textMuted }, tabular]}>{page.summary}</Text>
          {page.pages > 1 ? <Pressable accessibilityRole="button" accessibilityLabel={strings.next} disabled={page.index >= page.pages - 1} onPress={page.onNext} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.borderStrong, borderRadius: r.md, opacity: page.index >= page.pages - 1 ? 0.45 : 1 }}><Icon name="chevronRight" size={16} color={c.text} /></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}
