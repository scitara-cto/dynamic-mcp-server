# MCP OAuth 2.1 Implementation Plan (Keycloak, MCP Spec)

This plan describes the steps to implement a clean, spec-compliant OAuth 2.1 flow for the Dynamic MCP Server, using Keycloak as the authorization server, in accordance with the [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization).

---

## Steps

- [ ] **1. Clean Up Old OAuth Code**

  - Remove all legacy/janky OAuth endpoints, middleware, and helpers from the codebase.
  - Remove any custom `/authorize`, `/token`, `/register`, or `/callback` endpoints (unless proxying to Keycloak).

- [ ] **2. Decide on Proxy vs. Direct Keycloak Integration**

  - Decide whether to proxy OAuth endpoints through the MCP server or expose only the metadata and let clients talk to Keycloak directly.

- [ ] **3. Implement the Metadata Endpoint**

  - Implement `/.well-known/oauth-authorization-server` at the root of the server.
  - Return a JSON object per [RFC8414](https://datatracker.ietf.org/doc/html/rfc8414) with:
    - `issuer`
    - `authorization_endpoint`
    - `token_endpoint`
    - `registration_endpoint` (if supporting dynamic registration)
    - `scopes_supported`, `response_types_supported`, `grant_types_supported`, etc.
  - Populate these fields with the corresponding Keycloak URLs.

- [ ] **4. Configure Keycloak for MCP**

  - Create a realm for the MCP server.
  - Create a client in Keycloak for MCP clients:
    - Enable PKCE.
    - Set valid redirect URIs.
    - Enable dynamic client registration if desired (see [Keycloak Client Registration API](https://www.keycloak.org/docs/latest/server_admin/#_client_registration)).
  - Document the Keycloak endpoints for your server.

- [ ] **5. Update Server Auth Middleware**

  - Update authentication middleware to:
    - Validate JWT access tokens issued by Keycloak.
    - Reject requests without a valid `Authorization: Bearer <token>` header.
    - Extract user info (sub, email, roles, etc.) from the token.
  - Do not implement your own `/authorize`, `/token`, or `/register` endpoints—just validate tokens.

- [ ] **6. Test the OAuth Flow**

  - Test with a public OAuth client (e.g., mcp-remote, Postman, or a simple web app):
    1. Attempt to access `/sse` or another protected endpoint.
    2. Receive `401 Unauthorized`.
    3. Discover metadata at `/.well-known/oauth-authorization-server`.
    4. Register dynamically (if supported) or use a pre-registered client.
    5. Complete the OAuth Authorization Code flow (with PKCE).
    6. Exchange code for token at Keycloak's `/token` endpoint.
    7. Retry the protected endpoint with the access token.

- [ ] **7. Document Server OAuth Capabilities**

  - Update documentation to:
    - Describe the OAuth flow.
    - List the metadata endpoint and what it returns.
    - Explain how to register a client (dynamically or manually).
    - Provide example requests and responses.

- [ ] **8. (Optional) Proxy or Customize Endpoints**
  - If desired, proxy `/authorize`, `/token`, and `/register` to Keycloak for a seamless experience.
  - Otherwise, just point clients to the Keycloak endpoints in your metadata.

---

## References

- [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [OAuth 2.0 Authorization Server Metadata (RFC8414)](https://datatracker.ietf.org/doc/html/rfc8414)
- [OAuth 2.0 Dynamic Client Registration (RFC7591)](https://datatracker.ietf.org/doc/html/rfc7591)
- [Keycloak Client Registration API](https://www.keycloak.org/docs/latest/server_admin/#_client_registration)
