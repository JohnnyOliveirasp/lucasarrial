"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CloneStudio } from "./clone-studio";
import { CloneHistory } from "./clone-history";

/** Compõe o estúdio + histórico; geração concluída → histórico recarrega. */
export function CloneWorkspace({
  creditsTotal,
  unlimited,
}: {
  creditsTotal: number;
  unlimited: boolean;
}) {
  const t = useTranslations("videoClone");
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
        <CloneStudio
          creditsTotal={creditsTotal}
          unlimited={unlimited}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {t("yourVideos")}
        </h2>
        <CloneHistory reloadKey={reloadKey} />
      </section>
    </div>
  );
}
