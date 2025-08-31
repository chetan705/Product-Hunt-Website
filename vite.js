const express = require('express');
const fs = require('fs');
const path = require('path');

function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function setupVite(app, server) {
  // This is a simplified version for development
  // In a real Replit environment, Vite would be handled differently
  log("Vite setup would be configured here for development mode");
}

function serveStatic(app) {
  const distPath = path.resolve(__dirname, "client", "dist");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

module.exports = {
  log,
  setupVite,
  serveStatic
};
