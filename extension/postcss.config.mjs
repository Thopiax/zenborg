// Tailwind is handled by @tailwindcss/vite in wxt.config.ts, not PostCSS.
// This file stops Vite from walking up to the root's postcss.config.mjs.
export default { plugins: [] };
