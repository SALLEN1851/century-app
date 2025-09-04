/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: false,                           // <— important since you use `dark:`
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        grava: {
          charcoal: '#1C1C1C',
          stone: '#3B3B3B',
          taupe: '#7A7265',
          ember: '#F97316',
          amber: '#FFB648',
          sage: '#4CAF50',
          sky: '#38BDF8',
          sand: '#E5D9C5',
          steel: '#3A5F7D',
          crimson: '#DC2626',
        },
      },
      boxShadow: {
        soft: '0 10px 25px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}
