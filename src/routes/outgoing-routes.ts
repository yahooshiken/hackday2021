import express from 'express';
import twilio from 'twilio';
import { CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call';

const {
  BASE_URL: baseUrl,
  TWILIO_ACCOUNT_SID: accountSid,
  TWILIO_AUTH_TOKEN: authToken,
  FROM_TEL_NUMBER: fromTelNumber,
  TO_TEL_NUMBER: toTelNumber,
} = process.env;

const router = express.Router();

router.get('/outgoing', async (req, res) => {
  const twilioClient = twilio(accountSid, authToken);
  const callOption: CallListInstanceCreateOptions = {
    url: `${baseUrl}/twiml/stream.xml`,
    from: fromTelNumber || '',
    to: toTelNumber || '',
  };

  try {
    await twilioClient.calls.create(callOption);
    res.send('Hello');
  } catch (error) {
    console.log(error);
  }
});

export default router;
