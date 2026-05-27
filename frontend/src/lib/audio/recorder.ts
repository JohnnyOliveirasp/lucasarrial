/**
 * Utilitários de gravação de voz no browser (Web Audio API).
 *
 * Captura PCM cru via AudioWorklet (não MediaRecorder/opus — qualidade pro
 * treino), encoda WAV 16-bit mono no cliente, e mede energia (RMS) pra nível +
 * detecção de silêncio. Sem dependências externas.
 */

/** Processor do AudioWorklet: acumula ~2048 samples e posta pro main thread. */
export const PCM_WORKLET_SRC = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() { super(); this._buf = []; this._n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch && ch.length) {
      this._buf.push(ch.slice(0));
      this._n += ch.length;
      if (this._n >= 2048) {
        const out = new Float32Array(this._n);
        let o = 0;
        for (const b of this._buf) { out.set(b, o); o += b.length; }
        this._buf = []; this._n = 0;
        this.port.postMessage(out);
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

/** Cria um Blob URL com o source do worklet (browser only). */
export function workletUrl(): string {
  const blob = new Blob([PCM_WORKLET_SRC], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

/** RMS (0..1) de um bloco de samples. */
export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/** Concatena chunks Float32 num único buffer. */
export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Encoda Float32 mono → WAV PCM 16-bit. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}
