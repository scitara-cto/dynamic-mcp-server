import { Request, Response } from "express";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

/**
 * Handler for the OAuth Protected Resource Metadata endpoint
 * This endpoint provides information about the MCP Resource Server
 */
export function handleProtectedResourceMetadata(
  req: Request,
  res: Response,
): void {
  logger.debug("Protected Resource Metadata requested");

  // Construct the authorization server metadata URL
  const authServerMetadataUrl = `${config.auth.authServerUrl}/realms/${config.auth.realm}/.well-known/openid-configuration`;

  // Return the protected resource metadata
  res.json({
    issuer: config.server.name,
    authorization_servers: [authServerMetadataUrl],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
    ],
    token_endpoint_auth_signing_alg_values_supported: ["RS256"],
    service_documentation: "https://example.com/docs",
    version: config.server.version,
  });
}

/**
 * Handler for the OAuth Authorization Server Metadata endpoint
 * This endpoint provides information about the MCP Authorization Server
 */
export function handleAuthorizationServerMetadata(
  req: Request,
  res: Response,
): void {
  logger.debug("Authorization Server Metadata requested");

  // Return the authorization server metadata
  res.json({
    issuer: `${config.auth.authServerUrl}/realms/${config.auth.realm}`,
    authorization_endpoint: config.auth.authorizationUrl,
    token_endpoint: config.auth.tokenUrl,
    userinfo_endpoint: `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/userinfo`,
    jwks_uri: `${config.auth.authServerUrl}/realms/${config.auth.realm}/protocol/openid-connect/certs`,
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
  });
}
