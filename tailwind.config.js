/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#140B16',       // fundo base (preto ameixa)
        plum: '#1E1222',      // superfícies
        seam: '#3A2740',      // linhas e bordas
        bone: '#F4EAF0',      // texto principal
        haze: '#B09AAE',      // texto secundário
        orchid: '#B98AFF',    // ações
        wine: '#8E2C4A',      // alertas / destaque quente
        champagne: '#E7C9A1', // marca
      },
      fontFamily: {
        display: ['"Bodoni Moda"', 'Didot', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
