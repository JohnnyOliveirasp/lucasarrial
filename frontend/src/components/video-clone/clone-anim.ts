/**
 * Animações do Vídeo Clone (mesma família do wizard/video-scene-grid):
 * shimmer diagonal + rolo de filme girando + reticências animadas.
 * Sem dependências — cada componente injeta via <style>.
 */
export const CLONE_ANIM_CSS = `
@keyframes vc-shimmer { 0% { transform: translateX(-120%) skewX(-12deg); } 100% { transform: translateX(220%) skewX(-12deg); } }
.vc-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent); animation: vc-shimmer 1.8s ease-in-out infinite; }
@keyframes vc-reel { to { transform: rotate(360deg); } }
.vc-reel svg { animation: vc-reel 3s linear infinite; }
@keyframes vc-dots { 0%,20%{content:'';} 40%{content:'.';} 60%{content:'..';} 80%,100%{content:'...';} }
.vc-dots::after { content:''; animation: vc-dots 1.6s steps(1) infinite; }
`;
