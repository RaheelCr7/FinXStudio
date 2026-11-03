import { Block } from "@finx/journey-schema";

/** Every kind of block a journey can contain, taken from the schema so a new kind cannot be added without both renderers noticing. */
export type BlockType = Block["type"];
export const BLOCK_TYPES = Block.options.map((o) => o.shape.type.value) as BlockType[];

/** What every renderer gives each block it draws. `b` is the block as the runner resolved it (values, errors, items, localized text). */
export type BlockProps = {
  b: Record<string, any>;
  /** Set the answer at a data path. */
  set: (path: string, value: any) => void;
  /** Run the actions of a button. */
  press: (actions: any[]) => void;
  busy: boolean;
  lang: string;
  /** The built-in words (account, pay to, wait…) in the journey's language. */
  strings: Record<string, string>;
};
