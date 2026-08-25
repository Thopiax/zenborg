"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WeekPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cultivate");
  }, [router]);

  return null;
}
