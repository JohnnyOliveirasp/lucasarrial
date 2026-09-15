/**
 * ficha_bounce — imprime a ficha de "e-mail não chegou" com as TENTATIVAS DE
 * CONTATO e o PRÓXIMO PASSO **recalculados agora**, contra `emails_enviados`.
 *
 * POR QUE EXISTE (b32af5ff, e a 4ª repetição do mesmo erro). A ronda lê a fila
 * com `select ... from incidents` cru (03_ROTINA §1). O que está gravado na
 * coluna `description` foi escrito no dia do ÚLTIMO BOUNCE e nunca mais mudou —
 * reenvio que DÁ CERTO não escreve nada ali. Foi assim que a ficha da Valdeni
 * seguiu dizendo "tentar de novo mais tarde costuma funcionar" três dias depois
 * da mensagem ter ENTRADO (13/09 22:13Z, sem bounce), e foi essa frase que
 * produziu quatro ordens de reenvio — a última pedindo gerar link de recovery
 * novo, o que teria SOBRESCRITO `auth.users.recovery_sent_at`, a única prova de
 * que a entrega aconteceu.
 *
 * O quadro /admin/falhas já recalcula na leitura (rota GET de incidents). Esta
 * ferramenta é o mesmo cálculo para quem lê a fila por SQL, que é a ronda.
 *
 *   node _frank/ferramentas/ficha_bounce.cjs                  # todas as abertas
 *   node _frank/ferramentas/ficha_bounce.cjs <email>          # uma pessoa
 *   node _frank/ferramentas/ficha_bounce.cjs --id <incidente> # uma ficha
 *
 * SÓ LÊ. Não grava, não envia e-mail, não gera link de recovery.
 */
const { supa } = require("./_comum.cjs");

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};

(async () => {
  // Type-stripping nativo do Node 22 (mesmo caminho do
  // curar_msg_envio_incompleto.cjs): a regra mora no TS e não é copiada aqui,
  // senão vira um segundo lugar pra divergir.
  const T = await import("../../frontend/src/lib/agent/contato-tentativas.ts");
  const db = supa();
  const agoraMs = Date.now();

  const id = arg("--id");
  const alvo = process.argv.slice(2).find((x) => x.includes("@")) || null;

  let q = db
    .from("incidents")
    .select("id, status, title, description, signature, first_seen_at, last_seen_at, affected_emails")
    .like("signature", "fast-bounce:%")
    .order("last_seen_at", { ascending: false });
  if (id) q = q.eq("id", id);
  else if (alvo) q = q.contains("affected_emails", [alvo.toLowerCase()]);
  else q = q.in("status", ["open", "investigating"]);

  const { data: fichas, error } = await q;
  if (error) {
    console.error("ERRO ao ler incidents:", error.message);
    process.exit(1);
  }
  if (!fichas.length) {
    console.log("# nenhuma ficha de bounce com esse filtro.");
    return;
  }

  const emails = [
    ...new Set(
      fichas
        .map((f) => (f.signature || "").split(":").slice(2).join(":").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const { data: envios, error: e2 } = await db
    .from("emails_enviados")
    .select("to_email, enviado_em, assunto, origem, bounce_em, bounce_classe")
    .in("to_email", emails)
    .order("enviado_em", { ascending: true });
  if (e2) {
    console.error("ERRO ao ler emails_enviados:", e2.message);
    process.exit(1);
  }

  for (const f of fichas) {
    const email = (f.signature || "").split(":").slice(2).join(":").trim().toLowerCase();
    const resumo = T.resumirContato({
      tentativas: (envios || [])
        .filter((l) => (l.to_email || "").toLowerCase() === email)
        .map((l) => ({
          enviadoEm: l.enviado_em,
          assunto: l.assunto,
          origem: l.origem,
          bounceEm: l.bounce_em,
          bounceClasse: l.bounce_classe,
        })),
      fichaDesde: f.first_seen_at || null,
      agoraMs,
    });
    console.log(`\n===== ${f.id}  [${f.status}]  ${f.title}`);
    console.log(T.reescreverFichaDeBounce(f.description || "", resumo, agoraMs));
  }
  console.log(
    `\n# ${fichas.length} ficha(s). O bloco acima foi RECALCULADO agora — a coluna 'description' no banco` +
      `\n# pode estar velha, porque reenvio que dá certo não escreve nada nela. Não decida pelo SELECT cru.`,
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
