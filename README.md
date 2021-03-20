# hackday2021
For Hack Day 2021


## Codec

ffmpeg -i input.mp3 -f u8 -ar 8000 -acodec pcm_mulaw -ac 1 output.wav -y