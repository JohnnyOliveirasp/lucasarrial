/**
 * A CAMADA DE IO do histórico de contato: lê `emails_enviados` e devolve a
 * ficha de bounce com o bloco TENTATIVAS e o PRÓXIMO PASSO **recalculados no
 * momento da leitura**. A regra pura mora no `contato-tentativas.ts`, que segue
 * sem Supabase e testável com `node --test` — mesma divisão do
 * `mail-bounce.ts` / `mail-bounce-registro.ts`.
 *
 * POR QUE A LEITURA, E NÃO SÓ O BOUNCE (b32af5ff). A primeira versão deste
 * conserto montava o bloco dentro do `descrever()`, que só roda quando chega um
 * bounce NOVO. O gatilho era o evento de falha — e o caso que abriu o cartão é o
 * oposto: a 3ª tentativa da Valdeni (13/09 22:13Z) DEU CERTO e não voltou bounce
 * nenhum, então nada regravava a ficha e ela seguia com o conselho do 2º bounce,
 * de três dias antes. Sucesso não dispara nada. Quem lê a ficha depois de um
 * reenvio que funcionou — que é o caminho mais comum — continuaria lendo "tente
 * de novo", que é literalmente a frase que gerou as quatro ordens de reenvio.
 *
 * Então: toda renderização refaz a conta contra o banco de agora. Sem coluna
 * nova, sem migration (regra 21), sem um segundo lugar pra divergir.
 *
 * ⚠️ NUNCA LANÇA. Ficha crua é ruim; quadro de falhas fora do ar é pior. Falha
 * aqui vira log e a descrição sai no formato em que foi gravada.
 */
import { getAdmin } from "@/lib/db/admin";
import {
  reescreverFichaDeBounce,
  resumirContato,
  type ResumoDeContato,
} from "./contato-tentativas";

/** `fast-bounce:<classe>:<email>` — a assinatura carrega o endereço afetado. */
const SIGNATURE_BOUNCE = /^fast-bounce:[^:]+:(.+)$/;

/** Uma linha de `emails_enviados`, só as colunas que a ficha usa. */
type LinhaEnvio = {
  to_email: string;
  enviado_em: string;
  assunto: string | null;
  origem: string | null;
  bounce_em: string | null;
  bounce_classe: string | null;
};

/**
 * Lê o histórico de contato de cada aluno.
 *
 * ⚠️ DERIVA DE `emails_enviados`, não persiste em coluna nova — e a escolha é
 * medida, não estética. (a) Coluna nova (`incidents.contact_attempts`) exigiria
 * migration, e migration precisa do aval do Johnny (regra 21); as migrations
 * 85, 104 e 107 seguem pendentes, então o código nasceria logando erro em
 * silêncio, que é exatamente o defeito que esta ficha veio consertar. (b)
 * Coluna nova nasce VAZIA e só passa a valer daqui pra frente, enquanto
 * `emails_enviados` já responde a pergunta pra todo envio que passa pelo
 * `sendSupportMail`. (c) Dado duplicado em dois lugares é dois lugares pra
 * divergir: a verdade sobre envio já mora em `emails_enviados` e sobre bounce
 * já mora na mesma linha.
 *
 * `nascimentoPorEmail` é o `first_seen_at` da ficha, quando quem chamou já o
 * tem em mãos (o caminho de leitura tem: veio no mesmo SELECT). É ele que
 * denuncia cobertura PARCIAL — ficha mais velha que o registro de envios tem
 * tentativas que a lista não enxerga, e renderizar isso como "0 tentativas"
 * seria o zero cego que faz a ficha pedir reenvio de novo. Quando não vem, é
 * buscado aqui.
 */
