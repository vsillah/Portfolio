"use client";

import { usePathname } from "next/navigation";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function ConditionalSpeedInsights() {
  const pathname = usePathname();
  if (pathname === "/work/trumpet-trainer/recruitment") return null;
  return <SpeedInsights />;
}
