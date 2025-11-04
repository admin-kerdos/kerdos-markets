import { expect, test } from "@playwright/test";

test.describe("Hero search bar", () => {
  test("filters markets by query", async ({ page }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("Buscar mercados...");
    await input.fill("Solana");

    const cards = page.getByTestId("hero-preview-card");
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByRole("heading", { level: 3 })).toContainText("¿Solana va superar los $300 en 2025?");
  });

  test("shows empty state when no markets match", async ({ page }) => {
    await page.goto("/");

    const input = page.getByPlaceholder("Buscar mercados...");
    await input.fill("zzzz");

    const empty = page.getByTestId("hero-search-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("No encontramos mercados");
  });
});
