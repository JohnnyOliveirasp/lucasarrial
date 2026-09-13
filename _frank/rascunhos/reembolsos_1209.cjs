// Quem esta pedindo dinheiro de volta e esta parado na fila — o unico bloco
// que precisa de decisao do Johnny (reembolso = falar em nome da empresa).
const { supa } = require("../ferramentas/_comum.cjs");
const sb = supa();
const dias = t => ((Date.now() - new Date(t)) / 864e5).toFixed(1);
(async () => {
  const { data, error } = await sb
    .from("incidents")
    .select("numero,status,title,created_at,last_seen_at,affected_emails,occurrences")
    .in("status", ["open", "investigating", "aguardando_aluno"]);
  if (error) return console.log("ERRO:", error.message);
  const alvo = /reembols|devolu|estorn|garantia|cancelament|cobran|cart[aã]o|dobro|duplicad/i;
  const lista = data.filter(i => alvo.test(String(i.title)));
  console.log(`ABERTOS TOTAIS=${data.length} | COM DINHEIRO EM JOGO=${lista.length}\n`);
  lista.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach(i => {
    const valores = String(i.title).match(/R\$ ?[\d.,]+|EUR ?[\d.,]+|GBP ?[\d.,]+/g);
    console.log(`#${i.numero} [${i.status}] ${dias(i.created_at)}d ${valores ? "VALOR:" + valores.join("/") : ""}`);
    console.log(`   ${String(i.title).slice(0, 150)}`);
    console.log(`   alunos: ${JSON.stringify(i.affected_emails || [])}`);
  });
})().catch(e => console.log("FATAL", e.message));
