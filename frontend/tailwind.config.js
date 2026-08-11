/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1C8DCD',
          'blue-dark': '#146ca1',
          'blue-light': '#3ab2f6',
          orange: '#F68D20',
          'orange-dark': '#d47311',
          'orange-light': '#ffa84d',
        },
        slate: {
          850: '#151e2e',
          950: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
