"use client";

import {
  Suspense,
  useRef,
  useState,
  useEffect,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTranslations } from "next-intl";
import { Group as ThreeGroup, MathUtils } from "three";

/** Detecta se o browser consegue criar um contexto WebGL (GPU desabilitada,
 *  drivers antigos, sandbox sem GPU → retorna false e caímos no fundo estático). */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** Rede de segurança: se o Canvas/three estourar em runtime (ex.: contexto
 *  perdido), captura e esconde o 3D em vez de derrubar a tela de login. */
class WebGLErrorBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function VoiceOrb() {
  const groupRef = useRef<ThreeGroup>(null);
  const innerRef = useRef<ThreeGroup>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.15;
      groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.4;
      innerRef.current.rotation.z = Math.cos(t * 0.3) * 0.2;
      const pulse = 1 + Math.sin(t * 1.5) * 0.04;
      innerRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer wireframe sphere — silver hairline */}
      <mesh>
        <icosahedronGeometry args={[2.2, 2]} />
        <meshBasicMaterial color="#c0c4c8" wireframe transparent opacity={0.32} />
      </mesh>

      {/* Inner pulsing solid sphere — focal accent, subtle violet */}
      <group ref={innerRef}>
        <mesh>
          <icosahedronGeometry args={[1.4, 1]} />
          <meshBasicMaterial color="#a78bfa" wireframe transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Orbiting rings */}
      <OrbitRing radius={3.0} tilt={0.6} speed={0.5} />
      <OrbitRing radius={3.4} tilt={-0.9} speed={-0.3} />
      <OrbitRing radius={3.8} tilt={1.2} speed={0.2} />
    </group>
  );
}

function OrbitRing({ radius, tilt, speed }: { radius: number; tilt: number; speed: number }) {
  const ringRef = useRef<ThreeGroup>(null);
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.getElapsedTime() * speed;
    }
  });
  return (
    <group ref={ringRef} rotation={[tilt, 0, 0]}>
      <mesh>
        <torusGeometry args={[radius, 0.012, 16, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Particles({ count = 200 }: { count?: number }) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = MathUtils.randFloat(4, 7);
    const theta = MathUtils.randFloat(0, Math.PI * 2);
    const phi = MathUtils.randFloat(0, Math.PI);
    points[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    points[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    points[i * 3 + 2] = radius * Math.cos(phi);
  }
  const groupRef = useRef<ThreeGroup>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.04;
    }
  });
  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[points, 3]}
            count={count}
          />
        </bufferGeometry>
        <pointsMaterial color="#ffffff" size={0.025} sizeAttenuation transparent opacity={0.5} />
      </points>
    </group>
  );
}

export function AuthHero3D() {
  const t = useTranslations("auth");
  // null = ainda checando (SSR/primeiro paint); evita montar o Canvas no servidor.
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    setShow3D(hasWebGL());
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--canvas)]">
      {/* Fundo estático (fallback sem WebGL): glow violeta atmosférico */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(167,139,250,0.14), transparent 62%)",
        }}
      />

      {show3D && (
        <WebGLErrorBoundary onFail={() => setShow3D(false)}>
          <Canvas
            camera={{ position: [0, 0, 7], fov: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
          >
            <color attach="background" args={["#000000"]} />
            <Suspense fallback={null}>
              <VoiceOrb />
              <Particles />
            </Suspense>
          </Canvas>
        </WebGLErrorBoundary>
      )}

      {/* Editorial overlay: brand + tagline */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-[var(--radius-full)] bg-[var(--hue-violet)]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--silver)]">
            {t("brand")}
          </span>
        </div>

        <div className="flex max-w-md flex-col gap-4">
          <h2 className="font-sans text-5xl font-semibold leading-[1.02] tracking-[-0.03em] text-[var(--ink)] lg:text-6xl">
            {t("tagline")}
          </h2>
          <div className="flex items-center gap-2.5">
            <div className="h-px w-12 bg-[var(--hairline-strong)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ash)]">
              v0.1 · 2026
            </span>
          </div>
        </div>
      </div>

      {/* Vignette gradient pra dar profundidade */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--canvas)] via-transparent to-transparent" />
    </div>
  );
}
