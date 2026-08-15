export const metadata = { title: "Conservación y eliminación" };

export default function Conservacion() {
  return (
    <>
      <h1 className="font-serif text-3xl text-ink mb-6">
        Conservación y eliminación de archivos
      </h1>
      <div className="space-y-4 text-ink-soft leading-relaxed">
        <p>
          Las fotografías subidas se almacenan en el espacio de Google Drive del
          fotógrafo responsable del evento. La aplicación guarda únicamente
          metadatos técnicos (nombre del archivo, tamaño, fecha, identificador de
          Drive y datos anonimizados), nunca copias de las imágenes en su propia
          base de datos.
        </p>
        <p>
          <strong>Periodo de conservación:</strong> los registros de metadatos se
          conservan durante el periodo configurado por el fotógrafo (por defecto,
          365 días). Las fotografías en Google Drive se conservan según el
          criterio del fotógrafo.
        </p>
        <p>
          <strong>Eliminación:</strong> puedes solicitar la eliminación de tus
          fotografías dirigiéndote al fotógrafo del evento. La eliminación del
          registro en la aplicación no borra automáticamente el archivo de Google
          Drive; esa acción la realiza el fotógrafo de forma deliberada.
        </p>
      </div>
    </>
  );
}
