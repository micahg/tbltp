FROM node:18.20.8-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
COPY server.js ./

# Webpack will build modules into the production bundle so we don't need npm install anymore
# If you are building your code for production
# RUN npm install --omit=dev --only=production

EXPOSE 3000
CMD [ "node", "server.js" ]
