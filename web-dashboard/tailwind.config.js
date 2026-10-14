// SPDX-License-Identifier: MIT
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chirag: {
          primary: '#2E7D32',
          water: '#0277BD',
          warning: '#F9A825',
          alert: '#C62828',
          bg: '#FAFAF7',
          surface: '#FFFFFF',
          text: '#1B1B1B',
          muted: '#6B7280',
          border: '#E5E7EB',
        },
      },
      fontFamily: {
        sans: [
          'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
          '"Segoe UI"', 'Roboto', '"Noto Sans Devanagari"', 'sans-serif',
        ],
      },
      fontSize: {
        // Slightly larger defaults for readability.
        base: ['16px', { lineHeight: '1.55' }],
        lg: ['18px', { lineHeight: '1.5' }],
      },
      borderRadius: { card: '12px' },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.04)' },
    },
  },
  plugins: [],
};
