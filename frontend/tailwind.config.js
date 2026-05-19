/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#F7F7F7', 100: '#E8E8E8', 200: '#CFCFCF', 300: '#AFAFAF', 400: '#808080', 500: '#5C5C5C', 600: '#3D3D3D', 700: '#262626', 800: '#161616', 900: '#050505' },
        kanban: { verde: '#157A4E', 'verde-light': '#DDF8E8', amarelo: '#C07714', 'amarelo-light': '#FFF1C9', vermelho: '#C73333', 'vermelho-light': '#FFE1E1' },
        surface: { 50: '#FFFFFF', 100: '#F4F4F4', 200: '#E1E1E1', 300: '#C7C7C7' },
        steel: { 50: '#FFFFFF', 100: '#F4F4F4', 200: '#E1E1E1', 300: '#C7C7C7', 400: '#8A8A8A', 500: '#5C5C5C', 600: '#3D3D3D', 700: '#262626', 800: '#161616', 900: '#050505' },
        signal: { blue: '#265ECF', cyan: '#177A8C', green: '#087A4A', amber: '#B86C0C', red: '#D71920' },
        accent: '#D71920',
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
