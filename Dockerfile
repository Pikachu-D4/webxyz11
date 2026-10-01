FROM node:20-bookworm-slim

# Install system dependencies: ffmpeg, python3, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp Linux standalone binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app code
COPY . .

# Ensure bin and downloads directories exist with links to system binaries
RUN mkdir -p /app/bin /app/downloads \
    && ln -sf /usr/local/bin/yt-dlp /app/bin/yt-dlp \
    && ln -sf /usr/bin/ffmpeg /app/bin/ffmpeg \
    && ln -sf /usr/bin/ffprobe /app/bin/ffprobe \
    && chmod -R 777 /app/downloads

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
