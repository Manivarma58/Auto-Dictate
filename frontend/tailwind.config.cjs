/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': {
          DEFAULT: '#008b8b',
          light: '#00aaaa',
          dark: '#006666',
        },
        'secondary': {
          DEFAULT: '#000033',
          light: '#000066',
          dark: '#000022',
        },
        'very-dark-blue': '#000033',
        'dark-cyan': '#008b8b',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
