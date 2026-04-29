import { useEffect } from "react";
import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
}>;

export function Drawer({
  open,
  onClose,
  title,
  description,
  className,
  children
}: DrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-50 transition",
        open ? "visible" : "invisible"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-950/62 backdrop-blur-sm transition-opacity",
          open ? "pointer-events-auto opacity-100" : "opacity-0"
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Detalle del requerimiento"}
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-[52rem] translate-x-full flex-col border-l border-border/70 bg-[linear-gradient(180deg,rgba(8,18,34,0.98),rgba(7,17,31,0.98))] shadow-[-20px_0_90px_-55px_rgba(15,118,110,0.8)] transition-transform duration-300 ease-out",
          open && "pointer-events-auto translate-x-0",
          className
        )}
      >
        {(title || description) && (
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            {title ? (
              <div className="text-2xl font-semibold text-foreground">
                {title}
              </div>
            ) : null}
            {description ? (
              <div className="mt-1 text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
