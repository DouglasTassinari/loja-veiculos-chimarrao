import { ImageResponse } from "next/og";
import { store } from "@/lib/config";

// Imagem que aparece quando alguém manda o endereço do site no WhatsApp, no Instagram ou no Facebook.
// Sem ela o link vai "pelado" — e o WhatsApp é o principal canal da loja.
// Páginas de veículo têm a sua própria (a foto do carro), definida em generateMetadata.
export const alt = `${store.name} — seminovos em ${store.city}/${store.state}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          background: "#0f3d2e", color: "#f8f5ef", padding: "80px", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 8, color: "#e0a878", textTransform: "uppercase" }}>
          {store.city} · {store.state}
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, marginTop: 24, lineHeight: 1.05 }}>
          {store.name}
        </div>
        <div style={{ display: "flex", fontSize: 40, marginTop: 28, color: "#e7d9c6" }}>
          Carros e motos seminovos com procedência
        </div>
        <div style={{ display: "flex", marginTop: 48, gap: 16 }}>
          {["Vistoria realizada", "Abaixo da FIPE", "Simulação na hora"].map((t) => (
            <div key={t} style={{ display: "flex", background: "#96562b", borderRadius: 999, padding: "14px 30px", fontSize: 26, fontWeight: 700 }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
