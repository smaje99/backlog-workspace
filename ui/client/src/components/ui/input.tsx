import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-ring/15",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
