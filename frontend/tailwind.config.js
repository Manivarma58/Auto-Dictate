/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#22d3ee', // Electric Cyan
        'secondary': '#0f172a', // Deep Slate
        'accent': '#22d3ee', // High-Contrast Highlight
        'midnight': '#020617', // Absolute Obsidian
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
