import { expect, test } from "@playwright/test";

const MARKET_HEADING = /¿Quién ganará las elecciones presidenciales CR 2026\?/i;

test.describe("Home hero multi-option previews", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows only the top two candidates sorted by probability", async ({ page }) => {
    const card = page
      .locator("[data-testid='hero-preview-card']")
      .filter({
        has: page.getByRole("heading", { level: 3, name: MARKET_HEADING })
      })
      .first();

    const rows = card.locator("[data-testid='hero-preview-option-row']");
    await expect(rows).toHaveCount(2);

    const names = await rows.locator("[data-hero-option-name]").allInnerTexts();
    expect(names).toEqual(["Laura Fernández", "Juan Carlos Hidalgo"]);

    const probabilities = await rows.locator("[data-hero-option-probability]").allInnerTexts();
    expect(probabilities).toEqual(["56%", "32%"]);
  });

  test("renders compact option buttons", async ({ page }) => {
    const card = page
      .locator("[data-testid='hero-preview-card']")
      .filter({
        has: page.getByRole("heading", { level: 3, name: MARKET_HEADING })
      })
      .first();

    const yesButton = card.locator("[data-hero-option-trade='yes']").first();
    const noButton = card.locator("[data-hero-option-trade='no']").first();

    await expect(yesButton).toBeVisible();
    await expect(noButton).toBeVisible();

    const [yesHeight, noHeight] = await Promise.all([
      yesButton.evaluate((element) => getComputedStyle(element).height),
      noButton.evaluate((element) => getComputedStyle(element).height)
    ]);

    const asNumber = (value: string) => Number.parseFloat(value);
    expect(asNumber(yesHeight)).toBeGreaterThanOrEqual(24);
    expect(asNumber(yesHeight)).toBeLessThanOrEqual(32);
    expect(asNumber(noHeight)).toBeGreaterThanOrEqual(24);
    expect(asNumber(noHeight)).toBeLessThanOrEqual(32);
  });

  test("keeps option row layout in a single line across breakpoints", async ({ page }) => {
    const card = page
      .locator("[data-testid='hero-preview-card']")
      .filter({
        has: page.getByRole("heading", { level: 3, name: MARKET_HEADING })
      })
      .first();

    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 900 },
      { width: 390, height: 844 },
      { width: 360, height: 640 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(80);

      const rows = await card.locator("[data-testid='hero-preview-option-row']").elementHandles();
      for (const rowHandle of rows) {
        const row = rowHandle.asElement();
        if (!row) continue;

        const rowBox = await row.boundingBox();
        if (!rowBox) continue;

        const nameHandle = await row.$("[data-hero-option-name]");
        const probHandle = await row.$("[data-hero-option-probability]");
        const yesHandle = await row.$("[data-hero-option-trade='yes']");
        const noHandle = await row.$("[data-hero-option-trade='no']");
        if (!nameHandle || !probHandle || !yesHandle || !noHandle) {
          throw new Error("Missing hero option sub-elements");
        }

        const [nameBox, probBox, yesBox, noBox, display, gridTemplate] = await Promise.all([
          nameHandle.boundingBox(),
          probHandle.boundingBox(),
          yesHandle.boundingBox(),
          noHandle.boundingBox(),
          row.evaluate((node) => getComputedStyle(node).display),
          row.evaluate((node) => getComputedStyle(node).gridTemplateColumns)
        ]);
        if (!nameBox || !probBox || !yesBox || !noBox) {
          throw new Error("Unable to measure hero option layout");
        }

        expect(display).toBe("grid");
        const columns = gridTemplate
          .trim()
          .split(/\s+/)
          .filter((part) => part.length > 0);
        expect(columns.length).toBeGreaterThanOrEqual(4);
        const trailing = columns.slice(-2);
        for (const value of trailing) {
          const numeric = Number.parseFloat(value);
          expect(Number.isNaN(numeric)).toBe(false);
          expect(numeric).toBeGreaterThan(0);
        }

        const align = (boxA: { y: number; height: number }, boxB: { y: number; height: number }) => {
          const centerA = boxA.y + boxA.height / 2;
          const centerB = boxB.y + boxB.height / 2;
          return Math.abs(centerA - centerB);
        };

        expect(align(nameBox, probBox)).toBeLessThanOrEqual(2);
        expect(align(probBox, yesBox)).toBeLessThanOrEqual(2);
        expect(align(yesBox, noBox)).toBeLessThanOrEqual(2);

        expect(noBox.x + noBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);

        const whiteSpace = await nameHandle.evaluate((node) => getComputedStyle(node).whiteSpace);
        expect(whiteSpace).toBe("nowrap");
      }
    }
  });

  test("opens candidate-specific trade modal from the hero card", async ({ page }) => {
    const card = page
      .locator("[data-testid='hero-preview-card']")
      .filter({
        has: page.getByRole("heading", { level: 3, name: MARKET_HEADING })
      })
      .first();

    await card.locator("[data-hero-option-trade='yes']").first().click();

    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h2")).toContainText("Laura Fernández");
    await expect(modal.locator("[data-trade-modal-selected-action]")).toContainText(/Comprar Sí/i);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();

    await card.locator("[data-hero-option-trade='no']").nth(1).click();
    await expect(modal).toBeVisible();
    await expect(modal.locator("h2")).toContainText("Juan Carlos Hidalgo");
    await expect(modal.locator("[data-trade-modal-selected-action]")).toContainText(/Comprar No/i);
  });
});
