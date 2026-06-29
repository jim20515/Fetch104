import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#18212f',
        muted: '#657083',
        line: '#d9dee8',
        surface: '#f7f8fb',
        teal: '#0f766e',
        coral: '#e45d4f',
        amber: '#b7791f'
      },
      boxShadow: {
        soft: '0 12px 35px rgba(24, 33, 47, 0.08)'
      }
    }
  },
  plugins: []
}
