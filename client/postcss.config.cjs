// Conditional PostCSS config to avoid LightningCSS issues in CI
let plugins = [];

if (!process.env.CI) {
  try {
    const tailwindcss = require('@tailwindcss/postcss');
    plugins.push(tailwindcss);
  } catch (error) {
    console.warn('Failed to load Tailwind CSS, skipping...');
  }
}

module.exports = {
  plugins
};
