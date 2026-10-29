/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#13203B", soft: "#334155", muted: "#64748B" },
        paper: "#F6F7F9",
        line: "#E2E6EC",
        indigo: { 50: "#EEF0FF", 100: "#E0E4FF", 600: "#4338CA", 700: "#3730A3" },
        teal: { 50: "#E8F6F4", 100: "#CDEBE6", 600: "#0F766E", 700: "#0B5F58" },
        verdict: { supported: "#0F766E", contradicted: "#B42318", mixed: "#B54708", insufficient: "#475467" },
      },
      fontFamily: {
        serif: ['"Newsreader"', "Georgia", "serif"],
        sans: ['"Instrument Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(19,32,59,0.04), 0 4px 16px -8px rgba(19,32,59,0.08)" },
    },
  },
  plugins: [],
};
