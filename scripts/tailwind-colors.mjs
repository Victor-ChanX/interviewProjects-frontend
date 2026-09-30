// Tailwind 颜色类的识别口径，eslint.config.mjs（中性色直接拦）与
// 与写死颜色的按文件冻结检查共用一份，免得两张网的前缀表
// 各写各的 —— 审查时发现过 eslint 那份只有 bg|text|border|ring|fill|divide|from|
// via|to，`border-t-gray-200`、`stroke-slate-400`、`placeholder-gray-400`、
// `ring-offset-gray-100` 都能过。
//
// 导出的是正则源码字符串（不含 `/`，esquery 的 `[value=/…/]` 能直接嵌）。

/** 能带颜色的工具类前缀（含方向变体 border-t / border-x、ring-offset、各类 shadow）。 */
export const COLOR_UTILITY_PREFIX =
  "bg|text|border(?:-[xytrblse])?|(?:inset-)?ring(?:-offset)?|fill|stroke|divide|from|via|to|outline|decoration|accent|caret|(?:inset-|drop-|text-)?shadow|placeholder";

/** 前面不是字母数字或连字符（`hover:bg-…`、`md:text-…` 的冒号可以）。 */
const START = "(?<![\\w-])";

/** 中性色五族的色阶类：slate / zinc / gray / neutral / stone。 */
export const NEUTRAL_PALETTE_SOURCE = `${START}(?:${COLOR_UTILITY_PREFIX})-(?:slate|zinc|gray|neutral|stone)-\\d{2,3}\\b`;

/** 其余写死的颜色：彩色色阶、white / black、任意值色（`bg-[#eef1f8]`）。 */
export const HARDCODED_COLOR_SOURCE = `${START}(?:${COLOR_UTILITY_PREFIX})-(?:(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|white|black|\\[(?:#|rgba?\\(|hsla?\\(|oklch\\()[^\\]]*\\])`;
