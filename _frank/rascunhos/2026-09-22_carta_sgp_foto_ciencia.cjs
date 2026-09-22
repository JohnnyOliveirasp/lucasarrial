/**
 * Carta para quem ficou preso na TELA DE FOTO do SGP antes do conserto.
 *
 * Classe medida em 22/09 (ronda das falhas): pedido em status "foto", com
 * fotos APROVADAS em numero suficiente (>= SGP_FOTOS_MIN = 4) e ciencia_foto
 * VAZIA. Sao pessoas que fizeram a parte dificil e pararam a um clique do fim,
 * sem que a tela dissesse o que faltava. Todas pararam ANTES do c08da4b9
 * (15/09 02:17Z), que e justamente o conserto do botao mudo.
 *
 * O conserto ESTA no ar (md5 do fonte no Hetzner == origin/main; POST em
 * /api/v1/sgp/foto/ciencia devolve 400, e rota inventada devolve 404).
 *
 * A RESSALVA QUE A CARTA PRECISA TER, E POR QUE:
 * o pedido do SGP e identificado SO pelo cookie httpOnly `sgp_sessao`
 * (lib/sgp/sessao.ts, 30 dias). Nao existe recuperacao por e-mail+codigo de um
 * pedido que ja existe: pedidoDaSessao() ou acha a linha do cookie ou CRIA UMA
 * NOVA em branco. Entao "volte no link" so e verdade no MESMO navegador. Dizer
 * isso sem a ressalva seria mandar a pessoa refazer tudo achando que e culpa
 * dela.
 *
 * uso: node este.cjs --dry-run   |   node este.cjs --enviar
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
const ENVIAR = path.join(RAIZ, "_frank", "ferramentas", "enviar_email.cjs");
const CHAVE = "sgp-foto-5-confirmacoes";

// Medidos um a um no banco em 22/09 ~19hZ. `aprovadas` e o numero REAL de
// fotos com status "aprovada" daquela pessoa — a carta nao arredonda.
const PESSOAS = [
  { nome: "Wellington", email: "luzwellington@hotmail.com", aprovadas: 6, parado_d: "12" },
  { nome: "Julio Cesar", email: "jcesaram@gmail.com", aprovadas: 4, parado_d: "10" },
  { nome: "Jussilene", email: "jununes42@hotmail.com", aprovadas: 4, parado_d: "9" },
  { nome: "Elaine", email: "elaineesthetician@gmail.com", aprovadas: 5, parado_d: "8" },
];

const CONFIRMACOES = [
  "Foto com boa iluminação (luz de frente, sem sombras no rosto)",
  "Fundo limpo e sem distrações visuais",
  "Enquadramento do busto para cima, olhando para a câmera",
  "Foto nítida e em alta resolução (sem blur)",
  "Sem óculos de sol, chapéu ou acessórios cobrindo o rosto",
];

function corpo(p) {
  const itens = CONFIRMACOES.map((c) => `<li style="margin:4px 0">${c}</li>`).join("\n");
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222">
<p>Oi, ${p.nome}.</p>

<p>Você enviou as suas fotos do <strong>Sistema de Geração Pronto</strong> e
<strong>todas as ${p.aprovadas} foram aprovadas</strong>. Mesmo assim o seu pedido
está parado no mesmo ponto há cerca de ${p.parado_d} dias — e a falha foi nossa,
não sua.</p>

<p>Naquela semana, a nossa tela tinha um defeito: quando ainda faltava alguma
coisa, o botão <em>Continuar</em> simplesmente ficava cinza <strong>sem dizer o
motivo</strong>. Não tinha como você adivinhar. Já corrigimos isso, e agora a
tela escreve na hora o que está faltando.</p>

<p><strong>No seu caso falta só uma coisa:</strong> marcar as 5 confirmações que
ficam logo abaixo das fotos. São estas:</p>

<ol style="padding-left:20px">
${itens}
</ol>

<p>Marcando as 5, o botão <em>Continuar</em> libera na hora e você segue para a
etapa do áudio. Suas fotos continuam lá, não precisa enviar de novo.</p>

<p style="background:#fff8e1;border-left:3px solid #f0b429;padding:10px 14px">
<strong>Um detalhe importante para não perder tempo:</strong> volte usando o
<strong>mesmo celular ou computador, no mesmo navegador</strong> que você usou
para enviar as fotos. É assim que o site reconhece o seu envio.<br>
Link: <a href="https://fastcloner.com/sgp">fastcloner.com/sgp</a></p>

<p>Se você abrir e a tela pedir tudo do zero de novo, <strong>não refaça
nada</strong> — é só responder este e-mail que eu localizo o seu envio aqui do
nosso lado e resolvo para você.</p>

<p>Desculpa a demora. Você estava a um passo do fim, e o seu pedido ficou parado
por um aviso que a nossa tela não deu.</p>

<p>Um abraço,<br>
Equipe FastCloner<br>
<a href="mailto:suporte@lucasarrial.com">suporte@lucasarrial.com</a></p>
</div>`;
}

const modo = process.argv.includes("--enviar") ? "--enviar" : "--dry-run";
const ASSUNTO = "Suas fotos foram aprovadas — falta só marcar as 5 confirmações";

for (const p of PESSOAS) {
  const arq = path.join("/tmp", `carta_sgp_${p.email.replace(/[^a-z0-9]/gi, "_")}.html`);
  fs.writeFileSync(arq, corpo(p));
  const args = [ENVIAR, p.email, ASSUNTO, arq, "--chave", CHAVE, "--bcc", "suporte@lucasarrial.com"];
  if (modo === "--dry-run") args.push("--dry-run");
  console.log(`\n${"=".repeat(70)}\n>>> ${p.nome} <${p.email}> — ${p.aprovadas} fotos aprovadas\n${"=".repeat(70)}`);
  try {
    console.log(execFileSync("node", args, { encoding: "utf8" }));
  } catch (e) {
    console.log(`FALHOU (saida ${e.status}):\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
}
