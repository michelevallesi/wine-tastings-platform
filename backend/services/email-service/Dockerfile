FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY .env ./
#RUN npm ci --only=production
RUN npm install --production
COPY . .

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001
USER nodeuser

EXPOSE 3006

CMD ["npm", "start"]
