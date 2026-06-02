import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d8dee8",
        ocean: "#2563eb",
        mint: "#15a46b",
        amber: "#d97706",
        rose: "#e11d48",
        violet: "#7c3aed",
        smoke: "#f3f5f8"
      },
      boxShadow: {
        panel: "0 14px 40px rgba(23, 32, 42, 0.12)",
        card: "0 8px 24px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
