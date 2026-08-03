"use client";

/**
 * "Ou grave pelo celular" — seção do Gravador OFICIAL (graduação do Lab
 * 03/08, aprovada pelo Johnny). QR + takes chegando com player/apagar.
 * Os takes entram AUTOMATICAMENTE no treino na criação da voz
 * (voice-creator importa e apaga depois do envio).
 */
import { useEffect, useRef, useState } from "react";
import { Copy, Check, Smartphone, Trash2 } from "lucide-react";

type Take = { key: string; name: string; size: number; at: string | null; url: string };

export function PhoneRecorderSection() {
  const [token, setToken] = useState<string | null>(null);
  const [phoneUrl, setPhoneUrl] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/v1/recorder-test/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.token) return;
        setToken(j.token as string);
        setPhoneUrl(j.phoneUrl as string);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!phoneUrl || !qrRef.current) return;
    void import("qrcode").then(({ toCanvas }) => {
      if (qrRef.current) {
        void toCanvas(qrRef.current, phoneUrl, { width: 168, margin: 1, color: { dark: "#ffffff", light: "#0a0a0c" } });
      }
    });
  }, [phoneUrl]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/v1/recorder-test/takes", { headers: { "x-recorder-token": token! } });
        const j = await res.json();
        if (alive && res.ok) {
          // URL nova a cada poll resetaria o <audio> tocando — preserva os já listados.
          setTakes((prev) => {
            const seen = new Map(prev.map((t) => [t.key, t]));
            return ((j.takes ?? []) as Take[]).map((t) => seen.get(t.key) ?? t);
          });
        }
      } catch { /* próxima volta */ }
    }
    void poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [token]);

  async function copy() {
    if (!phoneUrl) return;
    await navigator.clipboard.writeText(phoneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function removeTake(key: string) {
    setTakes((ts) => ts.filter((t) => t.key !== key));
    try {
      await fetch(`/api/v1/recorder-test/takes?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "x-recorder-token": token ?? "" },
      });
    } catch { /* o poll ressincroniza */ }
  }

  if (!phoneUrl) return null;

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-[var(--ash)]" />
        <h2 className="font-sans text-[16px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          Ou grave pelo celular
        </h2>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--mute)]">
        Microfone de lapela no celular grava melhor que o notebook (sem barulho de ventilador).
        Aponte a câmera pro QR, deixe o roteiro nesta tela e grave — cada take aparece aqui
        e <strong className="text-[var(--body)]">entra automaticamente no treino</strong> quando você criar a voz.
      </p>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[#0a0a0c] p-2.5">
            <canvas ref={qrRef} className="rounded-[4px]" />
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--mute)] hover:text-[var(--ink)]"
          >
            {copied ? <Check className="size-3 text-[var(--status-online)]" /> : <Copy className="size-3" />}
            {copied ? "link copiado" : "copiar link"}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">
            Takes do celular · {takes.length}
          </p>
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {takes.map((t) => (
              <li key={t.key} className="flex flex-col gap-1 rounded-[var(--radius)] border border-[var(--hairline)] p-2.5">
                <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-[var(--ash)]">
                  <span className="truncate">{t.name}</span>
                  <button
                    type="button"
                    onClick={() => void removeTake(t.key)}
                    className="inline-flex flex-none items-center gap-1 uppercase tracking-wide text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
                  >
                    <Trash2 className="size-3" /> apagar
                  </button>
                </span>
                <audio controls preload="none" src={t.url} className="h-8 w-full" />
              </li>
            ))}
            {takes.length === 0 && (
              <li className="py-3 font-mono text-[11px] text-[var(--ash)]">nenhum take ainda — escaneie o QR e grave</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