export async function lerHistoricoDeContato(
  emails: string[],
  agoraMs: number,
  nascimentoPorEmail?: Map<string, string>,
): Promise<Record<string, ResumoDeContato>> {
  const fora: Record<string, ResumoDeContato> = {};
  if (!emails.length) return fora;
  try {
    const admin = getAdmin();
    const alvos = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!alvos.length) return fora;

    const { data, error } = await admin
      .from("emails_enviados" as never)
      .select("to_email, enviado_em, assunto, origem, bounce_em, bounce_classe")
      .in("to_email", alvos)
      .order("enviado_em", { ascending: true });
    if (error) {
      // Tabela ausente (migration 108 não aplicada) cai aqui: log e segue.
      console.error("[agent/bounce] histórico de contato indisponível:", error.message);
      return fora;
    }
    const linhas = (data ?? []) as unknown as LinhaEnvio[];

    const nascimento = nascimentoPorEmail ?? (await nascimentoDasFichas(alvos));

    for (const alvo of alvos) {
      fora[alvo] = resumirContato({
        tentativas: linhas
          .filter((l) => (l.to_email ?? "").toLowerCase() === alvo)
          .map((l) => ({
            enviadoEm: l.enviado_em,
            assunto: l.assunto,
            origem: l.origem,
            bounceEm: l.bounce_em,
            bounceClasse: l.bounce_classe,
          })),
        fichaDesde: nascimento.get(alvo) ?? null,
        agoraMs,
      });
    }
    return fora;
  } catch (e) {
    console.error("[agent/bounce] histórico de contato falhou:", e instanceof Error ? e.message : e);
    return fora;
  }
}

/** `first_seen_at` mais antigo por e-mail, entre as fichas de bounce. */
async function nascimentoDasFichas(alvos: string[]): Promise<Map<string, string>> {
  const nascimento = new Map<string, string>();
  const { data } = await getAdmin()
    .from("incidents" as never)
    .select("first_seen_at, affected_emails")
    .like("signature", "fast-bounce:%")
    .overlaps("affected_emails", alvos);
  for (const f of (data ?? []) as unknown as Array<{ first_seen_at: string; affected_emails: string[] }>) {
    for (const e of f.affected_emails ?? []) {
      const chave = e.toLowerCase();
      const atual = nascimento.get(chave);
      if (!atual || f.first_seen_at < atual) nascimento.set(chave, f.first_seen_at);
    }
  }
  return nascimento;
}

/** O mínimo que um incidente precisa ter pra ser enriquecido. */
export type FichaEnriquecivel = {
  signature?: string | null;
  description?: string | null;
  first_seen_at?: string | null;
};

/**
 * O PONTO DE LEITURA. Recebe a lista de incidentes como ela saiu do banco e
 * devolve a mesma lista com a `description` das fichas de bounce reescrita
 * contra o `emails_enviados` de AGORA.
 *
 * Um SELECT a mais por render do quadro (a lista inteira num `in`), não um por
 * ficha. Quem não é `fast-bounce:` passa intocado, e quando não há nenhuma a
 * função nem chega no banco.
 */
export async function enriquecerFichasDeBounce<T extends FichaEnriquecivel>(
  incidents: T[],
  agoraMs: number = Date.now(),
): Promise<T[]> {
  try {
    const nascimento = new Map<string, string>();
    const emails: string[] = [];
    for (const inc of incidents) {
      const m = SIGNATURE_BOUNCE.exec(inc.signature ?? "");
      if (!m || !inc.description) continue;
      const email = m[1].trim().toLowerCase();
      emails.push(email);
      // O `first_seen_at` já veio no SELECT do quadro: usar o da própria ficha
      // evita uma segunda consulta e é mais exato que o mínimo global.
      const nasceu = inc.first_seen_at ?? null;
      const atual = nascimento.get(email);
      if (nasceu && (!atual || nasceu < atual)) nascimento.set(email, nasceu);
    }
    if (!emails.length) return incidents;

    const contato = await lerHistoricoDeContato(emails, agoraMs, nascimento);
    if (!Object.keys(contato).length) return incidents;

    return incidents.map((inc) => {
      const m = SIGNATURE_BOUNCE.exec(inc.signature ?? "");
      if (!m || !inc.description) return inc;
      const r = contato[m[1].trim().toLowerCase()];
      if (!r) return inc;
      return { ...inc, description: reescreverFichaDeBounce(inc.description, r, agoraMs) };
    });
  } catch (e) {
    console.error("[agent/bounce] enriquecer fichas falhou:", e instanceof Error ? e.message : e);
    return incidents;
  }
}
