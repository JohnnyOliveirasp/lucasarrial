# A tela calcula a mensagem de erro certa e joga fora

**Caso que abriu o assunto:** Valtermir (VP), `valterpjunior@gmail.com`,
19/08 08:25 BRT, assunto "Erros recorrentes". Ele diz que o erro é **ao subir
foto**; o print que ele anexou mostra erro **ao gerar imagem**. Os dois estão
certos, e é isso que explica tudo.

---

## O defeito, em uma linha

`image-studio.tsx` tem **14 chamadas de `setError(...)`** com mensagens
específicas — e uma única linha que renderiza esse estado:

```tsx
// linha 777
{error && <SupportError action={t("supportAction")} />}
```

O `SupportError` recebe **só o `action`**. A string do erro nunca é passada,
nunca é lida, nunca aparece na tela. Confirmado: `{error}` não existe em
nenhum outro ponto do arquivo.

Então **qualquer** falha daquela tela — upload que não subiu, formato
recusado, foto demais, geração que quebrou de verdade — vira sempre a mesma
frase:

> *"Não foi possível gerar a imagem. O erro foi registrado do nosso lado —
> tente de novo em alguns minutos."*

## Por que isso é grave, e não cosmético

**Mente sobre o que aconteceu.** O VP teve erro de UPLOAD e leu que a
GERAÇÃO falhou. Ele tentou de novo, do mesmo jeito, e falhou de novo — porque
a tela nunca disse qual era o problema real.

**Mente sobre o registro.** "O erro foi registrado do nosso lado" é falso no
caminho de upload: a foto vai do navegador **direto pro R2** por URL assinada,
sem passar pelo nosso servidor. Não há log, não há linha no banco, não há
incidente. Prova: o VP tem **3 gerações, todas `ready`, e ZERO linhas
`failed`** — as falhas dele não existem em lugar nenhum.

**Faz o aluno esperar por alguém que não vem.** Ele lê "já registramos",
entende que a equipe foi avisada, e aguarda. É o mesmo mecanismo da escalação
silenciosa, só que na interface.

**Cega o suporte.** Sem a mensagem real, nem a Fast nem eu conseguimos dizer
o que houve. O aluno vira "erro genérico".

## Onde mais acontece

| arquivo | mostra a mensagem real? |
|---|---|
| `components/image/image-studio.tsx:777` | **não** |
| `components/voice/voice-generator.tsx:268` | **não** |
| `components/video-clone/clone-studio.tsx:433` | sim (`{error}`) |
| `components/app/buy-credits.tsx:88` | sim |
| `components/app/api-keys-manager.tsx:172` | sim |
| `components/app/delete-account.tsx:174` | sim |

O resto do app faz certo. São essas duas telas que engolem — e são justamente
as duas que gastam crédito.

## Uma hipótese minha que MORREU no caminho

Eu tinha apostado em HEIC de iPhone, porque `image-stage.tsx:258` usa
`accept="image/*"` enquanto o servidor só aceita JPG/PNG/WEBP. **Errado para
esta tela:** já existe `lib/images/heic.ts` com `ensureUploadableImage`, que
converte HEIC→JPEG no navegador (pedido do Johnny em 01/08).

Mas o comentário dele deixa um fio solto que vale puxar:

```ts
/** Falhou a conversão? Devolve o original — a validação normal do fluxo
 *  dá a mensagem de erro de sempre (não pior que hoje). */
```

A premissa está errada. "A mensagem de erro de sempre" é exatamente o banner
genérico que mente. Então conversão que falha em silêncio + mensagem que não
aparece = aluno sem nenhuma pista. Se a causa do VP for essa, ele não tinha
como descobrir sozinho.

## O que corrigir

1. **Mostrar a mensagem real.** `SupportError` passa a receber e exibir o
   texto do erro, mantendo o "fale com o suporte" embaixo. O erro técnico
   cru continua fora — mas "essa foto não subiu" não é erro técnico, é a
   informação que o aluno precisa.
2. **Parar de afirmar "o erro foi registrado do nosso lado"** onde não é
   verdade. Falha no navegador não é registrada em lugar nenhum. Ou registra
   de verdade (mandar o erro de upload pro `/api/v1/react` que já existe pra
   erro de cliente), ou tira a frase.
3. **Mesma correção no `voice-generator.tsx`.**
4. **Alinhar o `accept`** do `image-stage.tsx` com o que o servidor aceita.

## O que ainda NÃO sei

Qual foi, exatamente, o erro do VP. Sei o mecanismo que o escondeu, não a
causa dele. Com a correção 1 no ar, ele mesmo vai ler o motivo na tela — a
correção é também o diagnóstico. Enquanto isso, vale perguntar a ele de que
aparelho e formato são as fotos.
