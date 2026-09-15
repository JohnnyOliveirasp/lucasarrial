#!/usr/bin/env node
/**
 * MEDE: com quantas gerações o botão "Gerar prompt automático" APAGA a
 * instrução do aluno sobre a FOTO EXTRA.
 *
 * POR QUE EXISTE (#270, Paulo Moura, 15/09): a UI manda o aluno usar fotos
 * extras pra compor cenário — `images.studio.refs.extrasHelp`: "trazer uma
 * foto DIFERENTE pra compor a cena (...) Diga no prompt o que é pra vir de
 * cada foto". Mas `generateImagePrompt(idea: string)` recebe SÓ o texto: não
 * sabe quantas referências existem nem o papel de cada uma, e o SYSTEM dele
 * afirma que há UMA foto de pessoa e que a cena é NOVA ("placed into a new
 * scene"). Resultado medido: o LLM remove "da foto extra" do texto do aluno.
 *
 * RÉGUA: geração com >=2 referências (input_image_paths) cuja IDEIA cita a
 * foto extra, e cujo PROMPT gerado não cita mais. Só conta linha com idea E
 * prompt preenchidos (idea nula = aluno escreveu o prompt à mão, não passou
 * pelo botão — não é população deste defeito).
 *
 * SÓ LEITURA. Não altera nada, não gasta crédito.
 */
const { supa } = require("./_comum.cjs");

const CITA_EXTRA = /foto\s+extra|fotos\s+extras|imagem\s+extra|da\s+extra|nas\s+extras/i;
// "original/originalidade" = o aluno pedindo pra preservar a cena que ele mandou
const CITA_ORIGINAL = /original(idade)?|mesma\s+sala|mesmo\s+escrit[óo]rio|sem\s+perder/i;

(async () => {
  const db = supa();
  const PAGINA = 1000;
  let todas = [], de = 0;
  for (;;) {
    const { data, error } = await db.from("image_generations")
      .select("id,user_id,created_at,status,idea,prompt,input_image_path,input_image_paths")
      .order("created_at").range(de, de + PAGINA - 1);
    if (error) { console.log("ERRO:", error.message); process.exit(1); }
    todas = todas.concat(data);
    if (data.length < PAGINA) break;
    de += PAGINA;
  }
  console.log(`CONTRAPROVA: ${todas.length} linhas lidas (paginado de ${PAGINA} em ${PAGINA})`);

  const comIdeia = todas.filter(g => (g.idea ?? "").trim() && (g.prompt ?? "").trim());
  const multi = comIdeia.filter(g => Array.isArray(g.input_image_paths) && g.input_image_paths.length >= 2);
  const pediuExtra = multi.filter(g => CITA_EXTRA.test(g.idea));
  const apagou = pediuExtra.filter(g => !CITA_EXTRA.test(g.prompt));

  const pediuOriginal = comIdeia.filter(g => CITA_ORIGINAL.test(g.idea));
  const perdeuOriginal = pediuOriginal.filter(g => !CITA_ORIGINAL.test(g.prompt));

  console.log(`\n=== POPULAÇÃO ===`);
  console.log(`  gerações com ideia + prompt (passaram pelo botão): ${comIdeia.length}`);
  console.log(`  dessas, com 2+ referências:                        ${multi.length}`);
  console.log(`  dessas, cuja IDEIA cita a foto extra:              ${pediuExtra.length}`);
  console.log(`  >> e o PROMPT gerado NÃO cita mais:                ${apagou.length}` +
    (pediuExtra.length ? `  (${(100*apagou.length/pediuExtra.length).toFixed(0)}%)` : ""));
  console.log(`\n  ideias que pedem preservar o ORIGINAL:            ${pediuOriginal.length}`);
  console.log(`  >> e o PROMPT gerado perdeu o pedido:              ${perdeuOriginal.length}` +
    (pediuOriginal.length ? `  (${(100*perdeuOriginal.length/pediuOriginal.length).toFixed(0)}%)` : ""));

  const alunos = new Set(apagou.map(g => g.user_id));
  console.log(`\n  ALUNOS ATINGIDOS (apagou a foto extra): ${alunos.size}`);

  console.log(`\n=== AMOSTRA (até 8) ===`);
  for (const g of apagou.slice(0, 8)) {
    console.log("-".repeat(88));
    console.log(`${g.created_at} · aluno ${String(g.user_id).slice(0,8)} · ${g.input_image_paths.length} refs`);
    console.log(`  IDEIA : ${String(g.idea).replace(/\s+/g," ").slice(0,220)}`);
    console.log(`  PROMPT: ${String(g.prompt).replace(/\s+/g," ").slice(0,220)}`);
  }
})();
