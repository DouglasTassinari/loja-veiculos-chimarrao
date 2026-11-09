// Marca da Tazzin usada no crédito "Desenvolvido por" dos rodapés.
export function TazzinMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={className}>
      <path fill="currentColor" d="M30 18H80Q82 18 82 20V35Q82 42 75 42H51V74Q51 82 43 82H38Q30 82 30 74V42H16Q14 42 14 40V34Q14 18 30 18Z" />
      <rect x="59" y="56" width="23" height="26" rx="8" fill="#4CAF50" />
    </svg>
  );
}
