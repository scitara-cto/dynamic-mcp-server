import { Request, Response } from "express";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Handler for the OAuth metadata endpoint
 * This endpoint provides information about the OAuth server, including the registration endpoint
 */
export function handleOAuthMetadata(req: Request, res: Response): void {
  logger.debug("OAuth metadata requested");

  // Get the base URL from the request
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  // Return the OAuth metadata
  res.json({
    issuer: config.server.name,
    authorization_endpoint: config.auth.authorizationUrl,
    token_endpoint: config.auth.tokenUrl,
    userinfo_endpoint: `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/userinfo`,
    jwks_uri: `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/certs`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: [
      "code",
      "token",
      "id_token",
      "code token",
      "code id_token",
      "token id_token",
      "code token id_token",
    ],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: config.auth.scopes,
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
    ],
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "exp",
      "iat",
      "name",
      "email",
      "preferred_username",
    ],
    code_challenge_methods_supported: ["S256"],
  });
}
