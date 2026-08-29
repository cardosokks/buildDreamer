import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { chatRouter } from './routes/chat';
import { projectRouter } from './routes/projects';
import { pageRouter } from './routes/pages';
import { aiRouter } from './routes/ai';
import { exportRouter } from './routes/export';
import { leadsRouter } from './routes/leads';
import { crawlerRouter } from './routes/crawler';
import { ngrokRouter } from './routes/ngrok';
import mediaRouter from './routes/media';
import { authenticateToken } from './middleware/auth';
import path from 'path';

dotenv.config();

const app = express();
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

// Servir arquivos estáticos da galeria de uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'front-end', 'public', 'uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', authenticateToken, usersRouter);
app.use('/api/chat', authenticateToken, chatRouter);
app.use('/api/media', authenticateToken, mediaRouter);
app.use('/api/projects', authenticateToken, projectRouter);
app.use('/api/export', authenticateToken, exportRouter);
app.use('/api/ai', authenticateToken, aiRouter);
app.use('/api/leads', authenticateToken, leadsRouter);
app.use('/api/crawler', authenticateToken, crawlerRouter);
app.use('/api/ngrok', authenticateToken, ngrokRouter);
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
    // Broadcast or send to specific recipient room
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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 BUILD DREAMER - BACKEND INICIADO COM SUCESSO!`);
  console.log(`========================================================`);
  console.log(`📡 Porta interna do Backend: ${PORT}`);
  console.log(`🔗 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`🤖 Fila de Jobs IA: Ativa`);
  console.log(`========================================================\n`);
});
