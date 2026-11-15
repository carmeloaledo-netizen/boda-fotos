import { Uploader } from "./Uploader";
import { Guestbook } from "./Guestbook";

export const dynamic = "force-dynamic";

/**
 * Página pública del invitado. El token viaja en ?t=. El componente
 * cliente valida el evento contra el servidor y renderiza el formulario
 * de subida; debajo, el libro de firmas para dejar un mensaje a los novios.
 */
export default function EventPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { t?: string };
}) {
  const token = searchParams.t ?? "";
  return (
    <>
      <Uploader slug={params.slug} token={token} />
      <Guestbook slug={params.slug} token={token} />
    </>
  );
}
