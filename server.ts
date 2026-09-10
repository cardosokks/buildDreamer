import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';

import { authRouter } from './backend/routes/auth';
import { usersRouter } from './backend/routes/users';
import { chatRouter } from './backend/routes/chat';
import { projectRouter } from './backend/routes/projects';
import { pageRouter } from './backend/routes/pages';
import { aiRouter } from './backend/routes/ai';
import { exportRouter } from './backend/routes/export';
import { leadsRouter } from './backend/routes/leads';
import { crawlerRouter } from './backend/routes/crawler';
import { ngrokRouter } from './backend/routes/ngrok';
import mediaRouter from './backend/routes/media';
import settingsRouter from './backend/routes/settings';
import productRouter from './backend/routes/products';
import salesRouter from './backend/routes/sales';
import { authenticateToken } from './backend/middleware/auth';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  app.use(morgan('dev'));
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Uploads directory
  const uploadsDir = path.join(process.cwd(), 'front-end', 'public', 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', authenticateToken, usersRouter);
  app.use('/api/chat', authenticateToken, chatRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/projects', authenticateToken, projectRouter);
  app.use('/api/export', authenticateToken, exportRouter);
  app.use('/api/ai', authenticateToken, aiRouter);
  app.use('/api/leads', authenticateToken, leadsRouter);
  app.use('/api/crawler', authenticateToken, crawlerRouter);
  app.use('/api/ngrok', authenticateToken, ngrokRouter);
  app.use('/api/settings', authenticateToken, settingsRouter);
  app.use('/api/products', authenticateToken, productRouter);
  app.use('/api/sales', authenticateToken, salesRouter);
  app.use('/api', authenticateToken, pageRouter);

  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
  });

  app.get('/ready', (req, res) => {
    res.json({ status: 'READY' });
  });

  // WebSocket Connection
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join_room', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    socket.on('send_message', (message) => {
      if (message.recipientId && message.recipientId !== 'ALL') {
        io.to(`user_${message.recipientId}`).emit('receive_message', message);
        io.to(`user_${message.senderId}`).emit('receive_message', message);
      } else {
        io.emit('receive_message', message);
      }
    });

    socket.on('send_notification', (notif) => {
      if (notif.recipientId) {
        io.to(`user_${notif.recipientId}`).emit('receive_notification', notif);
      } else {
        io.emit('receive_notification', notif);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================================`);
    console.log(`🚀 BUILD DREAMER - INICIADO COM SUCESSO!`);
    console.log(`========================================================`);
    console.log(`📡 Servidor ativo na porta: http://0.0.0.0:${PORT}`);
    console.log(`🔗 Healthcheck: http://0.0.0.0:${PORT}/health`);
    console.log(`========================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
