import { test, expect } from '@playwright/test';
import { fixtureZip, fixtureFiles } from './shapefile-fixture.js';
test('sample report, filters, focus, CSV export, and parameter invalidation', async ({ page }) => {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('#analyze')).toBeDisabled();
 await page.locator('#demo').click(); await expect(page.locator('#total')).toHaveText('8');
 await expect(page.locator('#clash-total')).toHaveText('1');await expect(page.locator('#review-total')).toHaveText('2');await expect(page.locator('#clear-total')).toHaveText('5');
 await page.locator('[data-filter="clash"]').click();await expect(page.locator('#results tr')).toHaveCount(1);
 await page.locator('.inspect').click();await expect(page.locator('#crossing-detail')).toContainText('vertical overlap');
 await page.locator('#top').click();await page.locator('#fit').click();
 await page.locator('#exaggeration').selectOption('5');
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('conduit-crossing-report.csv');
 const stream=await download.createReadStream();let text='';for await(const chunk of stream) text+=chunk.toString();expect(text).toContain('STM-101');expect(text.split('\r\n')).toHaveLength(9);
 await page.locator('#minimum').fill('0.5');await page.locator('#minimum').blur();await expect(page.locator('#export')).toBeDisabled();await expect(page.locator('#results tr')).toHaveCount(0);
 await page.locator('#analyze').click();await expect(page.locator('#review-total')).toHaveText('3');
 expect(errors).toEqual([]);
});
test('imports zipped SHP and DBF and computes known 0.5 m clash', async ({page}) => {
 await page.goto('/');await page.locator('#file-input').setInputFiles({name:'network.zip',mimeType:'application/zip',buffer:fixtureZip()});
 await expect(page.locator('#map-up')).toHaveValue('US_Invert');await expect(page.locator('#map-down')).toHaveValue('DS_Invert');
 await page.locator('#analyze').click();await expect(page.locator('#total')).toHaveText('1');await expect(page.locator('.clearance')).toHaveText('-0.500');await expect(page.locator('.status-pill')).toHaveText('Clash');
});
test('imports loose files and rejects geographic coordinates and missing DBF', async ({page}) => {
 await page.goto('/');const files=fixtureFiles();
 await page.locator('#file-input').setInputFiles(Object.entries(files).map(([name,buffer])=>({name,mimeType:'application/octet-stream',buffer:Buffer.from(buffer)})));
 await expect(page.locator('#file-title')).toHaveText('conduits.shp');
 await page.locator('#file-input').setInputFiles({name:'geographic.zip',mimeType:'application/zip',buffer:fixtureZip(true)});
 await expect(page.locator('#upload-status')).toContainText('longitude/latitude');
 await page.locator('#file-input').setInputFiles({name:'conduits.shp',mimeType:'application/octet-stream',buffer:files['conduits.shp']});
 await expect(page.locator('#upload-status')).toContainText('.dbf attribute file is missing');
});
test('mobile layout fits viewport and supports sample analysis',async ({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#demo').click();await expect(page.locator('#total')).toHaveText('8');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/conduit-mobile.png',fullPage:true});
});
test('defaults to INOFFSET/OUTOFFSET and offers diameter or required box height/width', async ({page}) => {
 await page.goto('/');
 await page.locator('#file-input').setInputFiles({name:'offsets.zip',mimeType:'application/zip',buffer:fixtureZip(false,true)});
 await expect(page.locator('#map-up')).toHaveValue('INOFFSET');await expect(page.locator('#map-down')).toHaveValue('OUTOFFSET');
 await expect(page.locator('#height-caption')).toHaveText('Pipe diameter');await expect(page.locator('#map-width')).toBeHidden();await expect(page.locator('#map-width')).toBeDisabled();
 await page.locator('#shape').selectOption('rectangular');await expect(page.locator('#height-caption')).toHaveText('Pipe height');await expect(page.locator('#map-width')).toBeVisible();await expect(page.locator('#map-width')).toHaveValue('Geom2');
 await page.locator('#map-width').selectOption('');await page.locator('#analyze').click();await expect(page.locator('#toast')).toContainText('Map the pipe width');await expect(page.locator('#total')).toHaveText('—');
 await page.locator('#map-width').selectOption('Geom2');await page.locator('#analyze').click();await expect(page.locator('#total')).toHaveText('1');await expect(page.locator('.clearance')).toHaveText('-0.500');
 await expect(page.locator('#issues')).toContainText('offsets above node inverts');
 await page.locator('#shape').selectOption('circular');await expect(page.locator('#export')).toBeDisabled();await expect(page.locator('#map-width')).toBeHidden();await page.locator('#analyze').click();await expect(page.locator('#total')).toHaveText('1');
});
