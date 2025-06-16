# Weather Server Example

This example demonstrates how to create an MCP server with both tools and prompts using the Dynamic MCP Server framework.

## Features

### Tools
- **web-request**: Make HTTP requests to web services
- **get-weather**: Get current weather for a location using OpenWeatherMap API

### Prompts
- **weather-forecast-explanation**: Generate detailed explanations of weather forecast data
- **weather-api-guide**: Provide guides on using weather APIs effectively
- **weather-safety-tips**: Generate weather-related safety tips and recommendations

## Setup

1. Get an API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Set the environment variable:
   ```bash
   export OPENWEATHER_API_KEY=your_api_key_here
   ```
3. Start the server:
   ```bash
   npm run example:weather
   ```

## Usage Examples

### Using Tools

#### Get Weather Data
```json
{
  "method": "tools/call",
  "params": {
    "name": "get-weather",
    "arguments": {
      "location": "London",
      "units": "metric"
    }
  }
}
```

#### Make Web Request
```json
{
  "method": "tools/call",
  "params": {
    "name": "web-request",
    "arguments": {
      "url": "https://api.example.com/data",
      "method": "GET"
    }
  }
}
```

### Using Prompts

#### Weather Forecast Explanation
```json
{
  "method": "prompts/get",
  "params": {
    "name": "weather-forecast-explanation",
    "arguments": {
      "location": "New York",
      "includeAdvice": "true"
    }
  }
}
```

This prompt generates a comprehensive explanation of weather forecast data, including:
- Understanding different weather metrics
- Reading weather conditions
- Clothing and activity recommendations
- Weather planning tips

#### Weather API Guide
```json
{
  "method": "prompts/get",
  "params": {
    "name": "weather-api-guide",
    "arguments": {
      "apiType": "openweather",
      "includeExamples": "true"
    }
  }
}
```

This prompt provides:
- Overview of popular weather APIs
- Best practices for API usage
- Code examples in multiple languages
- Common parameters and their usage

#### Weather Safety Tips
```json
{
  "method": "prompts/get",
  "params": {
    "name": "weather-safety-tips",
    "arguments": {
      "weatherCondition": "storm",
      "activityType": "outdoor"
    }
  }
}
```

This prompt generates:
- Condition-specific safety guidelines
- Activity-based recommendations
- Emergency preparedness tips
- General weather safety principles

## Prompt vs Tool Usage

### When to Use Tools
- **get-weather**: When you need actual weather data for processing
- **web-request**: When you need to fetch data from APIs

### When to Use Prompts
- **weather-forecast-explanation**: When you need human-readable explanations
- **weather-api-guide**: When you need documentation or tutorials
- **weather-safety-tips**: When you need advisory content

## Architecture

The weather server demonstrates:

1. **Combined Handler**: Single handler function that processes both tool and prompt actions
2. **Action-Based Routing**: Uses `config.action` to determine whether to handle tools or prompts
3. **Rich Content Generation**: Prompts return formatted markdown content with comprehensive information
4. **Argument Processing**: Both tools and prompts accept and process arguments
5. **Error Handling**: Graceful handling of missing arguments and API errors

## Code Structure

```javascript
const weatherHandlerPackage = {
  name: "weather-tools",
  tools: [/* tool definitions */],
  prompts: [/* prompt definitions */],
  handler: async (args, context, config, progress) => {
    // Handle prompt actions
    if (config.action === "explain-forecast") {
      // Generate explanation content
      return { messages: [/* conversation */] };
    }
    
    // Handle tool actions (default)
    // Make API calls and return data
    return { result: data, message: "Success" };
  }
};
```

## Environment Variables

- `OPENWEATHER_API_KEY`: Required for weather API access
- `MCP_ADMIN_EMAIL`: Admin user email for the MCP server
- `MONGODB_URI`: MongoDB connection string (optional, defaults to local)

## Error Handling

The server includes comprehensive error handling for:
- Missing API keys
- Invalid API responses
- Network connectivity issues
- Missing prompt arguments
- Database connection problems

## Extending the Example

You can extend this example by:

1. **Adding More Weather APIs**: Integrate additional weather services
2. **Creating New Prompts**: Add prompts for weather alerts, seasonal advice, etc.
3. **Enhanced Tools**: Add tools for weather history, forecasts, or alerts
4. **Location Services**: Add geocoding tools for location lookup
5. **Data Processing**: Add tools for weather data analysis and visualization

This example serves as a template for creating MCP servers that combine both data retrieval (tools) and content generation (prompts) capabilities.