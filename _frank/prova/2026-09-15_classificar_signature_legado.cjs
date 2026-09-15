// Aplica as MESMAS regexes de frontend/src/lib/agent/mail-incident.ts nos
// cartoes de formato LEGADO abertos, pra medir quantos racham no proximo e-mail.
const { execFileSync } = require("node:child_process");
function norm(s){return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");}
const CLASSES=[
 {classe:"pacing",re:/sem pontuacao|pontuacao|grudad|emendad|sem espaco|sem pausa|muito proxim|sem intervalo|colad[ao]s? (uma|na)|frases corrid/},
 {classe:"corte",re:/letras? solt|cortad|incomplet|faltando|pela metade|nao (sai|aparece|toca) (todo|inteiro)|comecando (em lugar|no meio)|comeca(ndo)? no meio|para no meio|termina (cedo|antes)|audio nao termina|silabas? sem sentido|comendo trecho|perdeu? o (comeco|final|fim)|sem o final/},
 {classe:"sem-audio",re:/audio (vazio|mudo)|sem som|nao (gera|gerou|saiu) (o )?audio|nao toca/},
 {classe:"semelhanca",re:/nao parec|diferente da minha voz|nao e (a )?minha voz|nao ficou parecid|voz de robo|parece (um )?robo|robotic|robotiz|voz estranha|nao soa como/},
 {classe:"credito",re:/credito/},
 {classe:"cobranca",re:/cobranc|cobrad[ao]|reembols|cancelament|cancelar|estorn|pagament|assinatura|mensalidade|fatura/},
 {classe:"acesso",re:/acesso|login|senha|nao consigo entrar|conta bloquead/},
 {classe:"treinamento",re:/trein|clonar|clonagem|criar (a |uma )?voz/},
 {classe:"video",re:/video/},
 {classe:"imagem",re:/imagem|foto/},
];
function classify(reason){const t=norm(reason);if(!t)return null;for(const{classe,re} of CLASSES){if(re.test(t))return classe;}return null;}
const sql="select numero, signature, description from incidents where status in ('open','investigating') and signature ~ '^fast-email:(tec|atend):[^:]+@' order by created_at";
const out=execFileSync("node",["_frank/ferramentas/sql.cjs",sql,"--completo"],{encoding:"utf8",maxBuffer:1e8});
const rows=JSON.parse(out.slice(out.indexOf("[")));
let racha=0,fica=0;
for(const r of rows){
  // o classificador le o RESUMO da Fast; na description ele vem apos "Resumo dela:"
  const m=/Resumo dela:\s*([\s\S]*?)(\n\n|$)/.exec(r.description||"");
  const reason=m?m[1]:"";
  const c=classify(reason);
  const canal=r.signature.split(":")[1];
  const email=r.signature.split(":").slice(2).join(":");
  const nova=c?`fast-email:${canal}:${c}:${email}`:r.signature;
  const quebra=nova!==r.signature;
  if(quebra)racha++;else fica++;
  console.log(`#${r.numero}\t${quebra?"RACHA":"ok   "}\t${c||"(sem classe)"}\t${reason.slice(0,70).replace(/\s+/g," ")}`);
}
console.log(`\nLEGADO ABERTO: ${rows.length} | RACHA no proximo e-mail: ${racha} | mantem dedupe: ${fica}`);
