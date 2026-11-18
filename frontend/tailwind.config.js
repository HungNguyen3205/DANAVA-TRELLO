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
        sans: ['"Be Vietnam Pro"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"UTM Eremitage"', '"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
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
        // DANAVA design-system tokens (see :root in src/index.css)
        ds: {
          bg: "var(--bg)",
          cream: "var(--cream)",
          ink: "var(--ink)",
          text: "var(--text)",
          line: "var(--line)",
          blue: "var(--blue)",
          "blue-2": "var(--blue-2)",
          "blue-soft": "var(--blue-soft)",
          sky: "var(--sky)",
          "sky-soft": "var(--sky-soft)",
          amber: "var(--amber)",
          "amber-soft": "var(--amber-soft)",
          orange: "var(--orange)",
          red: "var(--red)",
          "red-text": "var(--red-text)",
          green: "var(--green)",
          "green-soft": "var(--green-soft)",
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
      // Larger, softer corners: 2xl = --r (20px), 3xl = --r-lg (28px)
      borderRadius: {
        sm: "8px",
        DEFAULT: "6px",
        md: "10px",
        lg: "var(--r-sm)",
        xl: "16px",
        "2xl": "var(--r)",
        "3xl": "var(--r-lg)",
        pill: "var(--pill)",
      },
      // Soft navy-tinted shadows (literal values so coloured shadow utilities still work)
      boxShadow: {
        "2xs": "0 1px 2px #18234f0a",
        xs: "0 1px 2px #18234f0a, 0 2px 8px -4px #18234f14",
        sm: "0 1px 2px #18234f0a, 0 4px 14px -6px #18234f14",
        DEFAULT: "0 1px 2px #18234f0a, 0 4px 14px -6px #18234f14",
        md: "0 2px 6px #18234f0a, 0 18px 40px -18px #2b429433",
        lg: "0 2px 6px #18234f0a, 0 18px 40px -18px #2b429433",
        xl: "0 4px 10px #18234f0d, 0 34px 70px -28px #2b429455",
        "2xl": "0 4px 10px #18234f0d, 0 34px 70px -28px #2b429455",
        amber: "0 10px 24px -10px #f2850ecc",
      },
      transitionTimingFunction: {
        ds: "cubic-bezier(.22,.8,.24,1)",
        spring: "cubic-bezier(.3,1.45,.5,1)",
      },
      backgroundImage: {
        "grad-cta": "var(--grad-cta)",
        "grad-blue": "var(--grad-blue)",
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
