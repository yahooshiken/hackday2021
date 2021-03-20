import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import util from 'util';
import path from 'path';
import axios from 'axios';

import textToSpeech, { protos } from '@google-cloud/text-to-speech';
import twilio, { twiml } from 'twilio';
import 'dotenv/config';
import { CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call';

import { ENDPOINT } from './constants';

const { VoiceResponse } = twiml;

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

app.post('/twiml/*.xml', (req, res) => {
  const filename = req.path;
  console.log(filename);
  res.contentType('application/xml');
  res.sendFile(path.join(__dirname, '../public', filename));
});

app.get('/outgoing', async (req, res) => {
  const callOption: CallListInstanceCreateOptions = {
    url: `${baseUrl}/twiml/test.xml`,
    from: '+15107571562',
    to: '+818036686519',
  };
  try {
    const call = await twilioClient.calls.create(callOption);
    console.log(call);
    res.send('Hello');
  } catch (error) {
    console.log(error);
  }
});

app.post('/incoming', async (req, res) => {
  try {
    const client = new textToSpeech.TextToSpeechClient();
    const text = 'お電話ありがとうございます';
    const request: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      input: { text },
      voice: { languageCode: 'ja-JP', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await client.synthesizeSpeech(request);
    const outputFileName = req.body.CallSid + '.mp3';

    const writeFile = util.promisify(fs.writeFile);
    await writeFile(`public/mp3/${outputFileName}`, response.audioContent as string, 'binary');

    const twiml = new VoiceResponse();
    twiml.say({ language: 'ja-JP', voice: 'Polly.Mizuki' }, 'テストです');
    twiml.play(`${baseUrl}/mp3/${outputFileName}`);

    await axios.get(ENDPOINT.onCirculator);

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
  } catch (error) {
    console.log(error);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
