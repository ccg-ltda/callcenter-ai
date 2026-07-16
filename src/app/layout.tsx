import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contact Center IA",
  description: "Lanza campañas de llamadas con agentes de voz de Inteligencia Artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-bootstrap" strategy="beforeInteractive">{`
          (() => {
            try {
              const stored = localStorage.getItem('theme');
              const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              const theme = stored === 'light' || stored === 'dark' ? stored : system;
              const root = document.documentElement;
              root.classList.toggle('dark', theme === 'dark');
              root.style.colorScheme = theme;
            } catch (error) {
              document.documentElement.classList.add('dark');
              document.documentElement.style.colorScheme = 'dark';
            }
          })();
        `}</Script>
        {children}
      </body>
    </html>
  );
}
