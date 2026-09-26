/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5fa',
          100: '#e1ecf5',
          500: '#1d4ed8',
          600: '#1e40af',
          700: '#1d3557',
          800: '#0f172a',
          900: '#020617',
        },
        erp: {
          surface: '#ffffff',
          subtle: '#f8fafc',
          border: '#e2e8f0',
          muted: '#64748b',
          dark: '#0f172a',
          sidebar: '#090d16',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
