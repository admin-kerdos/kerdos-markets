import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", size: { width: 1280, height: 900 } },
  { name: "mobile", size: { width: 390, height: 844 } }
] as const;

const TOP_ROW_TO_TABS_MIN = 8;
const TOP_ROW_TO_TABS_MAX = 12;
const TABS_TO_DIVIDER_MIN = 4;
const TABS_TO_DIVIDER_MAX = 8;

test.describe("Hero header spacing and behavior", () => {
  for (const { name, size } of viewports) {
    test(`maintains tight header→tabs spacing on ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/");

      const topRow = page.getByTestId("hero-header-top-row");
      const tablist = page.getByRole("tablist", { name: "Segmentos de mercados destacados" });
      const divider = page.getByTestId("hero-divider");
      const tabs = tablist.getByRole("tab");

      await expect(topRow).toBeVisible();
      await expect(tablist).toBeVisible();
      await expect(divider).toBeVisible();

      const [topRowBox, tablistBox, dividerBox, tabBoxes] = await Promise.all([
        topRow.boundingBox(),
        tablist.boundingBox(),
        divider.boundingBox(),
        tabs.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()))
      ]);

      expect(topRowBox).not.toBeNull();
      expect(tablistBox).not.toBeNull();
      expect(dividerBox).not.toBeNull();
      expect(tabBoxes.length).toBeGreaterThan(0);

      if (topRowBox && tablistBox) {
        const spacing = tablistBox.y - (topRowBox.y + topRowBox.height);
        expect(spacing).toBeGreaterThanOrEqual(TOP_ROW_TO_TABS_MIN);
        expect(spacing).toBeLessThanOrEqual(TOP_ROW_TO_TABS_MAX);
      }

      if (tablistBox && dividerBox) {
        const dividerOffset = dividerBox.y - (tablistBox.y + tablistBox.height);
        expect(dividerOffset).toBeGreaterThanOrEqual(TABS_TO_DIVIDER_MIN);
        expect(dividerOffset).toBeLessThanOrEqual(TABS_TO_DIVIDER_MAX);
      }

      const flexWrap = await tablist.evaluate((node) => getComputedStyle(node).flexWrap);
      expect(flexWrap).toBe("nowrap");

      if (tabBoxes.length > 1) {
        const firstY = tabBoxes[0].y;
        for (const box of tabBoxes) {
          expect(Math.abs(box.y - firstY)).toBeLessThanOrEqual(2);
        }
      }

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(hasHorizontalOverflow).toBeFalsy();
    });
  }

  test("keeps the header sticky after scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const header = page.locator("header.AppHeader_header__HsCec");
    await expect(header).toHaveCSS("position", "sticky");

    const initialBox = await header.boundingBox();
    expect(initialBox).not.toBeNull();

    if (initialBox) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(150);
      const scrolledBox = await header.boundingBox();
      expect(scrolledBox).not.toBeNull();

      if (scrolledBox) {
        expect(Math.abs(scrolledBox.y - initialBox.y)).toBeLessThanOrEqual(2);
      }
    }
  });
});
