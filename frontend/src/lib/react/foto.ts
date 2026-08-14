/**
 * Prepara a foto do avatar para o React: **meio corpo pra cima + fundo verde**.
 *
 * Por que existe (pedido do Johnny 14/08): a foto que o aluno tem é de corpo
 * inteiro, na parede da sala, do jeito que ele tirou. No React ele aparece
 * REDUZIDO por cima do viral — de corpo inteiro o rosto vira um pontinho — e
 * o recorte só funciona se o fundo for chapado.
 *
 * Usa o MESMO motor que já está em produção no Gerador de Imagem
 * (`gpt-image-2-image-to-image` no Kie). Provado na mão em 14/08 com a foto
 * da Rayanne: o verde saiu uniforme, os fios de cabelo sobreviveram e o
 * `chromakey` do ffmpeg recortou limpo sobre fundo claro E escuro.
 *
 * ⚠️ Limitação conhecida e aceita: esses modelos REDESENHAM a pessoa (o
 * enquadramento fecha, o sorriso abre, a pele alisa). O Johnny decidiu que
 * serve, porque no React o avatar aparece pequeno e o viral é a atração.
 * Se um dia precisar de fidelidade total, o caminho é segmentação (recorte
 * pixel a pixel), que preserva 100% a pessoa mas exige dependência nova.
 */
import { kieCreateImageTask } from "@/lib/kie/client";

/** O prompt é a peça mais importante deste arquivo — mexer com cuidado. */
const PROMPT = [
  "Reframe this photo as a waist-up portrait: head and shoulders large and centered,",
  "facing the camera, eyes toward the lens. Keep the SAME person, same face, same hair,",
  "same clothes, same skin tone — do not beautify or change identity.",
  "Replace the background with a solid uniform chroma key green (#00B140).",
  "Photorealistic, sharp focus on the face, no green spill on skin or hair,",
  "preserve fine hair detail at the edges. Vertical 3:4 framing.",
].join(" ");

export type FotoPreparada = { taskId: string };

/**
 * Dispara o preparo. Devolve o taskId — quem chama acompanha pelo mesmo
 * caminho das outras imagens (o Kie é assíncrono, igual ao RunPod).
 */
export async function prepararFotoVerde(imageUrl: string): Promise<FotoPreparada> {
  const { taskId } = await kieCreateImageTask({
    prompt: PROMPT,
    input_urls: [imageUrl],
    aspect_ratio: "3:4",
    resolution: "2K",
  });
  return { taskId };
}
