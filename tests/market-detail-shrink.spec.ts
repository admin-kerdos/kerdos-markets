import { expect, test } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";

const DETAIL_PATH = "/markets/cr-elecciones-ganador-2026";

const getScale = async (locator: Locator) => {
  const transform = await locator.evaluate((element) => getComputedStyle(element).transform);
  if (!transform || transform === "none") {
    return 1;
  }
  const match = transform.match(/matrix\(([^,]+),([^,]+),([^,]+),([^,]+),/);
  if (!match) {
    return 1;
  }
  const a = Number(match[1]);
  const b = Number(match[2]);
  const scale = Math.sqrt(a * a + b * b);
  return Number(scale.toFixed(3));
};

const measureOffsets = async (page: Page) => {
  return page.evaluate(() => {
    const hero = document.querySelector('[data-testid="market-hero"]') as HTMLElement | null;
    if (!hero) return null;
    return {
      offsetTop: hero.offsetTop,
      offsetLeft: hero.offsetLeft,
      viewportTop: hero.getBoundingClientRect().top
    };
  });
};

const getHorizontalOverflow = async (page: Page) => {
  return page.evaluate(() => Math.max(0, Math.round(document.body.scrollWidth - window.innerWidth)));
};

const measureSpacing = async (page: Page) => {
  return page.evaluate(() => {
    const hero = document.querySelector('[data-testid="market-hero"]') as HTMLElement | null;
    const chart = document.querySelector('[data-testid="market-chart-card"]') as HTMLElement | null;
    if (!(hero && chart)) return null;
    const heroRect = hero.getBoundingClientRect();
    const chartRect = chart.getBoundingClientRect();
    return {
      heroBottom: heroRect.bottom,
      chartTop: chartRect.top
    };
  });
};

test.describe("Market detail shrink-on-scroll", () => {
  test("image and title stay visible while scaling smoothly", async ({ page }) => {
    await page.goto(DETAIL_PATH);

    const hero = page.getByTestId("market-hero");
    const title = page.getByTestId("market-hero-title");
    const image = page.getByTestId("market-hero-image");

    await expect(hero).toBeVisible();
    await expect(title).toBeVisible();
    await expect(image).toBeVisible();

    const initialScale = await getScale(hero);
    expect(initialScale).toBeCloseTo(1, 2);

    const initialOffsets = await measureOffsets(page);
    expect(initialOffsets).not.toBeNull();

    const spacing = await measureSpacing(page);
    expect(spacing).not.toBeNull();
    expect(spacing!.chartTop).toBeGreaterThan(spacing!.heroBottom + 16);

    await page.evaluate(() => window.scrollTo({ top: 220 }));
    await page.waitForTimeout(160);

    const midScale = await getScale(hero);
    expect(midScale).toBeLessThan(1);
    expect(midScale).toBeGreaterThan(0.78);

    await page.evaluate(() => window.scrollTo({ top: 520 }));
    await page.waitForTimeout(160);

    const finalScale = await getScale(hero);
    expect(finalScale).toBeLessThanOrEqual(0.81);
    expect(finalScale).toBeGreaterThanOrEqual(0.78);
    expect(midScale).toBeGreaterThanOrEqual(finalScale);

    const finalOffsets = await measureOffsets(page);
    expect(finalOffsets).not.toBeNull();
    expect(finalOffsets?.offsetTop).toBe(initialOffsets?.offsetTop);
    expect(finalOffsets?.offsetLeft).toBe(initialOffsets?.offsetLeft);
    expect(finalOffsets?.viewportTop ?? 0).toBeLessThanOrEqual(initialOffsets?.viewportTop ?? 0);

    const overflow = await getHorizontalOverflow(page);
    expect(overflow).toBe(0);

    await expect(title).toBeVisible();
    await expect(image).toBeVisible();
  });

  test("no horizontal overflow across breakpoints", async ({ page }) => {
    const widths = [360, 768, 1280];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(DETAIL_PATH);
      const overflow = await getHorizontalOverflow(page);
      expect(overflow).toBe(0);
    }
  });
});
