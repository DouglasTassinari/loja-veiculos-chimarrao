// Telefone brasileiro: aceita com ou sem +55, DDD e máscara. Devolve "(51) 99999-9999" ou null.
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== "9") return null; // celular tem 9 dígitos e começa com 9
  if (d.length === 10 && !/[2-5]/.test(d[2])) return null; // fixo começa com 2 a 5 (celular de 8 dígitos não existe mais)
  const local = d.slice(2);
  const cut = local.length === 9 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${local.slice(0, cut)}-${local.slice(cut)}`;
}

export function validName(input: string): string | null {
  const n = input.replace(/\s+/g, " ").trim();
  return n.length >= 2 && n.length <= 80 && /\p{L}/u.test(n) ? n : null;
}
