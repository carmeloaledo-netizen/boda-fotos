export const metadata = { title: "Política de privacidad" };

export default function Privacidad() {
  return (
    <>
      <h1 className="font-serif text-3xl text-ink mb-6">Política de privacidad</h1>
      <div className="space-y-4 text-ink-soft leading-relaxed">
        <p>
          Esta aplicación permite a los invitados de una boda compartir las
          fotografías que han realizado durante el evento. A continuación se
          explica qué datos se tratan y con qué finalidad.
        </p>
        <p>
          <strong>Responsable del tratamiento:</strong> el fotógrafo o estudio
          que gestiona el evento. Los datos de contacto concretos se facilitan
          en el aviso legal o directamente por el fotógrafo.
        </p>
        <p>
          <strong>Datos que se tratan:</strong> las imágenes que decides subir,
          un nombre opcional que introduzcas, la fecha y hora de la subida y un
          identificador técnico derivado de tu dirección IP de forma anonimizada
          (nunca se almacena tu IP completa). No se utilizan cookies
          publicitarias ni herramientas de seguimiento.
        </p>
        <p>
          <strong>Finalidad:</strong> recopilar y organizar las fotografías del
          evento para los novios y el fotógrafo. Las imágenes se almacenan en el
          espacio de Google Drive del fotógrafo y no se hacen públicas.
        </p>
        <p>
          <strong>Base legal:</strong> tu consentimiento, que otorgas al marcar
          la casilla de autorización antes de subir las fotografías.
        </p>
        <p>
          <strong>Conservación:</strong> los registros se conservan durante el
          periodo configurado por el fotógrafo (ver la página de conservación).
          Puedes solicitar la eliminación de tus fotografías contactando con el
          fotógrafo.
        </p>
        <p>
          <strong>Tus derechos:</strong> puedes ejercer los derechos de acceso,
          rectificación, supresión, oposición y limitación del tratamiento
          dirigiéndote al responsable indicado en el aviso legal.
        </p>
      </div>
    </>
  );
}
