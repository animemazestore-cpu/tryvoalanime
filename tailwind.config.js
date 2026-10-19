/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#F8FAFC",
        'surface-dark': "#141416",
        'surface-muted': "#F4F4F5",
        border: "#E2E8F0",
        brand: {
          black: '#0D0D0E',
          dark: '#141416',
          surface: '#1E1E22',
          accent: '#E53E3E',
          yellow: '#F6C344',
          emerald: '#10B981',
        },
        primary: {
          DEFAULT: "#0D0D0E", // Sleek brand black
          dark: "#000000",
          light: "#F4F4F5",
          soft: "#E5E7EB",
          hover: "#1E1E22",
          accent: "#E53E3E", // Anime crimson accent
        },
        secondary: {
          DEFAULT: "#E53E3E", // Vibrant anime red
          dark: "#C53030",
          light: "#FFF5F5",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        text: {
          primary: "#0D0D0E",
          secondary: "#4B5563",
          muted: "#9CA3AF",
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'button': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'button-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  plugins: [],
}
