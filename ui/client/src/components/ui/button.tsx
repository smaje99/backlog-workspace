import * as React from "react";

import { cn } from "@/lib/utils";

const variants = {
  default:
    "bg-primary text-primary-foreground shadow-[0_10px_30px_-18px_rgba(15,23,42,0.75)] hover:bg-primary/90",
  secondary:
    "bg-card text-foreground border border-border hover:bg-accent hover:text-accent-foreground",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
} as const;

const sizes = {
  default: "h-10 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-5 text-sm"
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[calc(var(--radius)-4px)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
