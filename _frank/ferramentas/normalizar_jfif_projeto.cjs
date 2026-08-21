#!/usr/bin/env node
/**
 * normalizar_jfif_projeto.cjs — troca .jfif/.jfi/.jif/.jpe por .jpg nas chaves
 * de imagem de um Vídeo História, COPIANDO o objeto no R2 antes de reescrever
 * o caminho no banco.
 *
 * POR QUE EXISTE (incidente edc50dc6, 21/08): o Kie recusa o arquivo pela
 * EXTENSÃO, não pelo conteúdo. O `.jfif` é o que o Windows e o WhatsApp Web
 * salvam sozinhos — o aluno nunca escolhe esse formato. O conteúdo já é JPEG
 * (magic FFD8FF), então só o nome precisa mudar. O commit 32d12fd curou os
 * uploads NOVOS (`buildInputImageKey`); este script cura os projetos que já
 * estão com a chave velha gravada.
 *
 * ⚠️ REGRA DE OURO DESTE SCRIPT: NUNCA DERRUBAR UMA FOTO DA LISTA.
 * O primeiro reparo deste incidente converteu só as fotos que conseguiu e
 * **removeu as outras do array** — a lista de referência da aluna caiu de 6
 * para 2 e a `input_FOTO_PERFIL` sumiu de dois projetos. Se qualquer entrada
 * não puder ser convertida, este script ABORTA o projeto inteiro e não grava
 * nada. Lista encolhida é perda de dado do aluno, não conserto.
 *
 * Uso:
 *   node normalizar_jfif_projeto.cjs --projeto <uuid> [--projeto <uuid> ...]
 *   node normalizar_jfif_projeto.cjs --restaurar-de <snapshot.json>
 *   ... acrescente --confirmar para gravar (sem a flag, ENSAIA)
 *
 * O `--restaurar-de` recebe um JSON no formato
 *   { "projetos": { "<uuid>": { "product_image_paths": [...],
 *                               "reference_image_paths": [...] } } }
 * e usa ESSAS listas como verdade (serve pra desfazer um reparo que encolheu
 * o array). Sem ele, a verdade é o que está no banco agora.
 */
const path = require("node:path");
const { supa, r2, s3 } = require(path.join(__dirname, "_comum.cjs"));

const BUCKET = "voices-clone-ai-verse"; // imagesBucket()
const EXT_RUIM = /\.(jfif|jfi|jif|jpe)$/i;
const CAMPOS = ["product_image_paths", "reference_image_paths"];

const argv = process.argv.slice(2);
const CONFIRMAR = argv.includes("--confirmar");
const projetos = argv.reduce((acc, a, i) => (a === "--projeto" ? [...acc, argv[i + 1]] : acc), []);
const restaurarDe = argv[argv.indexOf("--restaurar-de") + 1];

const alvo = (k) => k.replace(EXT_RUIM, ".jpg");

async function head(Key) {
  try {
    return await r2().send(new s3.HeadObjectCommand({ Bucket: BUCKET, Key }));
  } catch {
    return null;
  }
}

/** Lê os primeiros bytes: só copiamos o que é JPEG DE VERDADE. */
async function ehJpeg(Key) {
  try {
    const o = await r2().send(
      new s3.GetObjectCommand({ Bucket: BUCKET, Key, Range: "bytes=0-3" }),
    );
    const buf = Buffer.concat(await o.Body.toArray());
    return buf.toString("hex").toUpperCase().startsWith("FFD8FF");
  } catch {
    return false;
  }
}

/**
 * Garante que existe o gêmeo .jpg da chave. Devolve {ok, chave, acao, motivo}.
 * NUNCA devolve ok:true sem o objeto existir de fato no destino.
 */
