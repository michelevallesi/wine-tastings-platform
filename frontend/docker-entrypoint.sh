#!/bin/sh
set -e

# Function to replace environment variables in built files
replace_env_vars() {
    echo "Replacing environment variables in built files..."
    
    # Replace API URL if provided
    if [ ! -z "$REACT_APP_API_URL" ]; then
        echo "Setting API URL to: $REACT_APP_API_URL"
        find /usr/share/nginx/html -name "*.js" -exec sed -i "s|http://localhost:3000/api|$REACT_APP_API_URL|g" {} +
        find /usr/share/nginx/html -name "*.js" -exec sed -i "s|REACT_APP_API_URL_PLACEHOLDER|$REACT_APP_API_URL|g" {} +
    fi
    
    # Replace other environment variables as needed
    if [ ! -z "$REACT_APP_ENV" ]; then
        echo "Setting environment to: $REACT_APP_ENV"
        find /usr/share/nginx/html -name "*.js" -exec sed -i "s|REACT_APP_ENV_PLACEHOLDER|$REACT_APP_ENV|g" {} +
    fi
    
    echo "Environment variable replacement completed."
}

# Run environment variable replacement
replace_env_vars

# Execute the main command
exec "$@"