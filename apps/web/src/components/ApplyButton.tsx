import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Always sends application traffic to the original authorized application URL (brief §27). */
export function ApplyButton({ applyUrl }: { applyUrl: string }) {
  return (
    <a
      href={applyUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full sm:w-auto")}
    >
      Apply now
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}
