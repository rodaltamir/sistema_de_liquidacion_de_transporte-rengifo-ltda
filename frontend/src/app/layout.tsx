import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "Sistema de Liquidación de Transporte | Rengifo Ltda",
  description: "Sistema Multi-tenant de Liquidación de Fletes, Mermas y Pagos para Empresas de Transporte y Asociaciones",
  icons: {
    icon: "/rengifo_logo_icon.svg",
    shortcut: "/rengifo_logo_icon.svg",
    apple: "/rengifo_logo_icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const saved = localStorage.getItem('app_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (saved === 'light' || (saved === 'system' && !prefersDark)) {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.colorScheme = 'light';
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.style.colorScheme = 'dark';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
