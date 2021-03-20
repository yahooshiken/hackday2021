import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import http from 'http';
import { connection, server as WebSocketServer } from 'websocket';

import MediaStreamHandler from './media-stream-handler';
import log from './logger';
import { outgoingRoutes, twimlRoutes, homeRoutes } from './routes';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// App routes
app.use(homeRoutes);
app.use(outgoingRoutes);
app.use(twimlRoutes);

// Create http/websocket server
const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer, autoAcceptConnections: true });

wsServer.on('connect', (connection: connection) => {
  log('WevSocket server connected!');
  new MediaStreamHandler(connection);
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
