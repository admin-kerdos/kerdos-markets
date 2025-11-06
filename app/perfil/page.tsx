export const metadata = {
  title: "Perfil | Kérdos Markets"
};

export default function PerfilPage() {
  return (
    <main style={{ padding: "clamp(24px, 6vw, 48px)", maxWidth: "720px", margin: "0 auto", color: "var(--color-text)" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1rem" }}>Tu perfil</h1>
      <p style={{ color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        Estamos preparando esta sección para que puedas gestionar tu cuenta y preferencias.
        Mientras tanto, puedes seguir negociando en los mercados disponibles.
      </p>
    </main>
  );
}
