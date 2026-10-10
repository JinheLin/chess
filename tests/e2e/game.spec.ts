import { test, expect } from '@playwright/test';
test('application opens', async ({page}) => { await page.goto('/'); await expect(page.getByRole('heading', {name:'Chess Lab'})).toBeVisible(); });
