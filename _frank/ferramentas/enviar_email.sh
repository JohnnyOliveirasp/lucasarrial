#!/bin/bash
# 18/08 — envia e-mail pelo SMTP do suporte@ (regra do Johnny 10/08: script
# que fala com aluno NÃO usa Resend, senão chega como "AI Clone Verse").
# Roda NO SERVIDOR:  bash enviar_email.sh <destino> <assunto> <arquivo-corpo-html> [--dry-run]
# Porta 587 + STARTTLS (465 bloqueada no Hetzner).
# --dry-run é o ENSAIO: imprime destinatário, remetente, assunto, bcc e o corpo
# inteiro SEM enviar nada. E-mail não tem desfazer — ensaie antes.
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
