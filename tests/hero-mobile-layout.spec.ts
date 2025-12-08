import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "390x844", size: { width: 390, height: 844 } },
  { name: "360x640", size: { width: 360, height: 640 } }
];

for (const viewport of VIEWPORTS) {
  test.describe(`Hero mobile layout ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport.size);
      await page.goto("/");
    });

    test("single-option actions remain centered without overflow", async ({ page }) => {
      const singleCard = page
        .getByTestId("hero-preview-card")
        .filter({
          has: page.getByTestId("hero-preview-actions")
        })
        .first();

      await expect(singleCard).toBeVisible();

      const cardBox = await singleCard.boundingBox();
      expect(cardBox).not.toBeNull();
      if (!cardBox) return;

      const actions = singleCard.getByTestId("hero-preview-actions");
      await expect(actions).toBeVisible();
      await expect(actions).toHaveCSS("display", "grid");

      const gridTemplate = await actions.evaluate((node) => getComputedStyle(node).gridTemplateColumns);
      const columnMatches = gridTemplate.match(/1fr/g) ?? [];
      expect(columnMatches.length).toBe(2);

      const actionsBox = await actions.boundingBox();
      expect(actionsBox).not.toBeNull();
      if (!actionsBox) return;

      const buttons = actions.getByRole("button");
      await expect(buttons).toHaveCount(2);

      const [yesBox, noBox, yesComputedHeight, noComputedHeight] = await Promise.all([
        buttons.nth(0).boundingBox(),
        buttons.nth(1).boundingBox(),
        buttons.nth(0).evaluate((element) => getComputedStyle(element).height),
        buttons.nth(1).evaluate((element) => getComputedStyle(element).height)
      ]);

      expect(yesBox).not.toBeNull();
      expect(noBox).not.toBeNull();
      if (!yesBox || !noBox) return;

      expect(Math.abs(yesBox.y - noBox.y)).toBeLessThanOrEqual(6);
      expect(Math.abs(yesBox.height - noBox.height)).toBeLessThanOrEqual(2);
      const yesHeightValue = Number.parseFloat(yesComputedHeight);
      const noHeightValue = Number.parseFloat(noComputedHeight);
      expect(yesHeightValue).toBeGreaterThanOrEqual(32);
      expect(yesHeightValue).toBeLessThanOrEqual(40);
      expect(noHeightValue).toBeGreaterThanOrEqual(32);
      expect(noHeightValue).toBeLessThanOrEqual(40);

      const maxButtonWidth = cardBox.width * 0.9;
      expect(yesBox.width).toBeLessThanOrEqual(maxButtonWidth);
      expect(noBox.width).toBeLessThanOrEqual(maxButtonWidth);

      const centerOffset = Math.abs(actionsBox.x + actionsBox.width / 2 - (cardBox.x + cardBox.width / 2));
      expect(centerOffset).toBeLessThanOrEqual(6);

      const overflowDelta = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflowDelta).toBeLessThanOrEqual(2);
    });

    test("multi-option rows stay on a single line", async ({ page }) => {
      const card = page
        .getByTestId("hero-preview-card")
        .filter({
          has: page.getByTestId("hero-preview-option-list")
        })
        .first();

      await expect(card).toBeVisible();

      const row = card.getByTestId("hero-preview-option-row").first();
      await expect(row).toBeVisible();

      const name = row.locator("[data-hero-option-name]");
      const probability = row.locator("[data-hero-option-probability]");
      const yes = row.locator("[data-hero-option-trade='yes']");
      const no = row.locator("[data-hero-option-trade='no']");

      const [rowBox, nameBox, probBox, yesBox, noBox, gridTemplate] = await Promise.all([
        row.boundingBox(),
        name.boundingBox(),
        probability.boundingBox(),
        yes.boundingBox(),
        no.boundingBox(),
        row.evaluate((node) => getComputedStyle(node).gridTemplateColumns)
      ]);

      expect(rowBox).not.toBeNull();
      expect(nameBox).not.toBeNull();
      expect(probBox).not.toBeNull();
      expect(yesBox).not.toBeNull();
      expect(noBox).not.toBeNull();

      if (!rowBox || !nameBox || !probBox || !yesBox || !noBox) return;

      const columns = gridTemplate
        .trim()
        .split(/\s+/)
        .filter((value) => value.length > 0);
      expect(columns.length).toBeGreaterThanOrEqual(4);
      const trailing = columns.slice(-2);
      for (const value of trailing) {
        const numeric = Number.parseFloat(value);
        expect(Number.isNaN(numeric)).toBe(false);
        expect(numeric).toBeGreaterThan(0);
      }

      const align = (a: { y: number; height: number }, b: { y: number; height: number }) => {
        const centerA = a.y + a.height / 2;
        const centerB = b.y + b.height / 2;
        return Math.abs(centerA - centerB);
      };

      expect(align(nameBox, probBox)).toBeLessThanOrEqual(4);
      expect(align(probBox, yesBox)).toBeLessThanOrEqual(4);
      expect(align(yesBox, noBox)).toBeLessThanOrEqual(4);
      expect(noBox.x + noBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);

      const whiteSpace = await name.evaluate((element) => getComputedStyle(element).whiteSpace);
      const textOverflow = await name.evaluate((element) => getComputedStyle(element).textOverflow);
      expect(whiteSpace).toBe("nowrap");
      expect(textOverflow).toBe("ellipsis");

      const [yesWidth, noWidth, yesHeight, noHeight] = await Promise.all([
        yes.evaluate((element) => getComputedStyle(element).width),
        no.evaluate((element) => getComputedStyle(element).width),
        yes.evaluate((element) => getComputedStyle(element).height),
        no.evaluate((element) => getComputedStyle(element).height)
      ]);
      const yesWidthValue = Number.parseFloat(yesWidth);
      const noWidthValue = Number.parseFloat(noWidth);
      const yesHeightValueMobile = Number.parseFloat(yesHeight);
      const noHeightValueMobile = Number.parseFloat(noHeight);
      expect(yesWidthValue).toBeGreaterThanOrEqual(48);
      expect(yesWidthValue).toBeLessThanOrEqual(60);
      expect(noWidthValue).toBeGreaterThanOrEqual(48);
      expect(noWidthValue).toBeLessThanOrEqual(60);
      expect(yesHeightValueMobile).toBeGreaterThanOrEqual(24);
      expect(yesHeightValueMobile).toBeLessThanOrEqual(32);
      expect(noHeightValueMobile).toBeGreaterThanOrEqual(24);
      expect(noHeightValueMobile).toBeLessThanOrEqual(32);
    });
  });
}
