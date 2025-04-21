#!/bin/bash

# Find all PIDs of mcp-remote processes
pids=$(pgrep -f mcp-remote)

# Check if any PIDs were found
if [ -z "$pids" ]; then
  echo "No mcp-remote processes are running."
else
  # Kill all found PIDs
  echo "Killing the following mcp-remote processes: $pids"
  kill -9 $pids
  echo "All mcp-remote processes have been shut down."
fi

# Clean up any active mcp-auth connections
if [ -d "~/.mcp-auth" ]; then
  echo "Removing the ~/.mcp-auth directory."
  rm -rf ~/.mcp-auth
  echo "Cleanup complete."
else
  echo "No ~/.mcp-auth directory found."
fi
