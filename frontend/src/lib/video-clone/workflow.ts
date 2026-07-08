/**
 * Preenche o workflow API do InfiniteTalk por job. O template é uma CÓPIA de
 * comfyui-worker/workflows/infinitetalk_api_template.json (fonte da verdade —
 * se o fluxo mudar lá, copiar de novo). Tabela de injeção: comfyui-worker/README.md.
 * Server-only.
 */
import { CLONE_FPS, CloneTier } from "./config";
import templateV1 from "./infinitetalk-template.json";
import templateV2 from "./infinitetalk-v2-template.json";

type WorkflowNode = { class_type: string; inputs: Record<string, unknown> };
type Workflow = Record<string, WorkflowNode>;

export function buildInfiniteTalkWorkflow(args: {
  imageUrl: string;
  audioUrl: string;
  s3Key: string;
  tier: CloneTier;
  durationSeconds: number;
  seed?: number;
}): { workflow: Workflow; numFrames: number } {
  const seed = args.seed ?? Math.floor(Math.random() * 2 ** 31);

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
