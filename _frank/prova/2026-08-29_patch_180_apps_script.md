# PATCH #180 — pasta com subpastas lida como "pasta vazia"

**Status:** NÃO aplicado. Precisa de mão humana no editor do Google Apps Script.
**Por quê:** o `_Code_final.gs` roda no Google, não está no caminho do deploy.
`git push` na `main` não alcança ele. Escalado em vez de fingir entrega.

## O que quebra

`coletarFileIds()` em `_Code_final.gs:397` usa `DriveApp.getFiles()`, que lista
**só os filhos diretos** da pasta. Não desce em subpasta.

Aluno manda uma pasta organizada (7 subpastas, zero arquivo solto na raiz) →
o loop não acha nada → `:403` lança `"pasta vazia"` → a mensagem manda o aluno
**abrir o compartilhamento**, que nunca foi o problema.

Loop sem saída com cara de culpa do aluno. Caso medido: Johnathan, 2 dias
parado, 0 vozes. Abri o link dele à mão: funciona, o compartilhamento estava
certo desde o começo.

## O conserto

Em `_Code_final.gs`, trocar o bloco `if (folderMatch) { ... }` (linhas ~396-404)
por este. O resto da função não muda.

```javascript
  if (folderMatch) {
    // #180 (29/08): getFiles() lista só filho direto. Aluno que organiza em
    // subpasta caía em "pasta vazia" e era mandado consertar compartilhamento
    // que já estava certo. Agora desce recursivo.
    coletarDaPasta(DriveApp.getFolderById(folderMatch[1]), ids, 0);
    if (ids.length === 0) throw new Error("pasta sem nenhum arquivo (conferi as subpastas também)");
    return ids;
  }
```

E acrescentar esta função auxiliar no fim do arquivo:

```javascript
/**
 * Desce na pasta e nas subpastas juntando fileIds. #180.
 * PROFUNDIDADE_MAX evita laço infinito em atalho circular do Drive;
 * TETO evita estourar o tempo do Apps Script numa pasta gigante.
 */
function coletarDaPasta(pasta, ids, nivel) {
  var PROFUNDIDADE_MAX = 5;
  var TETO = 500;
  if (nivel > PROFUNDIDADE_MAX || ids.length >= TETO) return;

  var files = pasta.getFiles();
  while (files.hasNext() && ids.length < TETO) {
    var f = files.next();
    compartilhar(f);
    ids.push(f.getId());
  }

  var subs = pasta.getFolders();
  while (subs.hasNext() && ids.length < TETO) {
    coletarDaPasta(subs.next(), ids, nivel + 1);
  }
}
```

## Como conferir que funcionou

1. Criar pasta de teste com **zero arquivo na raiz** e um áudio dentro de uma
   subpasta.
2. Rodar a importação com o link dessa pasta.
3. Antes: `"pasta vazia"`. Depois: importa o áudio da subpasta.

## O que NÃO era o problema

- Compartilhamento do aluno (testado, funcionava).
- Importação de vídeo — hipótese derrubada lendo o PR #39: 163 vozes vieram de
  `.mp4`, 139 ficaram `ready` (5,5% de falha contra 5,8% do geral).
