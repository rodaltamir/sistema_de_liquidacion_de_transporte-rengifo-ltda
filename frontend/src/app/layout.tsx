import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
