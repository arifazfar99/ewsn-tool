"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCapturedOccurrence } from "@/lib/useCapturedOccurrence";
import Toast from "./Toast";

export default function SuccessToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const successParam = searchParams.get("success");
  const searchParamsString = searchParams.toString();

  const captured = useCapturedOccurrence(successParam);

  useEffect(() => {
    if (!successParam) return;

    const params = new URLSearchParams(searchParamsString);
    params.delete("success");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [successParam, searchParamsString, pathname, router]);

  if (!captured) return null;

  return <Toast key={captured.nonce} message={captured.value} />;
}
