/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
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
        neutral: {
          white: 'var(--neutral-white, #FFFFFF)',
          50: 'var(--neutral-50, #FAFAFA)',
          100: 'var(--neutral-100, #F4F4F4)',
          200: 'var(--neutral-200, #EAEAEA)',
          300: 'var(--neutral-300, #D9D9D9)',
          400: 'var(--neutral-400, #BBBBBB)',
          500: 'var(--neutral-500, #888888)',
          600: 'var(--neutral-600, #555555)',
          700: 'var(--neutral-700, #333333)',
          800: 'var(--neutral-800, #1C1C1C)',
          900: 'var(--neutral-900, #111111)',
        },
        surface: {
          base: 'var(--bg-base, #FAFAFA)',
          card: 'var(--surface-card, #FFFFFF)',
          elevated: 'var(--surface-elevated, #F4F4F4)',
          recessed: 'var(--surface-recessed, #F4F4F4)',
          sidebar: 'var(--surface-sidebar, #F4F4F4)',
          overlay: 'var(--surface-overlay, rgba(0,0,0,0.5))',
        },
        ink: {
          primary: 'var(--ink-primary, #111111)',
          secondary: 'var(--ink-secondary, #555555)',
          tertiary: 'var(--ink-tertiary, #888888)',
          muted: 'var(--ink-muted, #555555)',
          disabled: 'var(--ink-disabled, #888888)',
        },
        edge: {
          default: 'var(--edge-default, #EAEAEA)',
          strong: 'var(--edge-strong, #D9D9D9)',
          subtle: 'var(--edge-subtle, #F4F4F4)',
          dark: 'var(--edge-dark, #333333)',
        },
        btn: {
          primary: 'var(--btn-primary-bg, #111111)',
          'primary-text': 'var(--btn-primary-text, #FFFFFF)',
          secondary: 'var(--btn-secondary-bg, #FFFFFF)',
          'secondary-text': 'var(--btn-secondary-text, #111111)',
        },
      },
      maxWidth: {
        reading: '760px',
        standard: '1120px',
        wide: '1360px',
        shell: '1760px',
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
