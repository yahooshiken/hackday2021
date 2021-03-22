# Hack day 2021
For Hack Day 2021 (Hack ID 21).

## Setup
### Prerequisite

- Node.js
- Twilio accounts & phone number
- ngrok

### Setup your .env
```sh
$ npx configure-env
```

### Enable Google Cloud Speech API

- Visit: https://console.cloud.google.com/marketplace/details/google/speech.googleapis.com
  - Select a Project
  - Enable Cloud Speech-to-Text API
  - Choose credentials
    - Create a new Credential file
    - Set your `GOOGLE_APPLICATION_CREDENTIALS` in environmental variable.

## Running App
### Installation

Resolve dependencies.

```sh
$ yarn install # or $ npm install
```

### Running the server

Start the server locally.

```sh
$ yarn run dev # or $ npm run dev
```

## Tips
### Audio codec in Twilio
The audio codec available in Twilio is `mulau` and the sample rate is `8000`. If your audio files uses a different codec, you can use the following command to convert them. (You may need to install [ffmpeg]() before hand.)

```sh 
$ brew install ffmpeg # If you don't have installed.
$ ffmpeg -i input.mp3 -f u8 -ar 8000 -acodec pcm_mulaw -ac 1 output.wav -y
```