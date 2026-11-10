/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Archivo', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        // Explicit monospace stack — used for RotatingWords word line and the AI wordmark
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
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
      fontSize: {
        display: ['clamp(3rem, 9vw, 9rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
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
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'word-slide': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '20%': { transform: 'translateY(0)', opacity: '1' },
          '80%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
        lift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-2px)' },
        },
        'section-reveal': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'vignette-fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'badge-opacity': {
          '0%': { opacity: '0' },
          '25%': { opacity: '1' },
          '75%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'highlight-pulse': {
          '0%': { backgroundColor: '#E5E5E5' },
          '50%': { backgroundColor: '#CCCCCC' },
          '100%': { backgroundColor: '#E5E5E5' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out forwards',
        slideUp: 'slideUp 0.4s ease-out forwards',
        marquee: 'marquee 20s linear infinite',
        'word-slide': 'word-slide 2.5s ease-in-out infinite',
        lift: 'lift 0.18s ease-out forwards',
        'section-reveal': 'section-reveal 0.6s ease-out forwards',
        'vignette-fade': 'vignette-fade 1.2s ease-out forwards',
        'badge-opacity': 'badge-opacity 9s ease-in-out infinite',
        'highlight-pulse': 'highlight-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
