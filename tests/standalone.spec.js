import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fixtureZip } from './shapefile-fixture.js';
test('downloaded HTML imports, analyzes, renders, and exports without a server or network', async ({ page, context }) => {
  const errors = [], remoteRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await context.setOffline(true);
  // The managed test browser blocks file:// URLs. Load the exact downloaded
  // document into an isolated blank page without serving it over HTTP.
  await page.setContent(readFileSync(resolve('standalone/index.html'), 'utf8'));
  await page.locator('#demo').click();
  await expect(page.locator('#total')).toHaveText('8');
  await expect(page.locator('#viewer canvas')).toBeVisible();
  await expect(page.locator('.webgl-error')).toHaveCount(0);
  await page.locator('[data-filter="clash"]').click();
  await page.locator('.inspect').click();
  await expect(page.locator('#crossing-detail')).toContainText('vertical overlap');
  await page.locator('#top').click();
  await page.locator('#fit').click();
  await page.locator('#file-input').setInputFiles({ name: 'network.zip', mimeType: 'application/zip', buffer: fixtureZip() });
  await expect(page.locator('#map-up')).toHaveValue('US_Invert');
  await page.locator('#analyze').click();
  await expect(page.locator('#total')).toHaveText('1');
  await expect(page.locator('.clearance')).toHaveText('-0.500');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let text = ''; for await (const chunk of stream) text += chunk.toString();
  expect(text).toContain('P-A'); expect(text).toContain('-0.5');
  expect(errors).toEqual([]); expect(remoteRequests).toEqual([]);
});
