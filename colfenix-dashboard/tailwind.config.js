/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        card: 'var(--bg-card)',
        hover: 'var(--bg-hover)',
        input: 'var(--bg-input)',
        accent: 'var(--accent-primary)',
        'accent-2': 'var(--accent-secondary)',
        danger: 'var(--accent-danger)',
        warn: 'var(--accent-warn)',
        success: 'var(--accent-success)',
        'danger-soft': 'var(--accent-danger-soft)',
        'warn-soft': 'var(--accent-warn-soft)',
        'success-soft': 'var(--accent-success-soft)',
        'accent-glow': 'var(--accent-glow)',
        ink: 'var(--text-primary)',
        'ink-soft': 'var(--text-secondary)',
        'ink-faint': 'var(--text-muted)',
        link: 'var(--text-link)',
        line: 'var(--border)',
        'line-accent': 'var(--border-accent)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        accent: 'var(--shadow-accent)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
