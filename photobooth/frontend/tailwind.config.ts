import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        psru: {
          green: "#0E7A4B",
          greenDark: "#0A5D39",
          greenDeep: "#063D26",
          mint: "#E7F5EE",
          gold: "#C9A227",
          goldSoft: "#E3C766",
          ink: "#1E293B",
          muted: "#64748B",
          bg: "#F4F8F5",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-sarabun)", "sans-serif"],
        thai: ["var(--font-sarabun)", "var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
