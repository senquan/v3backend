import { Router, Request, Response } from 'express';
import { wxWorkCallbackHandler } from '../bot/handlers/wxwork-callback.handler';

const router = Router();
const callbackHandler = wxWorkCallbackHandler;

router.post('/callback', async (req: Request, res: Response) => {
  await callbackHandler.handleCallback(req, res);
});

export default router;