/**
 * PM2 — AI-Verse frontend (Next.js) em produção no Hetzner.
 *
 * Roda `next start` na porta 3002 (3000/3001 já são ResumePro/Zayit).
 * O `next start` carrega o .env.local do cwd automaticamente, então os
 * secrets de runtime ficam em /mnt/volume/aiverse/frontend/.env.local
 * (não versionado). 1 instância em fork — a máquina é compartilhada com
 * outros projetos; subir pra cluster depois se o tráfego justificar.
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
  ],
};
