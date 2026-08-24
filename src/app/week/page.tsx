"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { cultivateZoom$ } from "@/infrastructure/state/ui-store";

export default function WeekPage() {
  const router = useRouter();

  useEffect(() => {
    cultivateZoom$.set("time");
    router.replace("/cultivate");
  }, [router]);

  return null;
}
