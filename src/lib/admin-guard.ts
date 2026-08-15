import { isAuthenticated, verifyCsrf } from "./auth";
import { jsonError } from "./security";

/** Guard para lecturas del panel: exige sesión válida. */
export async function guardRead(): Promise<Response | null> {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);
  return null;
}

/** Guard para mutaciones: sesión válida + token CSRF. */
export async function guardMutation(headers: Headers): Promise<Response | null> {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);
  if (!verifyCsrf(headers)) return jsonError("Token CSRF inválido", 403);
  return null;
}
