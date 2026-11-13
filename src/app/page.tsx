import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Image src="/logo.png" alt="Fynish" width={36} height={36} priority />
        <span className="text-lg font-semibold text-blue">Fynish</span>
      </header>
      <section aria-label="Messages" className="flex-1 overflow-y-auto px-4 py-4" />
      <form className="flex gap-2 border-t border-line bg-card px-4 py-3">
        <input
          aria-label="Message"
          placeholder="Type a message"
          className="flex-1 rounded-bubble border border-line bg-cream px-4 py-2 outline-none focus:border-blue"
        />
        <button type="submit" className="rounded-bubble bg-blue px-4 py-2 font-medium text-on-blue">
          Send
        </button>
      </form>
    </main>
  );
}
