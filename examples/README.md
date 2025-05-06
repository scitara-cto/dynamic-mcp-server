# Dynamic MCP Server Examples

This directory contains example implementations of the Dynamic MCP Server framework.

## Required Environment Variables

All examples require the following environment variables to be set:

```bash
# MCP Server Configuration
MCP_PORT=4001        # Port for the MCP server (default: 4001)
AUTH_PORT=4000       # Port for the authentication server (default: 4000)

# Authentication Configuration
KEYCLOAK_AUTH_SERVER_URL=your_auth_server_url
KEYCLOAK_REALM=your_realm
KEYCLOAK_CLIENT_ID=your_client_id
KEYCLOAK_CLIENT_SECRET=your_client_secret
KEYCLOAK_REDIRECT_URI=http://localhost:4000/callback

# Optional Configuration
LOG_LEVEL=info       # Logging level (default: info)
LOG_FILE_PATH=logs   # Log file path (default: logs)
```

## Base Server Example

The base server example (`base-server/`) demonstrates the core functionality of the Dynamic MCP Server framework:

- Basic server setup
- Tool management handler integration
- Core server configuration

To run:

```bash
node examples/base-server/index.js
```

## Echo Server Example

The echo server example (`echo-server/`) demonstrates how to create a custom handler and integrate it with the framework:

- Basic server setup
- Tool management handler integration
- Custom echo handler implementation
- Handler factory registration
- Tool registration

To run:

```bash
node examples/echo-server/index.js
```

## Weather Server Example

The weather server example (`weather-server/`) demonstrates how to create a web service handler and integrate it with an external API:

- Basic server setup
- Tool management handler integration
- Web service handler implementation
- External API integration (OpenWeatherMap)
- Dynamic tool configuration

To run:

```bash
# Additional required environment variable for the weather example
export OPENWEATHER_API_KEY=your_api_key_here
node examples/weather-server/index.js
```

All examples will start a server on `http://localhost:4001` by default, with authentication handled on `http://localhost:4000`.
