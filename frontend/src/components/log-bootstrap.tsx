"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clientLogger } from "@/lib/logger/client";

export function LogBootstrap() {
  const pathname = usePathname();

  // Pageview on route change
  useEffect(() => {
    clientLogger.info("pageview", {
      pathname,
      viewport: typeof window !== "undefined"
        ? { w: window.innerWidth, h: window.innerHeight }
        : undefined,
    });
  }, [pathname]);

  // Global error handlers — install once
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onError(event: ErrorEvent) {
      clientLogger.error("window.onerror", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      clientLogger.error("unhandledrejection", {
        reason:
          reason instanceof Error
            ? { message: reason.message, stack: reason.stack, name: reason.name }
            : String(reason),
      });
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        clientLogger.beacon({
          level: "debug",
          scope: "client",
          msg: "page.hidden",
          meta: { pathname: window.location.pathname },
        });
      }
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    document.addEventListener("visibilitychange", onVisibility);

    clientLogger.info("client.mounted", {
      ua: navigator.userAgent,
      lang: navigator.language,
      pathname: window.location.pathname,
    });

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
