import { Uploader } from "./Uploader";

export const dynamic = "force-dynamic";

/**
 * Página pública del invitado. El token viaja en ?t=. El componente
 * cliente valida el evento contra el servidor y renderiza el formulario.
 */
export default function EventPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t ?? "";
  return <Uploader slug={params.slug} token={token} />;
}
