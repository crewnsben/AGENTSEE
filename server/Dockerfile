FROM node:14

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create the comfyui_temp directory
RUN mkdir -p /usr/src/app/comfyui_temp

EXPOSE 5000
CMD [ "node", "index.js" ]