/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.{ejs,html,js}",
    "./public/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#333434',
          hover: '#1e1f1f',
          container: '#4a4a4a'
        },
        secondary: {
          DEFAULT: '#5d5e5f',
          container: '#e0dfdf'
        },
        surface: {
          DEFAULT: '#f7f9ff',
          card: '#ffffff',
          tint: '#edf4ff',
          container: '#e3efff',
          high: '#d8eaff',
          dim: '#c7dcf4'
        },
        inverse: {
          DEFAULT: '#1e3244',
          ink: '#e8f2ff'
        },
        ink: {
          DEFAULT: '#071d2e',
          secondary: '#444748',
          muted: '#52585c'
        },
        line: {
          DEFAULT: '#c4c7c7',
          subtle: '#e8ecf2'
        },
        status: {
          success: '#3a6b35',
          'success-tint': '#e6f0e5',
          info: '#3b6b93',
          'info-tint': '#e3efff',
          warning: '#8a6d2a',
          'warning-tint': '#f5f0dc',
          danger: '#a13225',
          'danger-tint': '#fde8e5'
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px'
      }
    }
  },
  plugins: []
};
