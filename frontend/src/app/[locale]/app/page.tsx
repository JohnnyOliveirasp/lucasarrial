import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/**
 * `/app` → `/app/dashboard`.
 *
 * 🔴 Bug da aluna Claudia (14/08): esta rota NÃO EXISTIA. Quem não estava
 * logado nunca via o problema — o middleware desviava pro /login antes de
 * chegar aqui (307). Mas quem fazia login era devolvido pra `/app` e batia
 * num 404 seco, do lado de dentro. Nos logs o padrão era inconfundível:
 * `GET /app 404` com referer `.../login?redirectTo=%2Fapp`.
 *
 * Pior: `fastcloner.com/app` é o endereço que a Fast passa no suporte e o
 * que qualquer pessoa digita. Ou seja, o caminho mais óbvio da plataforma
 * levava a lugar nenhum depois do login.
 */
export const dynamic = "force-dynamic";

export default async function AppIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: "/app/dashboard", locale });
}
