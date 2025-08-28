FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production
COPY . .

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001
USER nodeuser

EXPOSE 3000

CMD ["npm", "start"]
