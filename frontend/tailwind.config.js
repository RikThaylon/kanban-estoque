/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#EEF3F6', 100: '#D9E4EA', 200: '#B6C9D3', 300: '#8BA8B6', 400: '#5D7F8E', 500: '#365E6E', 600: '#254B5A', 700: '#173746', 800: '#0E2733', 900: '#071820' },
        kanban: { verde: '#157A4E', 'verde-light': '#DDF8E8', amarelo: '#C07714', 'amarelo-light': '#FFF1C9', vermelho: '#C73333', 'vermelho-light': '#FFE1E1' },
        surface: { 50: '#F3F5F2', 100: '#E7ECE7', 200: '#CED9D3', 300: '#AEBDB7' },
        steel: { 50: '#F7F8F5', 100: '#E9EEE8', 200: '#D4DDD6', 300: '#AAB9B2', 400: '#72857D', 500: '#435852', 600: '#2E413E', 700: '#1F302F', 800: '#142322', 900: '#0A1515' },
        signal: { blue: '#2D6CDF', cyan: '#1A8A9E', green: '#0D8F59', amber: '#C57B13', red: '#C73535' },
        accent: '#D7F05B',
      },
      fontFamily: {
        sans: ['Aptos', 'Bahnschrift', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Bahnschrift', 'Aptos Display', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 18px 42px rgba(7, 24, 32, 0.10)',
        control: '0 8px 18px rgba(7, 24, 32, 0.08)',
      },
    },
  },
  plugins: [],
};
