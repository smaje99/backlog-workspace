import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
