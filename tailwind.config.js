/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: 'rgb(var(--color-background) / <alpha-value>)',
                surface: 'rgb(var(--color-surface) / <alpha-value>)',
                surfaceHover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
                border: 'rgb(var(--color-border) / <alpha-value>)',
                primary: 'rgb(var(--color-primary) / <alpha-value>)',
                primaryGlow: 'rgb(var(--color-primary-glow) / <alpha-value>)',
                secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
                textMain: 'rgb(var(--color-text-main) / <alpha-value>)',
                textMuted: 'rgb(var(--color-text-muted) / <alpha-value>)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'monospace']
            },
            boxShadow: {
                'glow': '0 0 20px rgb(var(--color-primary-glow) / 0.35)',
            }
        },
    },
    plugins: [],
}