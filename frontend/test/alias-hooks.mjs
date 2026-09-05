/**
 * Hooks de resolução pro `node --test`: ensina o runner a achar `@/...`
 * (o alias do tsconfig) e os imports relativos SEM extensão.
 *
 * Por que existe: a convenção da casa é testar módulo PURO, sem alias (PR
 * #159). Só que a prova pedida no corte do zap de escalação (04/09) é sobre o
 * fluxo INTEIRO — precisa carregar `escalate.ts`, que importa `@/lib/...`.
 * Isto é EXCLUSIVO de teste: nada em produção usa este arquivo.
 */
const SRC = new URL("../src/", import.meta.url).href;

export async function resolve(specifier, context, next) {
  const spec = specifier.startsWith("@/") ? SRC + specifier.slice(2) : specifier;
  try {
    return await next(spec, context);
  } catch (erro) {
    // `./closure` → `./closure.ts` (e, se for pasta, `./closure/index.ts`).
    if (spec.startsWith("file://") || spec.startsWith(".")) {
      try {
        return await next(spec + ".ts", context);
      } catch {
        return await next(spec + "/index.ts", context);
      }
    }
    throw erro;
  }
}
