// Text half of the logo. Lives where the brand is named: sidebar header, welcome splash.
export default function Wordmark({ className = "text-2xl" }: { className?: string }) {
  return <span className={`font-[family-name:var(--font-anton)] tracking-wide text-blue ${className}`}>Fynish</span>;
}
