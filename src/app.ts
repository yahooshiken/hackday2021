import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { connection, server as WebSocketServer } from 'websocket';

import twilio from 'twilio';
import MediaStreamHandler from './media-stream-handler';

import log from './logger';
import { CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call';

const {
  BASE_URL: baseUrl,
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
} = process.env;

const twilioClient = twilio(accountSid, authToken);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Hello wold!');
});

app.post('/twiml', (req, res) => {
  const filePath = path.join(__dirname, '../public/twiml', 'stream.xml');
  const stat = fs.statSync(filePath);

  res.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': stat.size });
  const readStream = fs.createReadStream(filePath);

  readStream.pipe(res);
});

app.post('/twiml/*.xml', (req, res) => {
  const filename = req.path;
  res.contentType('application/xml');
  res.sendFile(path.join(__dirname, '../public', filename));
});

const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer, autoAcceptConnections: true });

wsServer.on('connect', (connection: connection) => {
  log('Connected!');
  new MediaStreamHandler(connection);
});

app.get('/outgoing', async (req, res) => {
  const callOption: CallListInstanceCreateOptions = {
    url: `${baseUrl}/twiml/stream.xml`,
    from: '+15107571562',
    to: '+818036686519',
  };

  try {
    await twilioClient.calls.create(callOption);
    res.send('Hello');
  } catch (error) {
    console.log(error);
  }
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
