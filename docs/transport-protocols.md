# Transport Protocols

Dynamic MCP Server supports both modern and legacy MCP transport protocols, allowing for seamless migration and backwards compatibility.

## Overview

The server implements a dual-transport architecture that supports:
- **Streamable HTTP Transport** (Protocol 2025-03-26) - Modern, recommended
- **SSE Transport** (Protocol 2024-11-05) - Legacy, backwards compatible

Both transports share the same authentication, user management, tool execution, and session management systems.

## Streamable HTTP Transport (Recommended)

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

## SSE Transport (Legacy)

### Protocol Details
- **Version**: 2024-11-05
- **Endpoints**:
  - `/sse` - Server-Sent Events connection
  - `/messages` - Message posting
- **Authentication**: Query parameter `?apiKey=your-key` OR header `x-apikey: your-key`

### Features
- Server-Sent Events for real-time communication
- Separate endpoints for connection and messaging
- Established protocol with wide client support
- Maintained for backwards compatibility

### Example Usage

**Using Query Parameter:**
```bash
# Connect to SSE stream
curl "http://localhost:4001/sse?apiKey=your-api-key"

# Send messages via separate endpoint
curl -X POST "http://localhost:4001/messages?apiKey=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/call", "params": {"name": "weather", "arguments": {"location": "Boston"}}}'
```

**Using Header:**
```bash
# Connect to SSE stream
curl "http://localhost:4001/sse" \
  -H "x-apikey: your-api-key"

# Send messages via separate endpoint
curl -X POST "http://localhost:4001/messages" \
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
    ├── sse.ts           # SSE transport routes
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

## Migration Guide

### For New Integrations
Use the **Streamable HTTP Transport** for all new integrations:
- More efficient and modern
- Better error handling
- Simpler client implementation
- Future-proof design

### For Existing Integrations
Existing SSE-based integrations continue to work without changes:
- No breaking changes to SSE protocol
- Same authentication mechanism
- Identical tool execution behavior
- Can migrate at your own pace

### Client Libraries
Both transports work with standard MCP client libraries:
- Configure endpoint URL based on transport choice
- Same authentication and tool calling patterns
- Transport selection is transparent to application logic

## Performance Considerations

### Streamable HTTP
- Lower latency for request/response operations
- More efficient resource usage
- Better connection pooling support
- Simplified debugging and monitoring

### SSE Transport
- Persistent connection overhead
- Real-time streaming capabilities
- More complex connection management
- Legacy client compatibility

## Debugging and Monitoring

### Health Endpoints
Both transports support health monitoring:
- `GET /health` - Basic health check
- `GET /status` - Detailed status information

### Logging
Comprehensive logging for both transports:
- Connection establishment
- Authentication events
- Tool execution
- Error conditions
- Session lifecycle

## Best Practices

1. **Use Streamable HTTP** for new projects
2. **Maintain SSE** for existing integrations during transition
3. **Monitor both transports** during migration periods
4. **Test thoroughly** when switching transport protocols
5. **Use health endpoints** for monitoring and debugging

## Future Roadmap

- Streamable HTTP is the recommended and actively developed transport
- SSE transport will be maintained for backwards compatibility
- New features may be prioritized for Streamable HTTP
- Migration tools and guides will be provided as needed