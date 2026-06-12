import * as React from "react";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = {
  online: "var(--status-online)",
  warn: "var(--status-warn)",
  offline: "var(--ash)",
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name?: string;
  size?: number;
  status?: "online" | "warn" | "offline";
}

/**
 * FastPost Avatar — monocromático. Imagem, ou iniciais num well escuro com
 * hairline. Dot de status opcional no canto. Nunca placeholder de stock photo.
 */
export function Avatar({
  className,
  src,
  name = "",
  size = 40,
  status,
  style,
  ...props
}: AvatarProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dot = Math.max(8, size * 0.26);

  return (
    <div
      className={cn("relative flex-none", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-[var(--radius-full)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] font-medium tracking-[-0.01em] text-[var(--silver)]"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      {status && (
        <span
          className="absolute -bottom-px -right-px rounded-full border-2 border-[var(--canvas)]"
          style={{ width: dot, height: dot, background: STATUS[status] }}
        />
      )}
    </div>
  );
}
