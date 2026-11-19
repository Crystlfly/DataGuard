import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "Inter", "Segoe UI", "Arial", "sans-serif"],
        mono: ["Geist Mono", "Consolas", "monospace"],
      },
      colors: {
        enterprise: {
          brand: "#B3FF4C",
          green: "#22c55e",
          amber: "#eab308",
          red: "#f43f5e",
          dark: "#141414",
        },
      },
      boxShadow: {
        soft: "0 12px 32px -24px rgb(15 23 42 / 0.35)",
      },
    },
  },
}

export default config

