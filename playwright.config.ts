import { defineConfig, devices } from '@playwright/test';
const production = process.env.PLAYWRIGHT_PRODUCTION === '1';
const port = production ? 5174 : 5173;
const remoteURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: 2,
  reporter: [['list'], ['html', {open:'never'}]],
  forbidOnly: !!process.env.CI,
  use: { baseURL: remoteURL || `http://127.0.0.1:${port}${production ? '/chess/' : '/'}`, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure' },
  webServer: remoteURL ? undefined : {
    command: production ? 'node scripts/serve-dist.mjs' : 'npm run dev -- --host 127.0.0.1',
    url: `http://127.0.0.1:${port}${production ? '/chess/' : '/'}`, reuseExistingServer: !process.env.CI && !production,
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
