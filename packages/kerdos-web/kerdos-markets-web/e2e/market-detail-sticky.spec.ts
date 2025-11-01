import { test, expect } from "@playwright/test";

test("market detail page header shrinks and sticks on scroll", async ({ page }) => {
  await page.goto("/markets/cr-elecciones-ganador-2026");
  await page.waitForSelector("[data-market-subheader]");
  const hero = page.locator("[data-market-subheader]");
  await expect(hero).toBeVisible();

  // Get initial position and header height
  const [initialTop, headerHeight] = await page.evaluate(() => {
    const el = document.querySelector("[data-market-subheader]");
    if (!el) throw new Error("sticky hero not found");
    const header = document.querySelector("header[data-app-header]");
    const hh = header instanceof HTMLElement ? header.offsetHeight : 65;
    return [el.getBoundingClientRect().top, hh] as const;
  });

  // Expect initial top to be close to header height
  expect(Math.abs(initialTop - headerHeight)).toBeLessThanOrEqual(5); // Allowing for a small margin of error

  // Scroll down
  await page.evaluate(() => {
    window.scrollTo(0, 500); // Scroll down by 500px
  });
  await page.waitForTimeout(100); // Give some time for the scroll and animation to settle

  // Verify sticky position
  const [stickyTop, currentScale] = await page.evaluate(() => {
    const el = document.querySelector("[data-market-subheader]");
    if (!el) throw new Error("sticky hero not found");
    const transformMatrix = getComputedStyle(el).transform;
    const scaleMatch = transformMatrix.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    return [el.getBoundingClientRect().top, scale] as const;
  });

  // Expect the element to be sticky at the top (or very close to it)
  expect(Math.abs(stickyTop - headerHeight)).toBeLessThanOrEqual(5);

  // Verify scaling
  expect(currentScale).toBeLessThan(1);
  expect(currentScale).toBeGreaterThanOrEqual(0.8); // Assuming 0.8 is the minimum scale
});
