import Image from "next/image";
import Link from "next/link";
import { store } from "@/lib/config";
import NotFoundContent from "./components/NotFound";

export const metadata = { title: "Página não encontrada", robots: { index: false } };

// Endereço que não existe em nenhuma parte do sistema (fora do layout da loja): leva uma moldura simples
// com a marca, para o visitante não cair numa tela sem saída.
export default function NotFound() {
  return (
    <>
      <header className="bg-brand text-paper">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-2.5">
          <Link href="/" aria-label={`${store.name} — página inicial`}>
            <Image src="/brand/logo-horizontal-negativo.png" alt={store.name} width={691} height={201} priority className="h-14 w-auto" />
          </Link>
        </div>
      </header>
      <main className="flex-1"><NotFoundContent /></main>
      <footer className="bg-brand px-4 py-6 text-center text-xs text-sand/70">
        © {new Date().getFullYear()} {store.name} · {store.city}/{store.state}
      </footer>
    </>
  );
}
