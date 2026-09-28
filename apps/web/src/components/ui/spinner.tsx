import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

// Castor: decorative (aria-hidden) unless `label` is given. Most spinners sit next to text that already says
// what is happening (a button's label); a spinner standing alone passes its translated label.
function Spinner({
  className,
  label,
  ...props
}: React.ComponentProps<"svg"> & { label?: string }) {
  return (
    <Loader2Icon
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
