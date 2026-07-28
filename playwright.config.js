const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory dist',
    port: 4173,
    reuseExistingServer: false,
  },
});
