/** Tipagem mínima do qrcode@1.5.4 (só o que usamos: desenhar no canvas). */
declare module "qrcode" {
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: {
      width?: number;
      margin?: number;
      color?: { dark?: string; light?: string };
    },
  ): Promise<void>;
  const QRCode: { toCanvas: typeof toCanvas };
  export default QRCode;
}
