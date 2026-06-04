/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#e8f0fb',
          100: '#c5d6f5',
          500: '#3266ad',
          600: '#2756a0',
          700: '#185FA5',
          900: '#0c3d7a',
        },
        success: { 50: '#E1F5EE', 500: '#1D9E75', 700: '#0F6E56' },
        warning: { 50: '#FAEEDA', 500: '#BA7517', 700: '#854F0B' },
        danger:  { 50: '#FCEBEB', 500: '#E24B4A', 700: '#A32D2D' },
      },
      borderRadius: {
        xl: '14px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
