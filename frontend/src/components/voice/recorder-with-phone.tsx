"use client";

/**
 * Cola o gravador do navegador com a seção do celular: os takes do celular
 * SOMAM na barra de fala acumulada (tudo alimenta o mesmo treino).
 */
import { useState } from "react";
import { VoiceRecorder } from "@/components/voice/voice-recorder";
import { PhoneRecorderSection } from "@/components/voice/phone-recorder-section";

export function RecorderWithPhone() {
  const [phoneSeconds, setPhoneSeconds] = useState(0);
  return (
    <>
      <VoiceRecorder extraSeconds={phoneSeconds} />
      <PhoneRecorderSection onSeconds={setPhoneSeconds} />
    </>
  );
}
