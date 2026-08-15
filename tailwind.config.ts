import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta editorial: marfil / blanco cálido con acento configurable por CSS var.
        ivory: {
          DEFAULT: "#FBF8F3",
          50: "#FEFDFB",
          100: "#FBF8F3",
          200: "#F3ECE1",
        },
        ink: {
          DEFAULT: "#2A2622",
          soft: "#5A534B",
          faint: "#8A8178",
        },
        accent: {
          // Sobrescribible por evento vía --accent en runtime.
          DEFAULT: "var(--accent, #8C7B6B)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      maxWidth: {
        content: "34rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