async function garantirJpg(k) {
  if (!EXT_RUIM.test(k)) {
    const h = await head(k);
    return h
      ? { ok: true, chave: k, acao: "nada (já é extensão boa)" }
      : { ok: false, chave: k, motivo: "objeto AUSENTE no R2" };
  }
  const destino = alvo(k);
  if (await head(destino)) return { ok: true, chave: destino, acao: "gêmeo .jpg já existia" };

  const origem = await head(k);
  if (!origem) return { ok: false, chave: k, motivo: "origem .jfif AUSENTE no R2" };
  if (!(await ehJpeg(k))) return { ok: false, chave: k, motivo: "conteúdo NÃO é JPEG (magic != FFD8FF)" };

  if (!CONFIRMAR) return { ok: true, chave: destino, acao: "COPIARIA .jfif -> .jpg" };

  await r2().send(
    new s3.CopyObjectCommand({
      Bucket: BUCKET,
      Key: destino,
      CopySource: `/${BUCKET}/${encodeURIComponent(k).replace(/%2F/g, "/")}`,
      ContentType: "image/jpeg",
      MetadataDirective: "REPLACE",
    }),
  );
  const conferido = await head(destino);
  if (!conferido) return { ok: false, chave: k, motivo: "copiei mas o HEAD do destino não achou" };
  return { ok: true, chave: destino, acao: `copiado (${conferido.ContentLength}B)` };
}

(async () => {
  const db = supa();

  let verdade = null;
  if (restaurarDe) {
    verdade = JSON.parse(require("node:fs").readFileSync(restaurarDe, "utf8")).projetos;
    console.log(`Verdade das listas: ${restaurarDe} (${Object.keys(verdade).length} projeto(s))\n`);
  }

  const ids = projetos.length ? projetos : Object.keys(verdade ?? {});
  if (!ids.length) {
    console.error("Passe --projeto <uuid> ou --restaurar-de <snapshot.json>.");
    process.exit(1);
  }

  console.log(CONFIRMAR ? "MODO: GRAVANDO\n" : "MODO: ENSAIO (sem --confirmar nada é gravado)\n");

  for (const id of ids) {
    const { data: proj, error } = await db
      .from("video_projects")
      .select("id, user_id, status, product_image_paths, reference_image_paths")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.log(`${id}  ERRO CRU: ${JSON.stringify(error)}`);
      continue;
    }
    if (!proj) {
      console.log(`${id}  NÃO EXISTE — pulando (update por id inexistente afeta 0 linhas em silêncio)`);
      continue;
    }

    console.log(`== ${id}  status=${proj.status}`);
    const patch = {};
    let abortar = null;

    for (const campo of CAMPOS) {
      const origem = verdade?.[id]?.[campo] ?? proj[campo] ?? [];
      const atual = proj[campo] ?? [];
      const saida = [];

      for (const k of origem) {
        const r = await garantirJpg(k);
        const nome = k.split("/").pop();
        if (!r.ok) {
          abortar = `${campo}: ${nome} — ${r.motivo}`;
          console.log(`   ✗ ${nome}  ${r.motivo}`);
          break;
        }
        console.log(`   · ${nome.padEnd(30)} ${r.acao}`);
        saida.push(r.chave);
      }
      if (abortar) break;

      if (saida.length !== origem.length) {
        abortar = `${campo}: entrei com ${origem.length} e sairia com ${saida.length}`;
        break;
      }
      const mudou = saida.length !== atual.length || saida.some((k, i) => k !== atual[i]);
      if (mudou) {
        patch[campo] = saida;
        console.log(
          `   → ${campo}: ${atual.length} no banco → ${saida.length} depois do conserto` +
            (saida.length > atual.length ? `  (RESTAURA ${saida.length - atual.length} foto(s))` : ""),
        );
      }
    }

    if (abortar) {
      console.log(`   ABORTADO, nada gravado neste projeto: ${abortar}\n`);
      continue;
    }
    if (!Object.keys(patch).length) {
      console.log(`   nada a fazer (já normalizado)\n`);
      continue;
    }
    if (!CONFIRMAR) {
      console.log(`   [ensaio] gravaria ${Object.keys(patch).join(", ")}\n`);
      continue;
    }

    const { data: upd, error: e2 } = await db
      .from("video_projects")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (e2) {
      console.log(`   ERRO CRU no update: ${JSON.stringify(e2)}\n`);
      continue;
    }
    console.log(`   GRAVADO — ${(upd ?? []).length} linha(s) afetada(s)${(upd ?? []).length !== 1 ? "  ⚠️ ESPERAVA 1" : ""}\n`);
  }
})();
