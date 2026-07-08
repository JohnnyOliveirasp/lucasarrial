/** Baixa um arquivo de uma URL (presignada) com nome amigável; fallback = abrir
 *  em nova aba. Compartilhado pelo histórico de imagens e pelo painel de vídeo. */
export async function downloadFromUrl(url: string, label: string, fallbackExt = "png") {
  let ext = fallbackExt;
  try {
    const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
    if (m) ext = m[1].toLowerCase();
  } catch {
    /* usa fallback */
  }
  const safe = (label || "arquivo").trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 120) || "arquivo";
  try {
    const res = await fetch(url, { cache: "no-store" });
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${safe}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}
