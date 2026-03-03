#!/bin/bash

echo "🚀 Starting Frontend with Network Access + Ngrok Backend..."

# Your ngrok backend URL
NGROK_BACKEND_URL="https://transpiratory-unfairly-althea.ngrok-free.dev"

echo "🌐 Backend URL: $NGROK_BACKEND_URL"
echo "🎨 Starting frontend with network access..."

cd frontend
NGROK_URL=$NGROK_BACKEND_URL npm run dev:network
