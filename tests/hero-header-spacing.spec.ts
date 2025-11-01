import { expect, test } from "@playwright/test";

const viewports = [
  {
    name: "desktop",
    size: { width: 1280, height: 900 },
    minSpacing: 24
  },
  {
    name: "mobile",
    size: { width: 360, height: 780 },
    minSpacing: 14
  }
] as const;

test.describe("Hero header spacing and behavior", () => {
  for (const { name, size, minSpacing } of viewports) {
    test(`maintains enhanced spacing between header and tabs on ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/");

      const topRow = page.getByTestId("hero-header-top-row");
      const navGroup = page.getByTestId("hero-nav-group");
      const divider = page.getByTestId("hero-divider");
      const tablist = page.getByRole("tablist", { name: "Segmentos de mercados destacados" });

      const [topRowBox, navGroupBox, tablistBox, dividerBox] = await Promise.all([
        topRow.boundingBox(),
        navGroup.boundingBox(),
        tablist.boundingBox(),
        divider.boundingBox()
      ]);

      expect(topRowBox).not.toBeNull();
      expect(navGroupBox).not.toBeNull();
      expect(tablistBox).not.toBeNull();
      expect(dividerBox).not.toBeNull();

      if (topRowBox && navGroupBox) {
        const spacing = navGroupBox.y - (topRowBox.y + topRowBox.height);
        expect(spacing).toBeGreaterThanOrEqual(minSpacing);
      }

      if (tablistBox && dividerBox) {
        const dividerOffset = dividerBox.y - (tablistBox.y + tablistBox.height);
        expect(dividerOffset).toBeGreaterThanOrEqual(0);
        expect(dividerOffset).toBeLessThanOrEqual(12);
      }
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
