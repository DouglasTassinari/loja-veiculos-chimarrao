// Enquanto o estoque é montado no servidor (filtro, página seguinte), o visitante vê o desenho da
// tela no lugar de uma página parada. São 6 cartões cinza, do mesmo tamanho dos de verdade.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando o estoque…</span>
      <div className="h-9 w-72 animate-pulse rounded-lg bg-sand/70" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-sand/50" />
      <div className="mt-5 flex gap-2">
        {["w-20", "w-20", "w-20"].map((w, i) => <div key={i} className={`h-9 ${w} animate-pulse rounded-full bg-sand/60`} />)}
      </div>
      <div className="mt-4 h-40 animate-pulse rounded-2xl border border-sand bg-white" />
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-sand bg-white">
            <div className="aspect-[4/3] w-full animate-pulse bg-sand/60" />
            <div className="space-y-2 p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-sand/60" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-sand/60" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-sand/40" />
              <div className="h-7 w-32 animate-pulse rounded bg-sand/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
