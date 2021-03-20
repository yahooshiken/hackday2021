import { Writable } from 'stream';
import EventEmitter from 'events';
import Speech from '@google-cloud/speech';
import { google } from '@google-cloud/speech/build/protos/protos';

const speech = new Speech.SpeechClient();

class TranscriptionService extends EventEmitter {
  stream: Writable | null;
  streamCreatedAt: Date | null;

  constructor() {
    super();
    this.stream = null;
    this.streamCreatedAt = null;
  }

  send(payload: any) {
    this.getStream()?.write(payload);
  }

  close() {
    if (this.stream) {
      this.stream.destroy();
    }
  }

  newStreamRequired() {
    if (!this.stream || !this.streamCreatedAt) return true;

    const now = new Date();
    const timeSinceStreamCreated = now.getTime() - this.streamCreatedAt.getTime();
    return timeSinceStreamCreated / 1000 > 60;
  }

  getStream() {
    if (this.newStreamRequired()) {
      if (this.stream) {
        this.stream.destroy();
      }

      const request: google.cloud.speech.v1p1beta1.IStreamingRecognitionConfig = {
        config: {
          encoding: 'MULAW',
          sampleRateHertz: 8000,
          languageCode: 'ja-JP',
        },
        interimResults: true,
      };

      this.streamCreatedAt = new Date();
      this.stream = speech
        .streamingRecognize(request)
        .on('error', console.error)
        .on('data', (data) => {
          const result = data.results[0];
          if (result === undefined || result.alternatives[0] === undefined) {
            return;
          }
          this.emit('transcription', result.alternatives[0].transcript);
        });
    }

    return this.stream;
  }
}

module.exports = TranscriptionService;
