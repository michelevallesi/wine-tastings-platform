FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY .env.example ./.env

#RUN npm ci --only=production
RUN npm install --only=production
# Create uploads directory
RUN mkdir -p uploads

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Change ownership of app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["npm", "start"]
