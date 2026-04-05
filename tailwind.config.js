/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F14",
        card: "#121821",
        card2: "#161D28",
        accent: "#22D3EE",
        "accent-hover": "#06B6D4",
        muted: "#9DA7B3",
        border: "rgba(34,211,238,0.08)",
        border2: "rgba(255,255,255,0.06)",
        success: "#22C55E",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["Syne", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
