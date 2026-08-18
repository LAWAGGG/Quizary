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
        gray: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        ink: {
          DEFAULT: '#1F2937',
          950: '#111827',
          900: '#1F2937',
          800: '#374151',
          700: '#4B5563',
          600: '#6B7280',
          500: '#9CA3AF',
        },
        primary: {
          DEFAULT: '#6C5CE7',
          50: '#F0EFFF',
          100: '#D5D0FA',
          200: '#B8B0F5',
          300: '#9B90F0',
          400: '#7E70EB',
          500: '#6C5CE7',
          600: '#5A4BD4',
          700: '#4A3DBF',
          800: '#3C30A8',
          900: '#2F2690',
        },
        paper: {
          DEFAULT: '#F4F5F7',
        },
        correct: {
          DEFAULT: '#10B981',
          soft: '#ECFDF5',
        },
        incorrect: {
          DEFAULT: '#EF4444',
          soft: '#FEF2F2',
        },
        warn: {
          DEFAULT: '#F59E0B',
          soft: '#FEF3C7',
        },
        surface: '#FFFFFF',
        'text-primary': '#1F2937',
        'text-inverse': '#FFFFFF',
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 6px 16px -6px rgba(15,23,42,0.08)',
        lift: '0 2px 4px rgba(15,23,42,0.05), 0 16px 32px -12px rgba(15,23,42,0.18)',
        chip: '0 1px 2px rgba(15,23,42,0.16)',
      },
    },
  },
  plugins: [],
}
