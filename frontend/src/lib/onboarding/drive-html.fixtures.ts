/**
 * Corpos HTML REAIS que o Drive devolve no lugar do arquivo. Ficam num módulo
 * só porque os dois arquivos de teste (drive-html.test.ts e drive.test.ts)
 * dependem dos MESMOS bytes medidos — duplicar convidaria os dois a divergirem
 * do que o Drive manda de verdade.
 */
// ── Corpos reais ──────────────────────────────────────────────────────────
// Medido em 29/08 na pasta do aluno: 2009 bytes, este é o miolo.
export const HTML_QUOTA = `<!DOCTYPE html><html><head><title>Google Drive - Quota exceeded</title></head>
<body><p>Sorry, you can't view or download this file at this time.</p>
<p>Too many users have viewed or downloaded this file recently. Please try
accessing the file again later.</p><a href="https://accounts.google.com/">Sign in</a></body></html>`;

export const HTML_LOGIN = `<!DOCTYPE html><html><head><title>Meet Google Drive</title></head>
<body><form action="https://accounts.google.com/ServiceLogin">Sign in to continue</form></body></html>`;

export const HTML_ESTRANHO = `<!DOCTYPE html><html><head><title>Error 500</title></head>
<body><h1>Something went wrong</h1></body></html>`;

export const ID = "1AbCdEfGhIjK";
