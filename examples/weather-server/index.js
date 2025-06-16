import { DynamicMcpServer, logger } from "../../dist/index.js";
import dotenv from "dotenv";
dotenv.config();

// Combined Weather Handler Package
const weatherHandlerPackage = {
  name: "weather-tools",
  tools: [
    {
      name: "web-request",
      description: "Make HTTP requests to web services",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to request" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            default: "GET",
          },
          queryParams: {
            type: "object",
            additionalProperties: true,
            description: "Query parameters to include in the request",
          },
          body: {
            type: "object",
            additionalProperties: true,
            description: "Request body for POST/PUT methods",
          },
        },
        required: ["url"],
      },
      rolesPermitted: [],
      annotations: {
        title: "Web Service",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      handler: {
        type: "weather-tools",
        config: {},
      },
    },
    {
      name: "get-weather",
      description: "Get current weather for a location",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or coordinates",
          },
          units: {
            type: "string",
            enum: ["metric", "imperial"],
            default: "metric",
          },
        },
        required: ["location"],
      },
      rolesPermitted: ["user", "power-user", "admin"],
      annotations: {
        title: "Weather",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      handler: {
        type: "weather-tools",
        config: {
          argMappings: {
            url: "https://api.openweathermap.org/data/2.5/weather",
            queryParams: {
              appid: "{{OPENWEATHER_API_KEY}}",
              q: "{{location}}",
              units: "{{units}}",
            },
          },
        },
      },
    },
  ],
  prompts: [
    {
      name: "weather-forecast-explanation",
      description: "Generate a detailed explanation of weather forecast data",
      arguments: [
        {
          name: "location",
          description: "The location for which to explain the weather",
          required: true,
        },
        {
          name: "includeAdvice",
          description: "Whether to include clothing and activity advice",
          required: false,
        },
      ],
      handler: {
        type: "weather-tools",
        config: {
          action: "explain-forecast",
        },
      },
      alwaysVisible: true,
    },
    {
      name: "weather-api-guide",
      description: "Generate a guide on how to use weather APIs effectively",
      arguments: [
        {
          name: "apiType",
          description: "Type of weather API (openweather, weatherapi, etc.)",
          required: false,
        },
        {
          name: "includeExamples",
          description: "Whether to include code examples",
          required: false,
        },
      ],
      handler: {
        type: "weather-tools",
        config: {
          action: "api-guide",
        },
      },
      alwaysVisible: true,
    },
    {
      name: "weather-safety-tips",
      description: "Generate weather-related safety tips and recommendations",
      arguments: [
        {
          name: "weatherCondition",
          description: "Specific weather condition (storm, snow, heat, etc.)",
          required: false,
        },
        {
          name: "activityType",
          description: "Type of activity (outdoor, travel, sports, etc.)",
          required: false,
        },
      ],
      handler: {
        type: "weather-tools",
        config: {
          action: "safety-tips",
        },
      },
      alwaysVisible: true,
    },
  ],
  handler: async (args, context, config, progress = () => null) => {
    // Handle prompt actions
    if (config.action === "explain-forecast") {
      const { location, includeAdvice } = args;
      
      let explanation = `# Weather Forecast Explanation for ${location || "Your Location"}\n\n`;
      explanation += "## Understanding Weather Data\n\n";
      explanation += "Weather forecasts provide several key pieces of information:\n\n";
      explanation += "- **Temperature**: Current and feels-like temperatures\n";
      explanation += "- **Humidity**: Moisture content in the air (affects comfort)\n";
      explanation += "- **Wind**: Speed and direction (affects temperature perception)\n";
      explanation += "- **Pressure**: Atmospheric pressure (indicates weather changes)\n";
      explanation += "- **Visibility**: How far you can see (affected by fog, rain, etc.)\n";
      explanation += "- **UV Index**: Strength of ultraviolet radiation from the sun\n\n";
      
      explanation += "## Reading Weather Conditions\n\n";
      explanation += "Weather conditions are typically described using:\n";
      explanation += "- **Clear/Sunny**: No clouds, bright sunshine\n";
      explanation += "- **Partly Cloudy**: Some clouds, but mostly sunny\n";
      explanation += "- **Overcast**: Completely cloudy sky\n";
      explanation += "- **Rain**: Precipitation in liquid form\n";
      explanation += "- **Snow**: Precipitation in frozen form\n";
      explanation += "- **Thunderstorms**: Rain with lightning and thunder\n\n";
      
      if (includeAdvice === "true" || includeAdvice === true) {
        explanation += "## Clothing and Activity Recommendations\n\n";
        explanation += "### Temperature-Based Clothing:\n";
        explanation += "- **Above 25°C (77°F)**: Light, breathable clothing, shorts, t-shirts\n";
        explanation += "- **15-25°C (59-77°F)**: Light layers, long pants, light jacket\n";
        explanation += "- **5-15°C (41-59°F)**: Warm layers, jacket, closed shoes\n";
        explanation += "- **Below 5°C (41°F)**: Heavy coat, warm layers, gloves, hat\n\n";
        
        explanation += "### Activity Suggestions:\n";
        explanation += "- **Sunny Weather**: Outdoor sports, hiking, picnics\n";
        explanation += "- **Rainy Weather**: Indoor activities, museums, shopping\n";
        explanation += "- **Windy Weather**: Avoid outdoor activities with loose objects\n";
        explanation += "- **Extreme Weather**: Stay indoors, avoid unnecessary travel\n\n";
      }
      
      explanation += "## Tips for Weather Planning\n\n";
      explanation += "1. Check the forecast regularly as conditions can change\n";
      explanation += "2. Pay attention to 'feels like' temperature for comfort\n";
      explanation += "3. Consider wind chill in cold weather\n";
      explanation += "4. Check UV index for sun protection needs\n";
      explanation += "5. Monitor severe weather alerts and warnings\n";
      
      return {
        description: `Weather forecast explanation for ${location || "your location"}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Can you explain the weather forecast for ${location || "my location"}?`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: explanation,
            },
          },
        ],
      };
    }
    
    if (config.action === "api-guide") {
      const { apiType, includeExamples } = args;
      
      let guide = "# Weather API Usage Guide\n\n";
      guide += "## Popular Weather APIs\n\n";
      
      if (!apiType || apiType === "openweather") {
        guide += "### OpenWeatherMap API\n";
        guide += "- **Website**: https://openweathermap.org/\n";
        guide += "- **Free Tier**: 1,000 calls/day\n";
        guide += "- **Features**: Current weather, forecasts, historical data\n";
        guide += "- **Data Format**: JSON\n\n";
      }
      
      guide += "### Other Popular APIs:\n";
      guide += "- **WeatherAPI**: https://www.weatherapi.com/\n";
      guide += "- **AccuWeather**: https://developer.accuweather.com/\n";
      guide += "- **Weather Underground**: https://www.wunderground.com/weather/api/\n\n";
      
      guide += "## API Best Practices\n\n";
      guide += "1. **Rate Limiting**: Respect API rate limits to avoid being blocked\n";
      guide += "2. **Caching**: Cache responses to reduce API calls\n";
      guide += "3. **Error Handling**: Always handle API errors gracefully\n";
      guide += "4. **API Keys**: Keep your API keys secure and never expose them\n";
      guide += "5. **Units**: Specify units (metric/imperial) for consistent data\n\n";
      
      if (includeExamples === "true" || includeExamples === true) {
        guide += "## Code Examples\n\n";
        guide += "### JavaScript/Node.js Example:\n";
        guide += "```javascript\n";
        guide += "const apiKey = 'your-api-key';\n";
        guide += "const city = 'London';\n";
        guide += "const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;\n\n";
        guide += "fetch(url)\n";
        guide += "  .then(response => response.json())\n";
        guide += "  .then(data => {\n";
        guide += "    console.log(`Temperature: ${data.main.temp}°C`);\n";
        guide += "    console.log(`Weather: ${data.weather[0].description}`);\n";
        guide += "  })\n";
        guide += "  .catch(error => console.error('Error:', error));\n";
        guide += "```\n\n";
        
        guide += "### Python Example:\n";
        guide += "```python\n";
        guide += "import requests\n\n";
        guide += "api_key = 'your-api-key'\n";
        guide += "city = 'London'\n";
        guide += "url = f'https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric'\n\n";
        guide += "response = requests.get(url)\n";
        guide += "data = response.json()\n\n";
        guide += "print(f\"Temperature: {data['main']['temp']}°C\")\n";
        guide += "print(f\"Weather: {data['weather'][0]['description']}\")\n";
        guide += "```\n\n";
      }
      
      guide += "## Common Parameters\n\n";
      guide += "- **q**: City name (e.g., 'London' or 'London,UK')\n";
      guide += "- **lat/lon**: Coordinates for precise location\n";
      guide += "- **appid**: Your API key\n";
      guide += "- **units**: 'metric', 'imperial', or 'kelvin'\n";
      guide += "- **lang**: Language for weather descriptions\n";
      
      return {
        description: "Guide for using weather APIs effectively",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "How do I use weather APIs effectively?",
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: guide,
            },
          },
        ],
      };
    }
    
    if (config.action === "safety-tips") {
      const { weatherCondition, activityType } = args;
      
      let tips = "# Weather Safety Tips\n\n";
      
      if (weatherCondition) {
        tips += `## Safety Tips for ${weatherCondition.charAt(0).toUpperCase() + weatherCondition.slice(1)} Weather\n\n`;
        
        switch (weatherCondition.toLowerCase()) {
          case "storm":
          case "thunderstorm":
            tips += "### Thunderstorm Safety:\n";
            tips += "- Stay indoors and away from windows\n";
            tips += "- Avoid using electrical appliances\n";
            tips += "- Don't take showers or baths during storms\n";
            tips += "- If outdoors, seek shelter immediately\n";
            tips += "- Avoid tall objects like trees and poles\n";
            tips += "- Wait 30 minutes after the last thunder before going outside\n\n";
            break;
            
          case "snow":
          case "blizzard":
            tips += "### Snow/Winter Weather Safety:\n";
            tips += "- Dress in layers and cover exposed skin\n";
            tips += "- Keep emergency supplies in your car\n";
            tips += "- Clear snow from vehicle exhaust pipes\n";
            tips += "- Drive slowly and increase following distance\n";
            tips += "- Keep sidewalks and driveways clear\n";
            tips += "- Watch for signs of hypothermia and frostbite\n\n";
            break;
            
          case "heat":
          case "hot":
            tips += "### Hot Weather Safety:\n";
            tips += "- Stay hydrated - drink water regularly\n";
            tips += "- Wear light-colored, loose-fitting clothing\n";
            tips += "- Limit outdoor activities during peak heat\n";
            tips += "- Use sunscreen with SPF 30 or higher\n";
            tips += "- Take frequent breaks in shade or air conditioning\n";
            tips += "- Never leave children or pets in vehicles\n\n";
            break;
            
          case "rain":
          case "flood":
            tips += "### Rain/Flood Safety:\n";
            tips += "- Avoid driving through flooded roads\n";
            tips += "- Turn around, don't drown - 6 inches can knock you down\n";
            tips += "- Stay away from storm drains and ditches\n";
            tips += "- Keep emergency kit with flashlight and radio\n";
            tips += "- Monitor local weather alerts\n";
            tips += "- Have evacuation plan ready\n\n";
            break;
        }
      }
      
      if (activityType) {
        tips += `## Safety for ${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Activities\n\n`;
        
        switch (activityType.toLowerCase()) {
          case "outdoor":
          case "hiking":
            tips += "### Outdoor Activity Safety:\n";
            tips += "- Check weather forecast before heading out\n";
            tips += "- Tell someone your plans and expected return\n";
            tips += "- Bring extra water and snacks\n";
            tips += "- Wear appropriate clothing for conditions\n";
            tips += "- Carry emergency whistle and first aid kit\n";
            tips += "- Know signs of weather deterioration\n\n";
            break;
            
          case "travel":
          case "driving":
            tips += "### Travel Safety:\n";
            tips += "- Check road conditions before departure\n";
            tips += "- Keep vehicle emergency kit stocked\n";
            tips += "- Maintain safe following distance\n";
            tips += "- Reduce speed in poor conditions\n";
            tips += "- Keep gas tank at least half full\n";
            tips += "- Have alternative routes planned\n\n";
            break;
            
          case "sports":
          case "exercise":
            tips += "### Sports/Exercise Safety:\n";
            tips += "- Monitor heat index and air quality\n";
            tips += "- Adjust intensity based on conditions\n";
            tips += "- Stay hydrated before, during, and after\n";
            tips += "- Recognize signs of heat exhaustion\n";
            tips += "- Have indoor backup plans\n";
            tips += "- Use proper protective equipment\n\n";
            break;
        }
      }
      
      tips += "## General Weather Safety Guidelines\n\n";
      tips += "1. **Stay Informed**: Monitor weather alerts and warnings\n";
      tips += "2. **Plan Ahead**: Have emergency supplies ready\n";
      tips += "3. **Know the Signs**: Learn to recognize dangerous weather\n";
      tips += "4. **Have a Plan**: Know what to do in emergencies\n";
      tips += "5. **Stay Connected**: Keep communication devices charged\n";
      tips += "6. **Trust Authorities**: Follow official evacuation orders\n\n";
      
      tips += "## Emergency Contacts\n\n";
      tips += "- **Emergency Services**: 911 (US) or local emergency number\n";
      tips += "- **Weather Service**: National Weather Service alerts\n";
      tips += "- **Local Authorities**: City/county emergency management\n";
      tips += "- **Utility Companies**: For power outages and gas leaks\n";
      
      return {
        description: "Weather safety tips and recommendations",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `What safety tips should I know for ${weatherCondition || "various weather conditions"}${activityType ? ` when ${activityType}` : ""}?`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: tips,
            },
          },
        ],
      };
    }
    
    // Handle tool actions (existing functionality)
    progress(0, 100, "Starting weather request...");
    const method = "GET";
    const baseUrl = args.url;
    const queryParams = args.queryParams || {};
    // No need to resolve template variables here; already handled by ToolService
    const urlObj = new URL(baseUrl);
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== "") urlObj.searchParams.append(k, v);
    });
    progress(50, 100, "Sending request...");
    const response = await fetch(urlObj.toString(), {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    progress(80, 100, "Received response");
    const data = await response.json();
    progress(100, 100, "Done");
    return { result: data, message: "Weather request successful" };
  },
};

(async () => {
  // Setup server with weather handler
  const server = new DynamicMcpServer({
    name: "weather-mcp",
    version: "1.0.0",
  });

  // Check if OPENWEATHER_API_KEY is set
  if (!process.env.OPENWEATHER_API_KEY) {
    logger.info(
      "Note: You need to set the OPENWEATHER_API_KEY environment variable to use the weather tool. Get an API key from https://openweathermap.org/",
    );
    process.exit(1);
  }
  logger.info("OPENWEATHER_API_KEY is set");

  // Start the server (connects to MongoDB)
  await server.start();

  // Register the combined weather handler package
  await server.registerHandler(weatherHandlerPackage);

  // Start the server HTTP listeners (if not already started in server.start)
  logger.info("Weather MCP Server started");
  logger.info("Available at http://localhost:3000");
})();
