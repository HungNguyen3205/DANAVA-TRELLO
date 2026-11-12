/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      colors: {
        // Brand palette: navy + DANAVA orange. The purple-family palettes are remapped so
        // older purple/indigo/violet utility classes follow the brand instead of looking "AI purple".
        indigo: {
          50: '#EFF3FC', 100: '#DCE4F8', 200: '#BFCDF2', 300: '#94ABE8', 400: '#6584DA',
          500: '#4263C9', 600: '#2F4CB0', 700: '#263E91', 800: '#1E3170', 900: '#1A2856', 950: '#111A38',
        },
        purple: {
          50: '#EFF3FC', 100: '#DCE4F8', 200: '#BFCDF2', 300: '#94ABE8', 400: '#6584DA',
          500: '#4263C9', 600: '#2F4CB0', 700: '#263E91', 800: '#1E3170', 900: '#1A2856', 950: '#111A38',
        },
        violet: {
          50: '#EFF3FC', 100: '#DCE4F8', 200: '#BFCDF2', 300: '#94ABE8', 400: '#6584DA',
          500: '#4263C9', 600: '#2F4CB0', 700: '#263E91', 800: '#1E3170', 900: '#1A2856', 950: '#111A38',
        },
        fuchsia: {
          50: '#FFF4EC', 100: '#FFE4CF', 200: '#FEC69C', 300: '#FDA163', 400: '#F98A3F',
          500: '#F47624', 600: '#DC5F12', 700: '#B54A0E', 800: '#8F3B12', 900: '#743313', 950: '#3F1806',
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        kanban: {
          todo: {
            bg: "var(--col-todo-bg)",
            color: "var(--col-todo-color)"
          },
          progress: {
            bg: "var(--col-progress-bg)",
            color: "var(--col-progress-color)"
          },
          review: {
            bg: "var(--col-review-bg)",
            color: "var(--col-review-color)"
          },
          done: {
            bg: "var(--col-done-bg)",
            color: "var(--col-done-color)"
          }
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
