import { test, expect } from "@playwright/test";
import { encode } from "@auth/core/jwt";

const AUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "0123456789abcdef0123456789abcdef";
const TEST_WALLETS = {
  phantom: [
    187, 136, 100, 68, 201, 105, 27, 96, 250, 200, 15, 132, 0, 25, 20, 181, 253, 2, 73, 66, 61, 47, 255, 224, 58,
    37, 28, 101, 88, 212, 23, 61, 56, 58, 148, 6, 209, 84, 159, 167, 174, 156, 120, 82, 242, 54, 77, 62, 58, 156,
    68, 192, 116, 208, 87, 29, 255, 174, 236, 86, 35, 120, 50, 245
  ],
  solflare: [
    141, 236, 208, 140, 233, 173, 13, 92, 78, 31, 80, 120, 58, 85, 180, 102, 83, 172, 210, 200, 220, 243, 182, 31, 0,
    214, 190, 214, 3, 254, 221, 231, 150, 30, 95, 191, 54, 32, 75, 14, 233, 37, 201, 203, 108, 197, 128, 207, 60, 74,
    216, 113, 64, 194, 209, 139, 99, 43, 248, 95, 64, 117, 93, 169
  ]
} as const;

const EMAIL_TEST_ADDRESS = "tester@ejemplo.com";

const TEST_AUTOMATION = {
  wallet: {
    phantom: { publicKey: "AutomationPhantomPublicKey" },
    solflare: { publicKey: "AutomationSolflarePublicKey" }
  }
} as const;

type PrimeOptions = {
  emailEnabled?: boolean;
  wallets?: Partial<typeof TEST_WALLETS> | null;
  resendCooldown?: number;
};

async function primeTestGlobals(page, options: PrimeOptions = {}): Promise<void> {
  const { emailEnabled = true, wallets = TEST_WALLETS, resendCooldown } = options;
  await page.addInitScript(
    ({ wallets, automation, emailEnabled: enabled, resendCooldown: cooldown }) => {
      // @ts-expect-error instrumentation for Playwright tests
      globalThis.__KERDOS_TEST_WALLETS__ = wallets;
      // @ts-expect-error instrumentation for Playwright tests
      globalThis.__KERDOS_AUTOMATION__ = automation;
      // @ts-expect-error instrumentation for Playwright tests
      globalThis.__KERDOS_EMAIL_SIGNIN_ENABLED__ = enabled;
      // @ts-expect-error instrumentation for Playwright tests
      if (typeof cooldown === "number") {
        // @ts-expect-error instrumentation for Playwright tests
        globalThis.__KERDOS_EMAIL_RESEND_COOLDOWN__ = cooldown;
      } else {
        // @ts-expect-error instrumentation for Playwright tests
        delete globalThis.__KERDOS_EMAIL_RESEND_COOLDOWN__;
      }
    },
    {
      wallets,
      automation: TEST_AUTOMATION,
      emailEnabled,
      resendCooldown
    }
  );
}

async function setSessionCookie(page, payload) {
  const token = await encode({
    token: payload,
    secret: AUTH_SECRET,
    maxAge: 60 * 60,
    salt: "next-auth.session-token"
  });
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: "http://127.0.0.1:5173/"
    }
  ]);
}

