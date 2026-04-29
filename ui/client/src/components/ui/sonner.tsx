import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        duration: 4000
      }}
      {...props}
    />
  );
}
