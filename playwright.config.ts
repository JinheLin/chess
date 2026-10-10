import { defineConfig, devices } from '@playwright/test';
const production = process.env.PLAYWRIGHT_PRODUCTION === '1';
const port = production ? 5174 : 5173;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true,
  use: { baseURL: `http://127.0.0.1:${port}`, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure' },
  webServer: {
    command: production ? `npm run preview -- --host 127.0.0.1 --port ${port}` : 'npm run dev -- --host 127.0.0.1',
    url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI && !production,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
