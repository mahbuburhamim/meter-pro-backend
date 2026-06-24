/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nesco: {
          light: '#2ecc71',
          DEFAULT: '#27ae60',
          dark: '#1e824c',
        }
      }
    },
  },
  plugins: [],
}
