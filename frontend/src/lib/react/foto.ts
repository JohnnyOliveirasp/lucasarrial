/**
 * Prepara a foto do avatar para o React: **meio corpo pra cima + fundo verde**.
 *
 * Por que existe (pedido do Johnny 14/08): a foto que o aluno tem é de corpo
 * inteiro, na parede da sala, do jeito que ele tirou. No React ele aparece
 * REDUZIDO por cima do viral — de corpo inteiro o rosto vira um pontinho — e
 * o recorte só funciona se o fundo for chapado.
 *
 * ⚖️ O equilíbrio é fino: fechar demais mata os braços, abrir demais mata o
 * rosto. A referência medida (reel do Lucas) é a cintura pra cima.
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

/**
 * O prompt é a peça mais importante deste arquivo — mexer com cuidado.
 *
 * 🔁 Corrigido 15/08: a 1ª versão pedia "head and shoulders large" e o
 * enquadramento fechava tanto que **os braços sumiam** — o Johnny reclamou
 * vendo o próprio React. Baixei o reel de referência do Lucas e medi: ele
 * aparece da CINTURA pra cima, no canto inferior esquerdo, ocupando ~38% da
 * largura (o mesmo do nosso layout) e com **os braços e a mão gesticulando
 * dentro do quadro**. É isso que dá vida à reação; só cabeça parece foto 3x4.
 *
 * 🔁 Corrigido 17/08: foto de CORPO INTEIRO entrava e SAÍA de corpo inteiro
 * (teste do Johnny com a própria foto — ele ficou pequeno no quadro). O
 * "reframe as three-quarter shot" era sugestão fraca demais: o modelo
 * preferia obedecer ao enquadramento da foto de entrada. Agora a ordem é
 * dura: CORTAR NA CINTURA, nada abaixo dela aparece, e a pessoa PREENCHE o
 * frame (cabeça perto do topo, cintura na borda de baixo).
 */
const PROMPT = [
  "CROP THIS PHOTO AT THE WAIST — a waist-up medium shot. Nothing below the",
  "waist may appear: no hips, no legs, no knees, no feet, regardless of the",
  "input photo's framing. The person must FILL the frame: head near the top",
  "edge, waist at the bottom edge.",
  "BOTH ARMS AND HANDS FULLY VISIBLE inside the frame, in a natural relaxed",
  "gesturing pose, facing the camera, eyes toward the lens — do not crop the",
  "arms, elbows or hands.",
  "Keep the SAME person, same face, same hair, same clothes, same skin tone —",
  "do not beautify or change identity.",
  "Replace the background with a solid uniform chroma key green (#00B140).",
  "Photorealistic, sharp focus on the face, no green spill on skin or hair,",
  "preserve fine hair detail at the edges. Vertical 3:4 framing.",
].join(" ");

/** Resolução do preparo — a rota cobra o preço de imagem desta resolução. */
export const FOTO_REACT_RESOLUTION = "2K";

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
    resolution: FOTO_REACT_RESOLUTION,
  });
  return { taskId };
}
