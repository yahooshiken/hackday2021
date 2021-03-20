// @ts-nocheck
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import http from 'http';
import path from 'path';
import axios from 'axios';
import { connection, server as WebSocketServer } from 'websocket';

import twilio, { twiml } from 'twilio';
import 'dotenv/config';

import { ENDPOINT } from './constants';
import TranscriptionService from './transcription-service';
import { CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call';

const { VoiceResponse } = twiml;

const {
  BASE_URL: baseUrl,
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
} = process.env;

const twilioClient = twilio(accountSid, authToken);
const log = (message, ...args) => {
  console.log(new Date(), message, ...args);
};

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

const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer, autoAcceptConnections: true });

interface Message {
  type: string;
  utf8Data: string;
}

interface Data {
  event: string;
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  streamSid: string;
}

wsServer.on('connect', (connection: connection) => {
  log('Connected!');
  new MediaStreamHandler(connection);
});

class MediaStreamHandler {
  transcription: string;
  metaData: null;
  trackHandlers: any;
  connection: connection;
  streamSid: string;

  constructor(connection: connection) {
    this.connection = connection;
    this.transcription = '';
    this.metaData = null;
    this.trackHandlers = {};
    this.streamSid = '';
    connection.on('message', this.processMessage.bind(this));
    connection.on('close', this.close.bind(this));
  }

  send(message: string) {
    this.connection.sendUTF(message);
  }

  processMessage(message: Message) {
    if (message.type === 'utf8') {
      const data: Data = JSON.parse(message.utf8Data);
      if (data.event === 'start') {
        this.metaData = data.start;
      }
      if (data.event !== 'media') {
        return;
      }

      const { track } = data.media;
      if (this.trackHandlers[track] === undefined) {
        const service = new TranscriptionService();
        service.on('transcription', (transcription) => {
          log(`Transcription (${track}): ${transcription}`);
          if (transcription?.includes('お願い')) {
            const buffer = fs.readFileSync(path.join(__dirname, '../public/mp3', 'hoge.wav'));
            const payload = new Buffer(buffer).toString('base64');
            this.streamSid = data.streamSid;
            const message = { event: 'media', media: { payload }, streamSid: this.streamSid };
            this.send(JSON.stringify(message));
            axios.get(ENDPOINT.onCirculator);
          }
        });
        this.trackHandlers[track] = service;
      }

      this.trackHandlers[track].send(data.media.payload);
    } else if (message.type === 'binary') {
      log('Media WS: binary message received (not supported)');
    }
  }

  close() {
    log('Media WS: closed');

    for (let track of Object.keys(this.trackHandlers)) {
      log(`Closing ${track} handler`);
      this.trackHandlers[track].close();
    }
  }
}

app.get('/outgoing', async (req, res) => {
  const callOption: CallListInstanceCreateOptions = {
    url: `${baseUrl}/twiml/test.xml`,
    from: '+15107571562',
    to: '+818036686519',
  };
  18;
  try {
    const call = await twilioClient.calls.create(callOption);
    console.log(call);
    res.send('Hello');
  } catch (error) {
    console.log(error);
  }
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
