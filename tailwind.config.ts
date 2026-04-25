import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          bg: "hsl(220 14% 4%)",
          grid: "hsl(220 14% 8%)",
          panel: "hsl(220 14% 7%)",
          border: "hsl(220 14% 12%)",
          ink: "hsl(220 10% 96%)",
          muted: "hsl(220 8% 60%)",
          subtle: "hsl(220 8% 40%)",
        },
        kind: {
          route: "hsl(214 95% 67%)",
          service: "hsl(160 70% 55%)",
          data: "hsl(45 95% 60%)",
          middleware: "hsl(280 70% 70%)",
          model: "hsl(190 80% 60%)",
          external: "hsl(0 0% 70%)",
          utility: "hsl(220 10% 65%)",
        },
        accent: {
          DEFAULT: "hsl(214 95% 67%)",
          danger: "hsl(0 75% 60%)",
          success: "hsl(142 70% 50%)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": "0.6875rem",
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
      },
      boxShadow: {
        node: "0 0 0 1px hsl(220 14% 14%), 0 4px 12px hsl(220 14% 2% / 0.5)",
        "node-selected":
          "0 0 0 1px hsl(214 95% 67%), 0 0 0 4px hsl(214 95% 67% / 0.18), 0 4px 16px hsl(220 14% 2% / 0.6)",
        panel: "0 8px 32px hsl(220 14% 2% / 0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(8px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "slide-in-right": "slide-in-right 160ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
