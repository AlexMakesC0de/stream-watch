/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool near-black ground through to near-white. Every step is tuned so
        // secondary text clears 4.5:1 on the 950 ground: 400 reads 7.6:1,
        // 500 reads 5.1:1. Retinting here re-skins the whole app at once.
        dark: {
          50: '#f5f7fa',
          100: '#e9ecf2',
          200: '#d6dbe5',
          300: '#b8bfce',
          400: '#9aa2b4',
          500: '#79839a',
          600: '#2b3140',
          700: '#1f2431',
          800: '#151824',
          900: '#0f121a',
          950: '#0b0d13'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
          dark: 'var(--color-accent-dark)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
