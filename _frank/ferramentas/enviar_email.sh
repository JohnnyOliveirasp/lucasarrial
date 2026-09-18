#!/bin/bash
# ⛔ APOSENTADO EM 18/09 PELA RONDA DO #101 — NÃO USE ESTE SCRIPT.
#
# ORIGEM (18/08, mantida por valor histórico): enviava e-mail pelo SMTP do
# suporte@ porque **script que fala com aluno NÃO usa Resend** (regra do Johnny
# de 10/08 — pelo Resend a carta chega como "AI Clone Verse", domínio antigo, e
# queima a confiança na frente do cliente). Essa regra CONTINUA VALENDO; o que
# foi aposentado é este caminho de envio, não o motivo que o criou.
# Falava porta 587 + STARTTLS (a 465 é bloqueada no Hetzner).
#
# Ele manda por `curl` SMTP direto e NÃO faz nenhuma das três escriturações
# que a casa passou a exigir: não carimba Message-ID, não grava cópia na
# pasta Enviados e não escreve linha em `emails_enviados`. Carta que sai por
# aqui é INVISÍVEL nos três livros — e, pior, é invisível também para o
# `2026-09-18_reconciliar_envios_da_pasta.cjs`, que conserta o buraco lendo a
# pasta Enviados: sem cópia na pasta, não há o que reconciliar.
#
# O efeito prático é o defeito que o #101 descreve, na pior forma: a ficha de
# contato (`contato-tentativas.ts`) lê "0 tentativas" para quem JÁ recebeu
# carta, e esse zero cego é, pelo cabeçalho do próprio módulo, o pior desfecho
# dele — existe pra MATAR a ordem de reenvio e acaba assinando embaixo dela.
# Foi assim que a Valdeni levou QUATRO ordens de reenvio.
#
# Medido em 18/09: ZERO chamadores no repositório. Não estava em uso — está
# aposentado ANTES de virar furo de verdade, não depois.
#
# USE NO LUGAR (assinatura real, conferida no próprio enviar_email.cjs):
#   node _frank/ferramentas/enviar_email.cjs <destino> "<assunto>" <corpo.html> \
#        [--bcc <email>] [--chave <slug>] [--janela <horas>] [--forcar] [--dry-run]
#
# O `--dry-run` do `.cjs` é o mesmo ENSAIO que existia aqui, e melhor: além de
# imprimir destinatário/remetente/assunto/bcc e o corpo inteiro sem enviar
# nada, mostra o VEREDITO da trava anti-duplicata ("esse aluno já recebeu este
# aviso?"). Ninguém perde o ensaio ao migrar pro `.cjs`.
#
# Recusa em vez de `rm` de propósito: apagar deixaria um "command not found"
# misterioso pra quem esbarrasse nele, e o corpo abaixo fica legível como
# referência do SMTP (porta 587 + STARTTLS, 465 bloqueada no Hetzner).
#
# A recusa é a PRIMEIRA instrução executável do arquivo: não há caminho de
# execução — nem com `--dry-run` — que chegue ao SMTP.
echo "⛔ enviar_email.sh está APOSENTADO (ronda do #101, 18/09)." >&2
echo "   Ele envia sem Message-ID, sem cópia em Enviados e sem linha em" >&2
echo "   emails_enviados — a carta fica invisível nos três livros e o" >&2
echo "   reconciliador não a alcança." >&2
echo "" >&2
echo "   Use:  node _frank/ferramentas/enviar_email.cjs <destino> \"<assunto>\" <corpo.html>" >&2
echo "         flags: [--bcc <email>] [--chave <slug>] [--janela <horas>] [--forcar] [--dry-run]" >&2
echo "         (--dry-run = ensaio: não envia e ainda mostra a trava anti-duplicata)" >&2
exit 1

# --- HISTÓRICO: implementação antiga, desativada em 18/09/2026 pela ronda do
# --- #101, mantida só como referência (inalcançável — o `exit 1` acima corta
# --- qualquer execução). Não reative sem resolver Message-ID + cópia em
# --- Enviados + linha em emails_enviados.
set -euo pipefail

# Separa a flag dos posicionais pra --dry-run funcionar em qualquer posição.
DRY_RUN=0
POS=()
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then DRY_RUN=1; else POS+=("$arg"); fi
done
if [ "${#POS[@]}" -lt 3 ]; then
  echo "uso: bash enviar_email.sh <destino> <assunto> <arquivo-corpo-html> [--dry-run]" >&2
  exit 1
fi
DEST="${POS[0]}"
ASSUNTO="${POS[1]}"
CORPO_FILE="${POS[2]}"

cd /mnt/volume/aiverse/frontend
# Mesmos defaults do lib/agent/mail-smtp.ts (só a senha vem do .env.local).
# ⚠️ `|| true`: com set -e, grep sem match (USER/HOST não estão no .env)
# matava o script antes dos defaults.
SENHA=$(grep -m1 '^SUPPORT_MAIL_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"'"'"'\r' || true)
USUARIO=$(grep -m1 '^SUPPORT_MAIL_USER=' .env.local | cut -d= -f2- | tr -d '"'"'"'\r' || true)
HOST=$(grep -m1 '^SUPPORT_MAIL_HOST=' .env.local | cut -d= -f2- | tr -d '"'"'"'\r' || true)
USUARIO=${USUARIO:-suporte@fastcloner.com}
HOST=${HOST:-mail.privateemail.com}

# BCC opcional (BCC_ADMIN=email). Em envio de LOTE fica vazio — senão o
# Johnny recebe uma cópia de cada aluno; o resumo vai num e-mail só.
BCC="${BCC_ADMIN:-}"

if [ "$DRY_RUN" = "1" ]; then
  # Ensaio: mostra exatamente o que sairia e para aqui. Nada toca o SMTP.
  echo "========== MODO SECO — NADA FOI ENVIADO =========="
  echo "Destinatário: $DEST"
  echo "Remetente:    Fast - FastCloner <$USUARIO>"
  echo "Assunto:      $ASSUNTO"
  [ -n "$BCC" ] && echo "Bcc:          $BCC"
  echo "--- CORPO INTEIRO ---"
  cat "$CORPO_FILE"
  echo "--- FIM DO CORPO ---"
  echo "========== MODO SECO — NADA FOI ENVIADO =========="
  exit 0
fi

EML=$(mktemp)
{
  printf 'From: Fast - FastCloner <%s>\r\n' "$USUARIO"
  printf 'To: %s\r\n' "$DEST"
  [ -n "$BCC" ] && printf 'Bcc: %s\r\n' "$BCC"
  printf 'Subject: %s\r\n' "$ASSUNTO"
  printf 'MIME-Version: 1.0\r\n'
  printf 'Content-Type: text/html; charset=UTF-8\r\n'
  printf '\r\n'
  cat "$CORPO_FILE"
} > "$EML"

RCPT_BCC=()
[ -n "$BCC" ] && RCPT_BCC=(--mail-rcpt "$BCC")

curl -sS --url "smtp://${HOST}:587" --ssl-reqd \
  --user "${USUARIO}:${SENHA}" \
  --mail-from "${USUARIO}" \
  --mail-rcpt "${DEST}" \
  "${RCPT_BCC[@]}" \
  --upload-file "$EML"

rm -f "$EML"
echo "ENVIADO para $DEST"
