/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        surface: {
          base: '#FAFAFA',
          card: '#FFFFFF',
          elevated: '#F5F5F5',
          overlay: 'rgba(0,0,0,0.5)',
        },
        ink: {
          primary: '#111111',
          secondary: '#555555',
          tertiary: '#888888',
          disabled: '#BBBBBB',
        },
        edge: {
          default: '#E5E5E5',
          strong: '#CCCCCC',
          subtle: '#F0F0F0',
        },
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
        input: '8px',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)',
        float: '0 10px 25px rgba(0,0,0,.12), 0 4px 10px rgba(0,0,0,.08)',
        modal: '0 25px 50px rgba(0,0,0,.15), 0 10px 20px rgba(0,0,0,.1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        slideUp: 'slideUp 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
};
