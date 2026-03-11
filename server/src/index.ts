import http from 'http';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import ticketRoutes from './routes/tickets';
import attachmentRoutes from './routes/attachments';
import userRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import dashboardTechRoutes from './routes/dashboardTech';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const app = express();
// 提高请求头大小限制，避免 431 Request Header Fields Too Large（如本地 Cookie 过多）
const server = http.createServer({ maxHeaderSize: 32768 }, app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'ITSM 工单系统 API', docs: '前端请访问 http://localhost:3000 ，接口在 /api 下' });
});

app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', attachmentRoutes);
app.use('/api/users', userRoutes);
// 技术人员仪表盘路由必须先于管理员 dashboard，否则 /api/dashboard/tech/* 会命中 requireRole('admin') 导致 403
app.use('/api/dashboard/tech', dashboardTechRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(errorHandler);

server.listen(config.port, () => {
  console.log(`ITSM server running at http://localhost:${config.port}`);
});
