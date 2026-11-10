"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function HistorialRedirectPage() {
  const router = useRouter();
  const { schema } = useParams<{ schema: string }>();

  useEffect(() => {
    if (schema) {
      router.replace(`/${schema}/liquidaciones`);
    }
  }, [schema, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 dark:text-slate-400 gap-2">
      <div className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      <span className="text-xs">Redirigiendo a Liquidaciones...</span>
    </div>
  );
}
