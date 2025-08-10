import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: 'http://localhost:3000'
  },
  webServer: {
    command: 'bunx next dev -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: '../dashboard',
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      GITHUB_TOKEN: 'test-token',
      GITHUB_REPO_1: 'octocat/hello-world'
      // Add GITHUB_REPO_2 / GITHUB_REPO_3 if needed
    }
  }
});


