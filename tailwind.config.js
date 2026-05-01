/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        panel: "var(--bg-panel)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "sans-serif"],
        mono: ["SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
