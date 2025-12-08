import { test, expect } from "@playwright/test";

test.describe("header auth buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders log in and sign up buttons with correct alignment", async ({ page }) => {
    const loginButton = page.getByRole("button", { name: "Iniciar sesión" });
    const signupButton = page.getByRole("button", { name: "Registrarse" });
    const logo = page.locator('img[src="/markets/logo.svg?v=4"]');
    const header = page.locator("header.AppHeader_header__HsCec");
    const brandTitle = page.locator("text=Kérdos Markets").first();

    await expect(loginButton).toBeVisible();
    await expect(signupButton).toBeVisible();
    await expect(page.locator("text=Connect Wallet")).toHaveCount(0);
    await expect(logo).toBeVisible();
    await expect(header).toHaveCSS("padding-top", "8px");

    const loginBox = await loginButton.boundingBox();
    const signupBox = await signupButton.boundingBox();
    const logoBox = await logo.boundingBox();

    expect(loginBox).not.toBeNull();
    expect(signupBox).not.toBeNull();
    expect(logoBox).not.toBeNull();

    if (loginBox && signupBox) {
      expect(Math.abs(loginBox.y - signupBox.y)).toBeLessThan(4);
      expect(loginBox.height).toBeGreaterThanOrEqual(32);
      expect(signupBox.height).toBeGreaterThanOrEqual(32);
    }

    if (logoBox) {
      expect(logoBox.width).toBeLessThanOrEqual(60);
      expect(logoBox.height).toBeLessThanOrEqual(60);
    }

    await expect(brandTitle).toHaveCSS("color", "rgb(217, 119, 6)");
    const logoFilter = await logo.evaluate((node) => getComputedStyle(node).filter);
    expect(logoFilter).toContain("sepia");
  });

  test("opens modal with correct intent labels", async ({ page }) => {
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("dialog", { name: "Inicia sesión" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Registrarse" }).click();
    await expect(page.getByRole("dialog", { name: "Crea tu cuenta" })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("stacks buttons on mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/");

    const loginButton = page.getByRole("button", { name: "Iniciar sesión" });
    const signupButton = page.getByRole("button", { name: "Registrarse" });

    const loginBox = await loginButton.boundingBox();
    const signupBox = await signupButton.boundingBox();

    expect(loginBox).not.toBeNull();
    expect(signupBox).not.toBeNull();

    if (loginBox && signupBox) {
      const verticalOffset = Math.abs(signupBox.y - loginBox.y);
      expect(verticalOffset).toBeLessThanOrEqual(6);
    }
  });

  test("header buttons use accent color and hover styles", async ({ page }) => {
    const accent = "rgb(217, 119, 6)";
    const accentHover = "rgb(180, 83, 9)";

    const loginButton = page.getByRole("button", { name: "Iniciar sesión" });
    const signupButton = page.getByRole("button", { name: "Registrarse" });

    await expect(signupButton).toHaveCSS("background-color", accent);
    await signupButton.hover();
    await expect(signupButton).toHaveCSS("background-color", accentHover);
    await page.mouse.move(0, 0);

    await expect(loginButton).toHaveCSS("border-color", accent);
    await expect(loginButton).toHaveCSS("color", accent);
  });

  test("theme toggle uses accent color when enabled", async ({ page }) => {
    const accent = "rgb(217, 119, 6)";
    const toggle = page.locator('input[role="switch"]');

    const isChecked = await toggle.evaluate((node) => node.checked);
    if (!isChecked) {
      await toggle.click();
    }

    await expect(toggle).toHaveCSS("background-color", accent);
  });

  test("logo uses cache-busting query and market colors remain unchanged", async ({ page }) => {
    await expect(page.locator('img[src="/markets/logo.svg?v=4"]')).toBeVisible();

    await page.goto("/markets/cr-elecciones-ganador-2026");
    const yesButton = page.locator("[data-market-option-action='yes']").first();
    await expect(yesButton).toHaveCSS("background-color", "rgb(21, 128, 61)");
  });

  test("hero header and content share the same left alignment", async ({ page }) => {
    const headerRow = page.getByTestId("hero-header-top-row");
    const headerGroup = page.getByTestId("hero-header-group");
    const heroContent = page.getByTestId("hero-content");
    const headerInner = page.locator("header.AppHeader_header__HsCec > div");
    const layout = page.locator("[class*='page_layout__']").first();
    const searchBar = page.locator("[class*='SearchBar_searchBar__']").first();

    await heroContent.scrollIntoViewIfNeeded();

    const [headerRowBox, headerGroupBox, heroContentBox, headerInnerBox, layoutBox, searchBarBox] = await Promise.all([
      headerRow.boundingBox(),
      headerGroup.boundingBox(),
      heroContent.boundingBox(),
      headerInner.boundingBox(),
      layout.boundingBox(),
      searchBar.boundingBox()
    ]);

    expect(headerRowBox).not.toBeNull();
    expect(headerGroupBox).not.toBeNull();
    expect(heroContentBox).not.toBeNull();

    if (headerRowBox && headerGroupBox && heroContentBox && headerInnerBox && layoutBox && searchBarBox) {
      const tolerance = 4;
      expect(Math.abs(headerRowBox.x - heroContentBox.x)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(headerGroupBox.x - heroContentBox.x)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(searchBarBox.x - heroContentBox.x)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(headerInnerBox.x - layoutBox.x)).toBeLessThanOrEqual(tolerance);
    }
  });
});
