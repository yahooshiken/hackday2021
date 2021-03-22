import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.post('/twiml', (req, res) => {
  const filePath = path.join(process.cwd(), 'public/twiml', 'stream.xml');
  const stat = fs.statSync(filePath);

  res.writeHead(200, { 'Content-Type': 'text/xml', 'Content-Length': stat.size });
  const readStream = fs.createReadStream(filePath);

  readStream.pipe(res);
});

router.post('/twiml/*.xml', (req, res) => {
  const filename = req.path;
  res.contentType('application/xml');
  res.sendFile(path.join(process.cwd(), 'public', filename));
});

export default router;
