/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#FBFBFE",
                surface: "#FFFFFF",
                primary: "#0F172A",
                secondary: "#2D3748",
                accent: "#2563EB",
                border: "#E2E8F0",
                text: {
                    main: "#0F172A",
                    muted: "#64748B",
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
