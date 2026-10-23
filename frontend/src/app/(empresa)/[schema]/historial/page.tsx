"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function HistorialRedirect() {
  const params = useParams();
  const router = useRouter();
  const schema = (params?.schema as string) || "";

  useEffect(() => {
    if (schema) {
      router.replace(`/${schema}/viajes?tab=historial`);
    }
  }, [schema, router]);

  return (
    <div className="flex flex-col justify-center items-center min-h-[50vh] gap-3">
      <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
        Redirigiendo a Historial de Viajes...
      </span>
    </div>
  );
}
