/**
 * Script interactivo para obtener un refresh token de Google OAuth 2.0
 * con la cuenta del fotógrafo.
 *
 * Uso:
 *   1. Rellena GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI
 *      en tu .env (el redirect por defecto es http://localhost:53682/oauth2callback).
 *   2. Ejecuta:  npm run get-refresh-token
 *   3. Abre la URL que se imprime, autoriza con la cuenta del fotógrafo.
 *   4. El script captura el código, lo intercambia y muestra el refresh token.
 *   5. Copia el refresh token a GOOGLE_REFRESH_TOKEN en tu .env.
 *
 * IMPORTANTE: para que el refresh token NO caduque a los 7 días, la pantalla
 * de consentimiento OAuth debe estar publicada ("In production"), no en "Testing".
 */
import "dotenv/config";
import { google } from "googleapis";
import http from "node:http";
import { URL } from "node:url";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:53682/oauth2callback";

  if (!clientId || !clientSecret) {
    console.error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en .env");
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // fuerza a que devuelva refresh_token
    scope: SCOPES,
  });

  const port = Number(new URL(redirectUri).port || 53682);

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url!, redirectUri);
        const c = url.searchParams.get("code");
        if (c) {
          res.end("Autorización recibida. Puedes cerrar esta pestaña.");
          server.close();
          resolve(c);
        } else {
          res.end("Esperando código de autorización...");
        }
      } catch (err) {
        reject(err);
      }
    });
    server.listen(port, () => {
      console.log("\n1) Abre esta URL en tu navegador y autoriza con la cuenta del fotógrafo:\n");
      console.log(authUrl + "\n");
      console.log(`2) Esperando la redirección en ${redirectUri} ...\n`);
    });
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    console.error(
      "No se recibió refresh_token. Revoca el acceso de la app en https://myaccount.google.com/permissions y vuelve a intentarlo con prompt=consent."
    );
    process.exit(1);
  }

  console.log("\n==============================================================");
  console.log("REFRESH TOKEN (cópialo a GOOGLE_REFRESH_TOKEN en tu .env):\n");
  console.log(tokens.refresh_token);
  console.log("==============================================================\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
