// @ts-nocheck

import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import util from 'util';
import http from 'http';
import path from 'path';
import axios from 'axios';
import HttpDispatcher from 'httpdispatcher';
import { connection, server as WebSocketServer } from 'websocket';

import textToSpeech, { protos as ttsProtos } from '@google-cloud/text-to-speech';

import twilio, { twiml } from 'twilio';
import 'dotenv/config';
import { CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call';

import { ENDPOINT } from './constants';
import TranscriptionService from './transcription-service';

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

app.post('/twiml', (req, res) => {
  const filePath = path.join(__dirname, '../public/twiml', 'stream.xml');
  const stat = fs.statSync(filePath);

  res.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': stat.size });
  const readStream = fs.createReadStream(filePath);

  readStream.pipe(res);
});

const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ httpServer, autoAcceptConnections: true });

wsServer.on('connect', (connection: connection) => {
  log('Connected!');
  new MediaStreamHandler(connection);
});

class MediaStreamHandler {
  constructor(connection: connection) {
    this.transcription = '';
    this.metaData = null;
    this.trackHandlers = {};
    connection.on('message', this.processMessage.bind(this));
    connection.on('close', this.close.bind(this));
  }

  processMessage(message) {
    if (message.type === 'utf8') {
      const data = JSON.parse(message.utf8Data);
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
          if (transcription?.includes('こんにちは')) {
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

// app.get('/', (req, res) => {
//   res.send('Hello wold!');
// });

// app.post('/twiml/*.xml', (req, res) => {
//   const filename = req.path;
//   console.log(filename);
//   res.contentType('application/xml');
//   res.sendFile(path.join(__dirname, '../public', filename));
// });

// app.get('/outgoing', async (req, res) => {
//   const callOption: CallListInstanceCreateOptions = {
//     url: `${baseUrl}/twiml/test.xml`,
//     from: '+15107571562',
//     to: '+818036686519',
//   };
//   try {
//     const call = await twilioClient.calls.create(callOption);
//     console.log(call);
//     res.send('Hello');
//   } catch (error) {
//     console.log(error);
//   }
// });

// const recognizeSpeech = async () => {
//   const speechClient = new speech.SpeechClient();
//   const audio = {};
//   const request = {};
//   const [response] = await speechClient.recognize(request);
//   const transcription = response.results
//     ?.map((result) => result.alternatives[0].transcript)
//     .join('\n');

//   return transcription;
// };

// app.post('/incoming', async (req, res) => {
//   try {
//     const ttsClient = new textToSpeech.TextToSpeechClient();
//     const text = 'お電話ありがとうございます';
//     const request: ttsProtos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
//       input: { text },
//       voice: { languageCode: 'ja-JP', ssmlGender: 'FEMALE' },
//       audioConfig: { audioEncoding: 'MP3' },
//     };

//     const [response] = await ttsClient.synthesizeSpeech(request);
//     const outputFileName = req.body.CallSid + '.mp3';

//     const writeFile = util.promisify(fs.writeFile);
//     await writeFile(`public/mp3/${outputFileName}`, response.audioContent as string, 'binary');

//     const twiml = new VoiceResponse();
//     twiml.say({ language: 'ja-JP', voice: 'Polly.Mizuki' }, 'テストです');
//     twiml.play(`${baseUrl}/mp3/${outputFileName}`);

//     await axios.get(ENDPOINT.onCirculator);

//     res.writeHead(200, { 'Content-Type': 'text/xml' });
//     res.end(twiml.toString());
//   } catch (error) {
//     console.log(error);
//   }
// });

const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
