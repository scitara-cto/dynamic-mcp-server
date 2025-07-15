# Transport Protocols

Dynamic MCP Server supports the modern MCP transport protocol for efficient client-server communication.

## Overview

The server implements a streamable HTTP transport architecture:
- **Streamable HTTP Transport** (Protocol 2025-03-26) - Modern, efficient

The transport provides comprehensive authentication, user management, tool execution, and session management systems.

## Streamable HTTP Transport

### Protocol Details
- **Version**: 2025-03-26
- **Endpoint**: `/mcp`
- **Authentication**: Query parameter `?apiKey=your-key` OR header `x-apikey: your-key`

### HTTP Methods
- **GET `/mcp`**: Retrieve server capabilities and initialize session
- **POST `/mcp`**: Send MCP requests (tools/list, tools/call, etc.)
- **DELETE `/mcp`**: Clean up session and resources

### Features
- Single endpoint design for simplicity
- Efficient request/response model
- Automatic session management
- Modern MCP standard compliance
- Better error handling and debugging

### Example Usage

**Using Query Parameter:**
```bash
# Initialize connection and get capabilities
curl "http://localhost:4001/mcp?apiKey=your-api-key"

# Execute a tool
curl -X POST "http://localhost:4001/mcp?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "weather", "arguments": {"location": "Boston"}}}'
```

**Using Header:**
```bash
# Initialize connection and get capabilities
curl "http://localhost:4001/mcp" \
  -H "x-apikey: your-api-key"

# Execute a tool
curl -X POST "http://localhost:4001/mcp" \
  -H "Content-Type: application/json" \
  -H "x-apikey: your-api-key" \
  -d '{"method": "tools/call", "params": {"name": "weather", "arguments": {"location": "Boston"}}}'
```


## Architecture

### Modular Design
The HTTP server has been refactored into a clean, modular architecture:

```
src/http/
├── http-server.ts          # Main server orchestration (116 lines)
├── types.ts               # Type definitions
├── services/
│   ├── auth.ts           # Authentication logic
│   └── session-manager.ts # Unified session management
└── routes/
    ├── health.ts         # Health check endpoints
    └── streamable-http.ts # Streamable HTTP routes
```

### Session Management
Both transports use a unified session management system:
- Sessions are created automatically on first request
- Each session tracks transport type and metadata
- Sessions are cleaned up automatically
- Backwards compatibility maintained through proxy patterns

### Authentication
Both transports use identical API key authentication with flexible options:

**Supported Methods:**
- **Query Parameter**: `?apiKey=your-key` or `?apikey=your-key` (case variations supported)
- **Header**: `x-apikey: your-key` or `apikey: your-key` (multiple header formats supported)

**Authentication Flow:**
1. API key provided via query parameter OR header
2. User lookup and validation in MongoDB
3. Session creation with user context
4. Role-based authorization for tool access

**Security Considerations:**
- Headers are generally more secure than query parameters (not logged in URLs)
- Query parameters are simpler for testing and debugging
- Both methods provide identical security when used over HTTPS

## Integration Guide

### For All Integrations
Use the **Streamable HTTP Transport** for all integrations:
- Efficient and modern protocol
- Excellent error handling
- Simple client implementation
- Future-proof design

### Client Libraries
The streamable HTTP transport works with standard MCP client libraries:
- Configure endpoint URL to use `/mcp`
- Standard authentication and tool calling patterns
- Transparent integration with application logic

## Performance Considerations

### Streamable HTTP
- Lower latency for request/response operations
- More efficient resource usage
- Better connection pooling support
- Simplified debugging and monitoring

- Real-time streaming capabilities
- More complex connection management
- Legacy client compatibility

## Debugging and Monitoring

### Health Endpoints
The transport supports comprehensive health monitoring:
- `GET /health` - Basic health check
- `GET /status` - Detailed status information

### Logging
Comprehensive logging for the transport:
- Connection establishment
- Authentication events
- Tool execution
- Error conditions
- Session lifecycle

## Best Practices

1. **Use Streamable HTTP** for all projects
2. **Monitor transport performance** for optimal operation
3. **Test thoroughly** during development and deployment
4. **Use health endpoints** for monitoring and debugging
5. **Implement proper error handling** in client applications

## Future Roadmap

- Streamable HTTP is the actively developed transport protocol
- Continued improvements to performance and reliability
- Enhanced debugging and monitoring capabilities
- Additional client library support and tooling