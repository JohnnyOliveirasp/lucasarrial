/**
 * Preenche o workflow API do InfiniteTalk por job. O template é uma CÓPIA de
 * comfyui-worker/workflows/infinitetalk_api_template.json (fonte da verdade —
 * se o fluxo mudar lá, copiar de novo). Tabela de injeção: comfyui-worker/README.md.
 * Server-only.
 */
import { CLONE_FPS, CloneTier } from "./config";
import templateV1 from "./infinitetalk-template.json";
import templateV2 from "./infinitetalk-v2-template.json";
import templateV3 from "./infinitetalk-v3-template.json";

/**
 * Como a FOTO de entrada entra no quadro do clone (nó 171, `ImageResizeKJv2`).
 *
 * ⚠️ POR QUE ISTO EXISTE (20/08, Vídeo React): o template resolve o encaixe
 * com `keep_proportion: "crop"` — ele mantém a altura e CORTA a largura que
 * sobra. Uma foto 3:4 (2016×2688) indo pro 480×832 do tier perde 465px de
 * largura, ~232 de cada lado: é exatamente onde ficam os BRAÇOS. Depois disso
 * nenhum ffmpeg traz o braço de volta, porque ele nunca foi gerado.
 *
 * ⚠️ NÃO É PRA TODO MUNDO. Sem este campo o workflow sai byte a byte igual ao
 * template validado — Vídeo Clone e Estúdio continuam como sempre foram. Só
 * quem passa `enquadrar` muda de comportamento (hoje: só o Vídeo React).
 */
export type EnquadrarFoto = {
  /** `"pad"` cabe INTEIRA e preenche a sobra; `"crop"` (default) corta. */
  modo: "pad" | "crop";
  /**
   * Cor da sobra no modo `pad`, em "R, G, B". Num fluxo com chromakey tem que
   * ser o MESMO verde do recorte, senão a sobra vira moldura na tela.
   */
  corPad?: string;
};

type WorkflowNode = { class_type: string; inputs: Record<string, unknown> };
type Workflow = Record<string, WorkflowNode>;

/**
 * Aplica o enquadramento no nó 171, se e somente se o chamador pediu.
 * Silencioso quando o fluxo não tem o nó (o v1 redimensiona noutro lugar).
 */
function aplicarEnquadramento(wf: Workflow, e?: EnquadrarFoto): void {
  if (!e) return;
  const no = wf["171"];
  if (!no) return;
  no.inputs.keep_proportion = e.modo;
  if (e.modo === "pad" && e.corPad) no.inputs.pad_color = e.corPad;
}

export function buildInfiniteTalkWorkflow(args: {
  imageUrl: string;
  audioUrl: string;
  s3Key: string;
  tier: CloneTier;
  durationSeconds: number;
  seed?: number;
  /** Opcional. Sem isto o template fica intocado — ver `EnquadrarFoto`. */
  enquadrar?: EnquadrarFoto;
}): { workflow: Workflow; numFrames: number } {
  const seed = args.seed ?? Math.floor(Math.random() * 2 ** 31);

  if (args.tier.flow === "v3") {
    // V3 = fluxo "InfiniteTalkV2" do Johnny (07/08), byte a byte como validado
    // no ComfyUI dele — NÃO mexer nas configurações (ordem). Só I/O é nosso:
    // imagem/áudio por URL presignada + MP4 pro R2. num_frames replica a
    // fórmula dos nodes RH do fluxo original: floor(segundos)×25 + 25.
    // Seed fica 1 (fixa no template, como no fluxo validado).
    const wf = JSON.parse(JSON.stringify(templateV3)) as Workflow;
    const numFrames = Math.floor(args.durationSeconds) * CLONE_FPS + CLONE_FPS;
    wf["133"].inputs.url = args.imageUrl;
    wf["125"].inputs.url = args.audioUrl;
    wf["900"].inputs.s3_key = args.s3Key;
    wf["194"].inputs.num_frames = numFrames;
    aplicarEnquadramento(wf, args.enquadrar);
    return { workflow: wf, numFrames };
  }

  if (args.tier.flow === "v2") {
    // V2 (fp8 + 4 steps flowmatch): modelos fixos no template; fórmula de
    // frames do fluxo original = duração×25 + 25 (colchão de motion frames).
    const wf = JSON.parse(JSON.stringify(templateV2)) as Workflow;
    const numFrames = Math.max(50, Math.ceil(args.durationSeconds * CLONE_FPS) + 25);
    wf["133"].inputs.url = args.imageUrl;
    wf["125"].inputs.url = args.audioUrl;
    wf["900"].inputs.s3_key = args.s3Key;
    wf["171"].inputs.width = args.tier.width;
    wf["171"].inputs.height = args.tier.height;
    wf["194"].inputs.num_frames = numFrames;
    wf["128"].inputs.seed = seed;
    aplicarEnquadramento(wf, args.enquadrar);
    return { workflow: wf, numFrames };
  }

  // V1 (GGUF Q5 + 7 steps dpm++_sde): modelos/LoRA injetados por tier.
  const wf = JSON.parse(JSON.stringify(templateV1)) as Workflow;
  const numFrames = Math.max(25, Math.ceil(args.durationSeconds * CLONE_FPS));
  wf["284"].inputs.url = args.imageUrl; // imagem (presigned GET)
  wf["125"].inputs.url = args.audioUrl; // áudio (presigned GET)
  wf["900"].inputs.s3_key = args.s3Key; // MP4 final no R2
  wf["245"].inputs.value = args.tier.width;
  wf["246"].inputs.value = args.tier.height;
  wf["270"].inputs.value = numFrames;
  wf["122"].inputs.model = args.tier.ggufModel;
  wf["138"].inputs.lora = args.tier.lora;
  wf["128"].inputs.seed = seed;

  return { workflow: wf, numFrames };
}
