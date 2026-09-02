# Prova de deploy: grep de identificador no `.next/server` é FALSO NEGATIVO

Medido na ronda noturna de 02/09/2026, 01hZ, conferindo se o fix do `#222`
(`ba6a235`) tinha realmente chegado em produção.

## O que eu fiz de errado

Procurei o nome da função nova no bundle do servidor:

```bash
ssh root@91.99.15.213 'cd /mnt/volume/aiverse/frontend && grep -rl "donoDoEntitlement" .next/server'
# -> VAZIO
```

Vazio. A leitura óbvia — e errada — seria "o deploy não subiu o fix".

## Por que a resposta é inválida

Rodei a mesma busca com uma agulha que existe no código há muito tempo:

```bash
grep -rl "grantAccess" .next/server
# -> VAZIO TAMBÉM
```

`grantAccess` está em produção há meses. Se o instrumento não acha o que
comprovadamente está lá, ele não pode ser usado pra concluir ausência: o
minificador do build **renomeia identificador de módulo**. Nome de função,
variável e import somem. Só sobrevive o que ele não pode reescrever — string
literal, chave de objeto exposta, nome de rota.

⚠️ Isto é irmão da armadilha de 01/09 12hZ ("grep acentuado em bundle
minificado dá falso negativo, use agulha ASCII"). Trocar o acento por ASCII
**não basta**: se a agulha for um identificador, ela é renomeada de qualquer
jeito. E `vinculo.ts` não tem nenhuma string literal, então não existe agulha
boa dentro do bundle pra este fix.

## O que prova de verdade

Três coisas que casam, nenhuma delas "Action verde":

1. **Hash do fonte no servidor == hash do commit.** O deploy copia `src/`:
   ```
   local    7f22fecd72dfcd3e80ac636b04f45058  frontend/src/lib/payments/vinculo.ts
   servidor 7f22fecd72dfcd3e80ac636b04f45058  src/lib/payments/vinculo.ts
   local    dc40b2fcdb386a9fc285e9dffd99c873  frontend/src/lib/payments/entitlements.ts
   servidor dc40b2fcdb386a9fc285e9dffd99c873  src/lib/payments/entitlements.ts
   ```
   Byte a byte igual. E `grep -c donoDoEntitlement src/lib/payments/entitlements.ts`
   no servidor = 2 (no fonte o nome não é minificado).
2. **`BUILD_ID` novo, com hora.** `BYyFQE1mL_6-eKUwcak7C`, mtime
   `2026-09-01 20:51:36Z` — ou seja, o build é posterior ao commit
   (`ba6a235`, 20:49Z... merge 20:52Z no Action).
3. **pm2 reiniciou na mesma janela.** `aiverse` e `aiverse-render` com uptime
   `2026-09-01T20:52:32Z`, batendo com o fim do Action (`20:52:35Z`). Build
   novo sem restart do pm2 é código no disco que ninguém está executando.

## A regra que fica

Pra afirmar "está no ar", use **hash do fonte no servidor + `BUILD_ID` +
uptime do pm2**. Nunca `grep` de identificador no `.next`. E quando uma busca
voltar vazia, **rode a mesma busca contra algo que você sabe que existe**
antes de acreditar no zero — é a mesma disciplina do §"Consulta que erra volta
VAZIA" do `03_ROTINA.md`, aplicada a `grep` em vez de SQL.
