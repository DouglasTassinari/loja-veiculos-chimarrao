"use client";

// Falha no próprio esqueleto da página (caso raro). Precisa trazer <html> e <body> porque substitui
// o layout inteiro, então o estilo vai escrito aqui mesmo, sem depender de nada que possa ter falhado.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0f3d2e", color: "#f8f5ef", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <main>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>O site não carregou</h1>
          <p style={{ marginTop: "0.75rem", color: "#e7d9c6" }}>Foi uma falha nossa. Tente de novo em um instante.</p>
          <button
            onClick={reset}
            style={{ marginTop: "1.5rem", border: 0, borderRadius: "0.5rem", background: "#96562b", color: "#fff", padding: "0.75rem 1.5rem", fontWeight: 700, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
          {error.digest && <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#e7d9c6a0" }}>Código da falha: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
