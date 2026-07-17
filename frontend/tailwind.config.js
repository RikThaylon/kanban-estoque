/** @type {import('tailwindcss').Config} */
// Redesign: Red & White Enterprise Identity
// Remoção completa do azul Brimajor — nova paleta vermelho/branco corporativo
const brand = {
  primary: '#C0182A',       // Vermelho principal (deep)
  primaryDeep: '#8F0F1E',   // Vermelho escuro (hover/focus)
  accent: '#E8213B',        // Vermelho vibrante (CTAs, badges)
  light: '#FFF0F2',         // Fundo levemente avermelhado
  sidebar: '#1A0508',       // Fundo sidebar — quase preto com toque vermelho
  black: '#0D0102',
  white: '#FFFFFF',
};

const redScale = {
  50: '#FFF0F2',
  100: '#FFE1E6',
  200: '#FFC4CD',
  300: '#FF95A5',
  400: '#F75B70',
  500: brand.accent,       // #E8213B
  600: brand.primary,      // #C0182A
  700: brand.primaryDeep,  // #8F0F1E
  800: '#6B0916',
  900: '#47060F',
  950: '#290306',
};

const neutralScale = {
  50: '#FFFFFF',
  100: '#F9F9FA',
  200: '#EBEBED',
  300: '#D1D1D6',
  400: '#8E8E96',
  500: '#636369',
  600: '#3C3C40',
  700: '#1E1E20',
  800: '#111113',
  900: '#07070A',
  950: '#000000',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      black: brand.black,
      white: brand.white,
      // Aliases principais do sistema
      primary: brand.primary,
      accent: brand.accent,
      brand: {
        primary: brand.primary,
        secondary: brand.black,
        accent: brand.accent,
        deep: brand.primaryDeep,
        neutral: brand.white,
        sidebar: brand.sidebar,
        light: brand.light,
      },
      // "navy" mapeado para neutralScale para garantir backdrops neutros e evitar fundos vermelhos nos modais
      navy: neutralScale,
      // Escala vermelha completa
      red: redScale,
      rose: redScale,
      // Neutros (surface / steel / gray)
      steel: neutralScale,
      surface: {
        50: '#FFFFFF',
        100: '#F9F9FA',
        200: '#EBEBED',
        300: '#D1D1D6',
        400: '#9E9EA6',
        500: '#636369',
      },
      gray: neutralScale,
      slate: neutralScale,
      zinc: neutralScale,
      neutral: neutralScale,
      stone: neutralScale,
      // Cores semânticas (status, alertas — mantidas)
      signal: {
        red: brand.primary,
        crimson: brand.accent,
        green: '#0B7A4B',
        amber: '#B86700',
        blue: '#2563EB',
      },
      // Kanban labels — mantidos para compatibilidade
      kanban: {
        verde: '#0B7A4B',
        'verde-light': '#E7F6EF',
        amarelo: '#B86700',
        'amarelo-light': '#FFF3D6',
        vermelho: '#CC2030',
        'vermelho-light': '#FFE8EB',
      },
      // Cores semânticas extras mantidas por uso nos componentes
      green: {
        50: '#E7F6EF', 100: '#CDEEDD', 200: '#9BDBBB', 300: '#5EC393',
        400: '#2EA66E', 500: '#0B7A4B', 600: '#08663F', 700: '#075033',
        800: '#053B27', 900: '#03291B', 950: '#02170F',
      },
      emerald: {
        50: '#E7F6EF', 100: '#CDEEDD', 200: '#9BDBBB', 300: '#5EC393',
        400: '#2EA66E', 500: '#0B7A4B', 600: '#08663F', 700: '#075033',
        800: '#053B27', 900: '#03291B', 950: '#02170F',
      },
      amber: {
        50: '#FFF7E5', 100: '#FFF3D6', 200: '#FFE2A3', 300: '#FFC969',
        400: '#F5A623', 500: '#D98400', 600: '#B86700', 700: '#8F4D00',
        800: '#663600', 900: '#432300', 950: '#261300',
      },
      yellow: {
        50: '#FFF9E8', 100: '#FFF3D6', 200: '#FFE8AD', 300: '#FFD36B',
        400: '#F8B82E', 500: '#D98400', 600: '#B86700', 700: '#8F4D00',
        800: '#663600', 900: '#432300', 950: '#261300',
      },
      orange: {
        50: '#FFF5ED', 100: '#FFE8D6', 200: '#FFD1AD', 300: '#FFAE73',
        400: '#F58634', 500: '#D96A00', 600: '#B85400', 700: '#8F3E00',
        800: '#642B00', 900: '#401B00', 950: '#241000',
      },
      // Blue mantido apenas para utilitários pontuais de terceiros (ex: Leaflet map)
      blue: {
        50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
        400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
        800: '#1E40AF', 900: '#1E3A8A', 950: '#172554',
      },
      // Violet/purple para categorias de produto e gráficos
      violet: {
        50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD',
        400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9',
        800: '#5B21B6', 900: '#4C1D95', 950: '#2E1065',
      },
      indigo: {
        50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
        400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
        800: '#3730A3', 900: '#312E81', 950: '#1E1B4B',
      },
      teal: {
        50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4',
        400: '#2DD4BF', 500: '#14B8A6', 600: '#0D9488', 700: '#0F766E',
        800: '#115E59', 900: '#134E4A', 950: '#042F2E',
      },
      cyan: {
        50: '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC', 300: '#67E8F9',
        400: '#22D3EE', 500: '#06B6D4', 600: '#0891B2', 700: '#0E7490',
        800: '#155E75', 900: '#164E63', 950: '#083344',
      },
      purple: {
        50: '#FAF5FF', 100: '#F3E8FF', 200: '#E9D5FF', 300: '#D8B4FE',
        400: '#C084FC', 500: '#A855F7', 600: '#9333EA', 700: '#7E22CE',
        800: '#6B21A8', 900: '#581C87', 950: '#3B0764',
      },
      pink: {
        50: '#FDF2F8', 100: '#FCE7F3', 200: '#FBCFE8', 300: '#F9A8D4',
        400: '#F472B6', 500: '#EC4899', 600: '#DB2777', 700: '#BE185D',
        800: '#9D174D', 900: '#831843', 950: '#500724',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 18px 46px rgba(100, 0, 20, 0.10)',
        control: '0 8px 18px rgba(192, 24, 42, 0.14)',
        focus: '0 0 0 4px rgba(232, 33, 59, 0.20)',
      },
    },
  },
  plugins: [],
};
