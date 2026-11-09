module.exports = {
  apps: [
    {
      name: "formora-api",
      script: "server/server.js",
      instances: 1, // Single instance preserves in-memory cache and SQLite WAL locking
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};

