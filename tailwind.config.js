/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1E51A2',
          orange: '#F3981E',
          white: '#FFFFFF',
          slate: '#F8FAFC'
        }
      }
    },
  },
  plugins: [],
}