# ORDEM — Conta de teste e o `--dry-run` do e-mail

Duas coisas e a prova fecha.

---

## 1. A conta de teste é a `suporte@fastcloner.com`

Ordem do Johnny: **use o `suporte@fastcloner.com`** como sua conta de aluno.
Não crie conta nova.

Você já tem a senha do e-mail (`SUPPORT_MAIL_PASSWORD`), então consegue
receber a confirmação do cadastro. Se ela já tiver conta no app, melhor —
é só entrar.

⚠️ **Não leia a caixa pra isso.** A Fast pega os não-lidos e marca como lidos.
Se precisar do e-mail de confirmação, leia **só aquela mensagem** e não mexa
no resto. Se atrapalhar a Fast, pare e me diga.

**O que provar com ela:** entre no app e confirme que **Roteiro, Edição e
Settings abrem por crédito**. Se ela não tiver crédito, dê `admin_grant`
marcado como interno. É o último item da prova.

## 2. `--dry-run` no `enviar_email.cjs` — o seu achado, e ele é bom

Você viu certo: as três ferramentas destrutivas de dados exigem `--confirmar`,
mas o e-mail — **a única cujo erro chega direto na cara do aluno** — não tem
ensaio nenhum. Endereço trocado não tem desfazer.

Faça: `--dry-run` que imprime **destinatário, assunto e o corpo** e **não
envia**. Mesmo padrão do `--confirmar` das outras, invertido: o e-mail é
perigoso o suficiente pra merecer ensaio, não confirmação.

Vale pro `enviar_email.sh` também.

## 3. Teste de e-mail: mande pro Johnny

Quando for testar envio de verdade, o destino é **johnny.oliveirasp@gmail.com**
— ordem dele. Assunto com `[TESTE]` na frente.

## 4. Duas medições erradas que você refez — está certo

`$?` depois de um pipe devolve o status do `tail`, não do `tsc`. E o `pgrep`
casando com o próprio comando. Você pegou as duas antes de reportar.

É a mesma família da armadilha do vazio, e agora com nome próprio: **a medição
contaminando o resultado.** Junte isso ao playbook M — é a terceira forma da
mesma coisa, e a mais difícil de ver, porque o número aparece e parece certo.

---

Depois destes dois: playbooks, e o número da FastCloner separado do curso do
Lucas. Aí acabou.
