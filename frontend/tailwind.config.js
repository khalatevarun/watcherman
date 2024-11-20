const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'off-black': '#091717',
        'inky-blue': '#133B39',
        'peacock': '#2E5E5A',
        'turquoise': '#20808D',
        'plex-blue': '#25EE5A',
        'sky': '#20805D',
        'paper-white': '#FFAF4',
        'ecru': '#E4E3D4',
        'apricot': '#FFD2A6',
        'terra-cotta': '#AA4B2F',
        'boysenberry': '#944464'
      }
    },
  },
  plugins: [],
};

export default config;