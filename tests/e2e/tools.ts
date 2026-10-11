import { expect, type Page } from '@playwright/test';

/** Phone layout keeps secondary controls in the bottom sheet. Desktop has no sheet. */
export async function openTools(page: Page) {
  const more = page.getByRole('button', { name: '更多', exact: true });
  if (!(await more.isVisible())) return;
  if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
  await expect(page.getByRole('region', { name: '更多功能' })).toBeVisible();
}

export async function closeTools(page: Page) {
  const more = page.getByRole('button', { name: '更多', exact: true });
  if (await more.isVisible() && (await more.getAttribute('aria-expanded')) === 'true') await more.click();
}
