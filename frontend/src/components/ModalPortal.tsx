"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalPortalProps {
  children: ReactNode;
}

/**
 * Renderiza el modal directamente en el <body> del documento.
 * Esto asegura que el fondo oscuro y el efecto backdrop-blur cubran el 100%
 * de la pantalla (incluyendo la barra superior sticky y el sidebar)
 * sin verse limitados por los contextos de apilamiento (z-index) del layout.
 */
export default function ModalPortal({ children }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
