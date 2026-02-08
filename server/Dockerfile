# Use Node.js LTS (Long Term Support) version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define environment variables (Can be overridden at runtime)
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
