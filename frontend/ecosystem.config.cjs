/**
 * PM2 — AI-Verse em produção no Hetzner: frontend (Next.js) + worker de render.
 *
 * `aiverse` roda `next start` na porta 3002 (3000/3001 já são ResumePro/Zayit).
 * O `next start` carrega o .env.local do cwd automaticamente, então os
 * secrets de runtime ficam em /mnt/volume/aiverse/frontend/.env.local
 * (não versionado). 1 instância em fork — a máquina é compartilhada com
 * outros projetos; subir pra cluster depois se o tráfego justificar.
 *
 * `aiverse-render` consome a fila `render_jobs` (montagem do vídeo final via
 * ffmpeg + legendas). O worker carrega o .env.local sozinho (funciona no
 * Node 18 do servidor) e usa o ffmpeg/ffprobe do sistema.
 */
module.exports = {
  apps: [
    {
      name: "aiverse",
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
      },
      error_file: "/mnt/volume/aiverse/logs/pm2-error.log",
      out_file: "/mnt/volume/aiverse/logs/pm2-out.log",
      time: true,
    },
    {
      name: "aiverse-render",
      cwd: __dirname,
      script: "./render/worker.mjs",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/mnt/volume/aiverse/logs/render-error.log",
      out_file: "/mnt/volume/aiverse/logs/render-out.log",
      time: true,
    },
  ],
};
