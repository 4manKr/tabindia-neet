/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#123d63",
          strong: "#0a2844",
          ink: "#19324f",
        },
        brand: {
          orange: "#f26430",
          "orange-soft": "#ffb06d",
          gold: "#ffd6ab",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Arial", "sans-serif"],
        display: ["Bahnschrift", "Segoe UI", "Arial", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
};
