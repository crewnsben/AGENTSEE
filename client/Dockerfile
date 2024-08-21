# Use the official Node.js image
# FROM node:14
# Try to use an image that utilizes both python and node.js
FROM nikolaik/python-nodejs:latest

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application's source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the app in development mode
CMD ["npm", "start"]