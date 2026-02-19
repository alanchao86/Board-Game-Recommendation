const express = require('express');
const app = express();
const port = process.env.PORT || 5001;
const routes = require('./routers');
const cors = require('cors');
const pool = require('./db');
const Server = require("socket.io");
const http = require('http');
const server = http.createServer(app);

const users = {};
const corsOrigins = (process.env.CORS_ORIGINS || process.env.GITHUB_CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: corsOrigins,
}));
app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  })
)
app.use('/', routes)

server.listen(port, '0.0.0.0', () => {
  console.log(`App running on port ${port}.`)
})
