"use client";

import Image from "next/image";
import { useState } from "react";

export default function Gallery({ photos, alt, sold }: { photos: string[]; alt: string; sold?: boolean }) {
  const [i, setI] = useState(0);
  const n = photos.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  if (n === 0) {
    return (
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-sand bg-brand" role="img" aria-label={`${alt}: fotos em breve`}>
        <Image src="/brand/simbolo.png" alt="" width={120} height={120} className="h-28 w-28 opacity-90" />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sand/80">Fotos em breve</span>
      </div>
    );
  }

  return (
    <div onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
      <div className="relative overflow-hidden rounded-2xl border border-sand bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[i]} alt={`${alt}, foto ${i + 1} de ${n}`} className="aspect-[4/3] w-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
        {sold && <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-4xl font-extrabold tracking-widest text-white">VENDIDO</div>}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 px-3 py-2 text-lg font-bold text-white hover:bg-ink/80">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ink/60 px-3 py-2 text-lg font-bold text-white hover:bg-ink/80">›</button>
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2.5 py-0.5 text-xs font-semibold text-white">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {photos.map((p, k) => (
            <button key={p} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i} className={`overflow-hidden rounded-lg border-2 ${k === i ? "border-brand" : "border-transparent opacity-80 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
