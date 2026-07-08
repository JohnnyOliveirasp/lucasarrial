/**
 * Preenche o workflow API do InfiniteTalk por job. O template é uma CÓPIA de
 * comfyui-worker/workflows/infinitetalk_api_template.json (fonte da verdade —
 * se o fluxo mudar lá, copiar de novo). Tabela de injeção: comfyui-worker/README.md.
 * Server-only.
 */
import { CLONE_FPS, CloneTier } from "./config";
import template from "./infinitetalk-template.json";

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
  const wf = JSON.parse(JSON.stringify(template)) as Workflow;
  const numFrames = Math.max(25, Math.ceil(args.durationSeconds * CLONE_FPS));

  wf["284"].inputs.url = args.imageUrl; // imagem (presigned GET)
  wf["125"].inputs.url = args.audioUrl; // áudio (presigned GET)
  wf["900"].inputs.s3_key = args.s3Key; // MP4 final no R2
  wf["245"].inputs.value = args.tier.width;
  wf["246"].inputs.value = args.tier.height;
  wf["270"].inputs.value = numFrames;
  wf["122"].inputs.model = args.tier.ggufModel;
  wf["138"].inputs.lora = args.tier.lora;
  wf["128"].inputs.seed = args.seed ?? Math.floor(Math.random() * 2 ** 31);

  return { workflow: wf, numFrames };
}
