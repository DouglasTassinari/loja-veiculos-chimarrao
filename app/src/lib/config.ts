// Dados da loja. Trocar pelos dados reais antes de publicar.
export const store = {
  name: "Chimarrão Veículos",
  short: "Chimarrão",
  city: "Sapucaia do Sul",
  state: "RS",
  whatsapp: "5551999999999", // DDI + DDD + número, só dígitos
  whatsappLabel: "(51) 99999-9999",
  phoneLabel: "(51) 3499-9999",
  address: "Rua Campeiro, 99, Nova Sapucaia, Sapucaia do Sul - RS, 93228-314",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000",
  // NEXT_PUBLIC_PREVIEW=1: versão de demonstração (faixa no site, fora do Google).
  preview: process.env.NEXT_PUBLIC_PREVIEW === "1",
};

// Parâmetros de gestão usados nos cálculos do ERP.
export const finance = {
  capitalCostMonthly: 0.018, // custo do dinheiro parado: 1,8% ao mês
  targetMarginPct: 8, // margem líquida-alvo sobre o preço de venda
  alertDaysWarn: 30,
  alertDaysLate: 45,
  alertDaysCritical: 60,
  maxPrepDays: 7,
};
