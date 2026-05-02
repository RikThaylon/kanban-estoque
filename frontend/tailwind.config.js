/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#E8EDF2', 100: '#C5D0DE', 200: '#9BAFC5', 300: '#7090AC', 400: '#4F7999', 500: '#2E6286', 600: '#1E4F6F', 700: '#0F2D4A', 800: '#0A1F33', 900: '#05101A' },
        kanban: { verde: '#1A5C36', 'verde-light': '#D1FAE5', amarelo: '#B45309', 'amarelo-light': '#FEF3C7', vermelho: '#DC2626', 'vermelho-light': '#FEE2E2' },
        surface: { 50: '#F4F7FA', 100: '#E8EDF3', 200: '#D1DBE7' },
      },
      fontFamily: {
        sans: ['Inter', 'Calibri', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
