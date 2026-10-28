/**
 * Shared Motion Design Tokens for Arab Season Cashbook
 * Exact spring physics sourced from EasyUI (https://easyui.site) / Apple HIG design language
 */

// EasyUI exact spring tokens from https://easyui.site (src/lib/motion-tokens.ts)
export const springMorph = {
  type: "spring",
  stiffness: 220,
  damping: 32,
  mass: 1.0,
};

export const springGentle = {
  type: "spring",
  stiffness: 170,
  damping: 26,
  mass: 0.9,
};

export const fadeFast = {
  duration: 0.15,
  ease: "easeOut",
};

// Additional EasyUI motion tokens for future passes
export const springSnappy = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.5,
};

export const motionTokens = {
  springMorph,
  springGentle,
  fadeFast,
  springSnappy,
};

export default motionTokens;
