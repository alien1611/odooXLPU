/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#f5f5f7',
          surface: '#ffffff',
          darkbg: '#0b0b0d',
          darksurface: '#16161a',
          subtle: '#86868b',
          border: 'rgba(0, 0, 0, 0.08)',
          darkborder: 'rgba(255, 255, 255, 0.08)',
        },
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706', // Primary warm amber accent
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          accent: '#d97706',
          accentHover: '#b45309',
          steel: '#475569'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.04)',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.07)',
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card': '0 2px 10px rgba(0, 0, 0, 0.02)',
      }
    },
  },
  plugins: [],
}
