import NotFoundContent from "../components/NotFound";

export const metadata = { title: "Página não encontrada", robots: { index: false } };

// Vale para as páginas do site: um veículo que saiu do ar cai aqui, com cabeçalho e rodapé da loja.
export default function NotFound() {
  return <NotFoundContent />;
}
