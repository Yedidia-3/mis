import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-none border-border/80 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] focus-visible:bg-white aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-20 w-full rounded-xl border bg-input-background px-3.5 py-2 text-base transition-all duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
