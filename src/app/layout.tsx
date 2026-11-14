import type { Metadata } from "next";
import { Anton, DM_Sans } from "next/font/google";
import LocalOrigin from "@/components/local-origin";
import "./globals.css";

// Anton matches the tall condensed wordmark in the logo; DM Sans carries body text.
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fynish",
  description: "Finish your insurance claim in chat",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col"><LocalOrigin />{children}</body>
    </html>
  );
}

