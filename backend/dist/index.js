"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const auth_1 = require("./routes/auth");
const projects_1 = require("./routes/projects");
const pages_1 = require("./routes/pages");
const ai_1 = require("./routes/ai");
const export_1 = require("./routes/export");
const auth_2 = require("./middleware/auth");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
app.use((0, morgan_1.default)('dev'));
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.authRouter);
app.use('/api/projects', auth_2.authenticateToken, projects_1.projectRouter);
app.use('/api/export', auth_2.authenticateToken, export_1.exportRouter);
app.use('/api/ai', auth_2.authenticateToken, ai_1.aiRouter);
app.use('/api', auth_2.authenticateToken, pages_1.pageRouter);
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
app.get('/ready', (req, res) => {
    res.json({ status: 'READY' });
});
// WebSocket Connection
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
