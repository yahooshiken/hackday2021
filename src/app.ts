import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import http from 'http';
import path from 'path';
import axios from 'axios';
import { connection, IMessage, server as WebSocketServer } from 'websocket';

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

app.post('/twiml/*.xml', (req, res) => {
  const filename = req.path;
  res.contentType('application/xml');
  res.sendFile(path.join(__dirname, '../public', filename));
});

const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer, autoAcceptConnections: true });

interface StartMetaData {
  accountSid: string;
  streamSid: string;
  callSid: string;
  tracks: string[];
  mediaFormat: { encoding: string; sampleRate: number; channels: number };
}

interface Data {
  event: 'start' | 'media';
  sequenceNumber: string;
  media: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  start: StartMetaData;
  streamSid: string;
}

wsServer.on('connect', (connection: connection) => {
  log('Connected!');
  new MediaStreamHandler(connection);
});

class MediaStreamHandler {
  transcription: string;
  metaData: StartMetaData | null;
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

  playAudio(fileName: string) {
    const buffer = fs.readFileSync(path.join(__dirname, '../public/mp3', fileName));
    const payload = new Buffer(buffer).toString('base64');
    const message = { event: 'media', media: { payload }, streamSid: this.streamSid };
    this.send(JSON.stringify(message));
  }

  send(message: string) {
    this.connection.sendUTF(message);
  }

  processMessage(message: IMessage) {
    if (message.type === 'utf8') {
      const data: Data = JSON.parse(message.utf8Data || '{}');
      if (data.event === 'start') {
        this.metaData = data.start;
      }
      if (data.event !== 'media') {
        return;
      }

      const { track } = data.media;
      if (this.trackHandlers[track] === undefined) {
        const service = new TranscriptionService();
        let flag = { '1': false, '2': false, '3': false };
        service.on('transcription', (transcription) => {
          this.streamSid = data.streamSid;
          log(`Transcription (${track}): ${transcription}`);

          if (transcription?.includes('お願い') && flag[1] === false) {
            this.playAudio('2.wav');
            axios.get(ENDPOINT.startRoomba);
            flag[1] = true;
          } else if (transcription?.includes('そうだね') && flag[2] === false) {
            this.playAudio('3.wav');
            axios.get(ENDPOINT.onCirculator);
            flag[2] = true;
          } else if (transcription?.includes('よろしく') && flag[3] === false) {
            this.playAudio('4.wav');
            axios.get(ENDPOINT.pressSwitch);
            flag[3] = true;
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
    axios.get(ENDPOINT.offCirculator);
    axios.get(ENDPOINT.stopRoomba);

    for (let track of Object.keys(this.trackHandlers)) {
      log(`Closing ${track} handler`);
      this.trackHandlers[track].close();
    }
  }
}

app.get('/outgoing', async (req, res) => {
  const callOption: CallListInstanceCreateOptions = {
    url: `${baseUrl}/twiml/stream.xml`,
    from: '+15107571562',
    to: '+818036686519',
  };

  try {
    const call = await twilioClient.calls.create(callOption);
    res.send('Hello');
  } catch (error) {
    console.log(error);
  }
});

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
