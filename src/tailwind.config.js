/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#7f66ff', // RGB: (127, 102, 255)
        'secondary-accent': '#9affff', // RGB: (154, 255, 255)
        'action-pink': '#ff3399', // RGB: (255, 51, 153)
        'warning-orange': '#f58b55', // RGB: (245, 139, 85)
        'danger-red': '#f25e65', // RGB: (242, 94, 101)
        'dark-background': '#261926', // RGB: (38, 25, 38)
        'light-text': '#ffffff', // RGB: (255, 255, 255)
      },
    },
  },
  plugins: [],
}
