export const metadata = { title: "Aviso legal" };

export default function AvisoLegal() {
  return (
    <>
      <h1 className="font-serif text-3xl text-ink mb-6">Aviso legal</h1>
      <div className="space-y-4 text-ink-soft leading-relaxed">
        <p>
          Este servicio es operado por el fotógrafo o estudio responsable del
          evento. Complete aquí los datos identificativos exigidos por la
          normativa aplicable (nombre o razón social, NIF, domicilio y datos de
          contacto).
        </p>
        <p>
          El acceso a la página de subida está restringido a las personas que
          disponen del enlace privado facilitado por los organizadores del
          evento. El uso del servicio implica la aceptación de la política de
          privacidad.
        </p>
        <p>
          Queda prohibido subir contenidos que no sean fotografías del evento,
          que infrinjan derechos de terceros o que resulten ilícitos. El
          responsable podrá desactivar el enlace en cualquier momento.
        </p>
        <p className="text-sm text-ink-faint">
          Plantilla orientativa. Sustituya este texto por su aviso legal
          definitivo revisado por un profesional.
        </p>
      </div>
    </>
  );
}