test.describe("Autenticación", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log(`[browser:error] ${message.text()}`);
      }
    });
  });
  test("abre y cierra el modal desde el header", async ({ page }) => {
    await primeTestGlobals(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("dialog", { name: /Inicia sesión|Crea tu cuenta/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("Continuar con Google inicia el flujo OAuth de Google", async ({ page }) => {
    await page.route("https://accounts.google.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Google OAuth Stub</body></html>"
      });
    });
    await primeTestGlobals(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const [request] = await Promise.all([
      page.waitForRequest((request) => request.url().includes("/api/auth/signin/google")),
      page.getByRole("button", { name: "Continuar con Google" }).click()
    ]);
    expect(request.method()).toBe("POST");
    const signinUrl = new URL(request.url());
    expect(signinUrl.pathname).toBe("/api/auth/signin/google");
    const requestBody = request.postData() ?? "";
    const formData = new URLSearchParams(requestBody);
    expect(formData.has("callbackUrl")).toBe(true);
    expect(formData.get("callbackUrl")).toContain("/");
    expect(formData.has("csrfToken")).toBe(true);
    await page.waitForURL(/accounts\.google\.com/);
  });

  test("estructura del modal respeta el orden requerido", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true });
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    const sections = await dialog.locator("[data-auth-section]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-auth-section"))
    );
    expect(sections).toEqual(["google", "divider", "email", "wallets", "footer"]);

    await expect(dialog.getByRole("separator")).toHaveCount(1);

    const emailInput = dialog.getByLabel("Correo electrónico");
    await expect(emailInput).toHaveAttribute("placeholder", "correo@ejemplo.com");
    await expect(dialog.getByRole("button", { name: "Continuar con correo" })).toBeDisabled();

    const walletGroup = dialog.getByRole("group", { name: "Conectar con una wallet" });
    await expect(walletGroup.getByRole("button")).toHaveCount(2);
    const phantomImgSrc = await walletGroup
      .getByRole("button", { name: "Conectar con Phantom" })
      .locator("img")
      .first()
      .getAttribute("src");
    expect(phantomImgSrc ?? "").toContain("/markets/phantom_logo.png");

    const solflareImgSrc = await walletGroup
      .getByRole("button", { name: "Conectar con Solflare" })
      .locator("img")
      .first()
      .getAttribute("src");
    expect(solflareImgSrc ?? "").toContain("/markets/solflare_logo.png");

    const termsLink = dialog.getByRole("link", { name: "Términos" });
    const privacyLink = dialog.getByRole("link", { name: "Privacidad" });
    await expect(termsLink).toHaveAttribute("href", "/terminos");
    await expect(privacyLink).toHaveAttribute("href", "/privacidad");
  });

  test("no muestra textos informativos eliminados", async ({ page }) => {
    await primeTestGlobals(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    await expect(dialog.getByText("Protegido con HTTPS", { exact: false })).toHaveCount(0);
    await expect(dialog.getByText("Firmar con wallet", { exact: false })).toHaveCount(0);
  });

  test("Continuar con correo envía el formulario con el email", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true });
    await page.route("**/api/auth/signin/email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.getByLabel("Correo electrónico").fill(EMAIL_TEST_ADDRESS);

    const [request] = await Promise.all([
      page.waitForRequest((request) => request.url().includes("/api/auth/signin/email")),
      page.getByRole("button", { name: "Continuar con correo" }).click()
    ]);

    expect(request.method()).toBe("POST");
    const body = request.postData() ?? "";
    const formData = new URLSearchParams(body);
    expect(formData.get("email")).toBe(EMAIL_TEST_ADDRESS);
    expect(formData.has("csrfToken")).toBe(true);
    expect(formData.has("callbackUrl")).toBe(true);

    await expect(page.getByText("Te enviamos un enlace", { exact: false })).toBeVisible();
    const resendButton = page.getByRole("button", { name: "Reenviar enlace" });
    await expect(resendButton).toBeVisible();
    await expect(resendButton).toHaveText(/Reenviar en/);
  });

  test("respeta el cooldown antes de reenviar el enlace", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true, resendCooldown: 2 });

    let attempt = 0;
    await page.route("**/api/auth/signin/email", async (route) => {
      attempt += 1;
      if (attempt === 2) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ message: "Demasiadas solicitudes. Intenta de nuevo en 30 segundos.", cooldown: 2 })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });

    await dialog.getByLabel("Correo electrónico").fill(EMAIL_TEST_ADDRESS);
    await dialog.getByRole("button", { name: "Continuar con correo" }).click();

    const resendButton = dialog.getByRole("button", { name: "Reenviar enlace" });
    await expect(resendButton).toHaveText(/Reenviar en/);

    await page.waitForTimeout(2200);
    await expect(resendButton).toHaveText(/Reenviar$/);
    await resendButton.click();

    const toast = dialog.locator("[data-auth-toast]");
    await expect(toast).toContainText("Demasiadas solicitudes");
    await expect(resendButton).toHaveText(/Reenviar en/);
  });

  test("cuando el proveedor de correo no está habilitado muestra un mensaje informativo", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: false });
    await page.route("**/api/auth/signin/email", () => {
      throw new Error("La ruta de correo no debería invocarse cuando no está habilitada");
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });

    const submitButton = dialog.getByRole("button", { name: "Continuar con correo" });
    await expect(submitButton).toBeDisabled();
    await dialog.getByLabel("Correo electrónico").fill(EMAIL_TEST_ADDRESS);
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toHaveAttribute("aria-disabled", "true");
    const toastLocator = dialog.locator("[data-auth-toast]");
    await submitButton.click();
    await toastLocator.waitFor({ state: "visible" });
    await expect(toastLocator).toContainText("Aún no habilitamos el acceso con correo en esta versión.");
    await page.waitForTimeout(3400);
    await expect(toastLocator).toHaveCount(0);
  });

  test("el botón Continuar se habilita con correo válido y Enter envía el formulario", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true });
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    const emailInput = dialog.getByLabel("Correo electrónico");
    const submitButton = dialog.getByRole("button", { name: "Continuar con correo" });

    await expect(submitButton).toBeDisabled();
    await emailInput.type("correo@invalido");
    await expect(submitButton).toBeDisabled();
    await emailInput.fill(EMAIL_TEST_ADDRESS);
    await expect(submitButton).toBeEnabled();

    await page.route("**/api/auth/signin/email", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
    });

    const requestPromise = page.waitForRequest((request) => request.url().includes("/api/auth/signin/email"));
    await emailInput.press("Enter");
    const request = await requestPromise;
    expect(request.method()).toBe("POST");
  });

  test("muestra un aviso cuando el enlace expiró", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true });
    await page.goto("/?authModal=login&authError=email-expired");
    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    const toast = dialog.locator("[data-auth-toast]");
    await expect(toast).toContainText("El enlace expiró. Volvé a solicitarlo.");
  });

  test("en móviles el modal no desborda y mantiene iconos alineados", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true });
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    const walletGroup = dialog.getByRole("group", { name: "Conectar con una wallet" });
    await expect(walletGroup.getByRole("button")).toHaveCount(2);

    const [phantomBox, solflareBox] = await Promise.all([
      walletGroup.getByRole("button", { name: "Conectar con Phantom" }).boundingBox(),
      walletGroup.getByRole("button", { name: "Conectar con Solflare" }).boundingBox()
    ]);

    expect(phantomBox).not.toBeNull();
    expect(solflareBox).not.toBeNull();
    if (phantomBox && solflareBox) {
      expect(Math.abs(phantomBox.y - solflareBox.y)).toBeLessThan(2);
      expect(phantomBox.width).toBeLessThanOrEqual(52);
      expect(solflareBox.width).toBeLessThanOrEqual(52);
    }

    const emailRow = dialog.locator("[data-auth-section='email']");
    const emailInput = dialog.getByLabel("Correo electrónico");
    const submitButton = dialog.getByRole("button", { name: "Continuar con correo" });

    const [rowBox, inputBox, buttonBox] = await Promise.all([
      emailRow.boundingBox(),
      emailInput.boundingBox(),
      submitButton.boundingBox()
    ]);

    expect(rowBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    if (rowBox && inputBox && buttonBox) {
      expect(Math.abs(inputBox.y - buttonBox.y)).toBeLessThanOrEqual(2);
      expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
    }

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test("los iconos de wallet exponen etiquetas y muestran nota temporal cuando faltan", async ({ page }) => {
    await primeTestGlobals(page, { wallets: null });
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    const dialog = page.getByRole("dialog", { name: "Inicia sesión" });
    const walletGroup = dialog.getByRole("group", { name: "Conectar con una wallet" });
    const phantomButton = walletGroup.getByRole("button", { name: "Conectar con Phantom" });
    const solflareButton = walletGroup.getByRole("button", { name: "Conectar con Solflare" });

    await expect(phantomButton).toBeVisible();
    await expect(solflareButton).toBeVisible();

    await expect(dialog.getByText("Wallet no detectada", { exact: false })).toHaveCount(0);
    await phantomButton.click();

    const feedback = dialog.getByText("Wallet no detectada", { exact: false });
    await expect(feedback).toBeVisible();

    await page.waitForTimeout(4200);
    await expect(feedback).not.toBeVisible();
  });

  test("cierra el modal tras verificar el enlace enviado por correo", async ({ page }) => {
    await primeTestGlobals(page, { emailEnabled: true, resendCooldown: 1 });

    await page.route("**/api/auth/signin/email", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    let provideSession = false;
    await page.route("**/api/auth/session", async (route) => {
      if (!provideSession) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "email-user",
            name: "Usuario Email",
            email: EMAIL_TEST_ADDRESS,
            provider: "email"
          },
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.getByLabel("Correo electrónico").fill(EMAIL_TEST_ADDRESS);
    await page.getByRole("button", { name: "Continuar con correo" }).click();

    await setSessionCookie(page, {
      sub: "email-user",
      name: "Usuario Email",
      email: EMAIL_TEST_ADDRESS,
      provider: "email"
    });
    provideSession = true;
    await page.reload();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('[aria-haspopup="menu"]')).toBeVisible();
  });

  test("la cabecera muestra el menú después de una sesión activa", async ({ page }) => {
    let sessionIntercepted = false;
    await page.route("**/api/auth/session", async (route) => {
      if (sessionIntercepted) {
        await route.continue();
        return;
      }
      sessionIntercepted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "google-test-user",
            name: "Usuario Google",
            email: "google@example.com",
            image: "https://dummyimage.com/80x80/1f2937/f8fafc?text=G",
            provider: "google"
          },
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
      await page.unroute("**/api/auth/session");
    });

    await setSessionCookie(page, {
      sub: "google-test-user",
      name: "Usuario Google",
      email: "google@example.com",
      picture: "https://dummyimage.com/80x80/1f2937/f8fafc?text=G",
      provider: "google"
    });
    await page.goto("/");
    const avatarButton = page.locator('[aria-haspopup="menu"]');
    await expect(avatarButton).toBeVisible();
    await avatarButton.click();
    await expect(page.getByRole("menuitem", { name: "Perfil" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("inicia sesión con Phantom y persiste tras recargar", async ({ page }) => {
    const walletUser = {
      id: "phantom-wallet-user",
      name: "Wallet Phantom",
      email: null,
      image: null,
      provider: "wallet",
      walletType: "phantom"
    };

    let walletSessionActive = false;

    await page.route("**/api/auth/session", async (sessionRoute) => {
      if (!walletSessionActive) {
        await sessionRoute.continue();
        return;
      }
      await sessionRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: walletUser,
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.route("**/api/siws/verify", async (route) => {
      walletSessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await primeTestGlobals(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    const verifyRequest = page.waitForRequest((request) => request.url().includes("/api/siws/verify"));
    await page.getByRole("button", { name: "Conectar con Phantom" }).click();
    await verifyRequest;
    const avatarButton = page.locator('[aria-haspopup="menu"]');
    await expect(avatarButton).toBeVisible();
    await page.reload();
    await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
    await page.locator('[aria-haspopup="menu"]').first().click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("inicia sesión con Solflare y muestra el menú", async ({ page }) => {
    const walletUser = {
      id: "solflare-wallet-user",
      name: "Wallet Solflare",
      email: null,
      image: null,
      provider: "wallet",
      walletType: "solflare"
    };

    let solflareSessionActive = false;

    await page.route("**/api/auth/session", async (sessionRoute) => {
      if (!solflareSessionActive) {
        await sessionRoute.continue();
        return;
      }
      await sessionRoute.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: walletUser,
          expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      });
    });

    await page.route("**/api/siws/verify", async (route) => {
      solflareSessionActive = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });
    await primeTestGlobals(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Registrarse" }).click();
    const verifyRequest = page.waitForRequest((request) => request.url().includes("/api/siws/verify"));
    await page.getByRole("button", { name: "Conectar con Solflare" }).click();
    await verifyRequest;
    await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
  });
});
