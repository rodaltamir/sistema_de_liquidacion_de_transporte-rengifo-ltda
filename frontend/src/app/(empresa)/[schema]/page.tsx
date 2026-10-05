"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EmpresaIndexPage() {
  const params = useParams();
  const router = useRouter();
  const schema = (params?.schema as string) || "";

  useEffect(() => {
    if (schema) {
      router.replace(`/${schema}/dashboard`);
    } else {
      router.replace("/seleccionar-empresa");
    }
  }, [schema, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Accediendo a la empresa...
        </span>
      </div>
    </div>
  );
}
