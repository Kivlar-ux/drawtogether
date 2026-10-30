import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './handlers';

const app = express();
app.use(cors({ origin: '*' }));
app.get('/health', (_, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
});

registerHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server on :${PORT}`));