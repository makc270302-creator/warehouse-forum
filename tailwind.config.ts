import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#3a0712",
        steel: "#6f3f49",
        cloud: "#fbf4f1",
        line: "#ead4cf",
        mint: "#b11226",
        amber: "#c47a12",
        coral: "#7f1024"
      },
      boxShadow: {
        panel: "0 8px 24px rgba(58, 7, 18, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
