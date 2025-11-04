import { expect, test } from "@playwright/test";

test.describe("Home hero categories", () => {
  test("filters markets by selected category", async ({ page }) => {
    await page.goto("/");

    const popularTab = page.getByRole("tab", { name: "Popular" });
    await expect(popularTab).toHaveAttribute("aria-selected", "true");

    const cards = page.getByTestId("hero-preview-card");
    await expect(cards).toHaveCount(4);

    const politicsTab = page.getByRole("tab", { name: "Política" });
    await politicsTab.click();
    await expect(politicsTab).toHaveAttribute("aria-selected", "true");
    await expect(popularTab).toHaveAttribute("aria-selected", "false");

    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByRole("heading", { level: 3 })).toContainText("¿Quién ganará");
    await expect(cards.nth(1).getByRole("heading", { level: 3 })).toContainText("¿Milei va ser arrestado");
  });

  test("header tabs redirect to home and keep selected segment from detail page", async ({ page }) => {
    await page.goto("/markets/cr-elecciones-ganador-2026");

    const popularTab = page.getByRole("tab", { name: "Popular" });

    await popularTab.click();

    await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("segment") === "popular");
    await expect(page).toHaveURL(/\/\?segment=popular$/);

    const headerPopularTab = page.getByRole("tab", { name: "Popular" });
    await expect(headerPopularTab).toHaveAttribute("aria-selected", "true");

    const cards = page.getByTestId("hero-preview-card");
    await expect(cards).toHaveCount(4);
  });

  test("home preview buttons open trade modal", async ({ page }) => {
    await page.goto("/");

    const firstCard = page.getByTestId("hero-preview-card").first();
    const multiOptionYes = firstCard.locator("[data-hero-option-trade='yes']");
    if (await multiOptionYes.count()) {
      await multiOptionYes.first().click();
    } else {
      await firstCard.locator("[data-hero-trade='yes']").click();
    }

    const modal = page.locator("[data-trade-modal]");
    await expect(modal).toBeVisible();
    await expect(modal.locator("[data-trade-modal-selected-action]")).toContainText(/Comprar Sí/i);

    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
  });
});
