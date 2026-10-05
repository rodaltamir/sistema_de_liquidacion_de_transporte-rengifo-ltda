"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function PersonalPageRedirect() {
  const router = useRouter();
  const routeParams = useParams();
  const schema = (routeParams?.schema as string) || "";

  useEffect(() => {
    if (schema) {
      router.replace(`/${schema}/clientes`);
    }
  }, [router, schema]);

  return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
        Redirigiendo a Clientes...
      </span>
    </div>
  );
}
