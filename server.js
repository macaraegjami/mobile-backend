import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import fs from 'fs';
import morgan from 'morgan';
import { updateMaterialStatuses } from './utils/materialStatusUpdater.js';
import { updateOverdueStatus, checkUnclaimedRequests } from './utils/borrowUtils.js';

// -------------------- Setup __dirname --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------- Environment --------------------
dotenv.config();
import { getEnvironmentConfig } from './config/environment.js';
const config = getEnvironmentConfig();

// -------------------- Initialize app --------------------
const app = express();

// -------------------- Static files --------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- Logging --------------------
// Request logging (like Render dashboard)
app.use(morgan('combined'));

// Optional: Log requests to file
const logFile = path.join(__dirname, 'server.log');
function logToFile(message) {
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
}
app.use((req, res, next) => {
  logToFile(`${req.method} ${req.url} from ${req.ip}`);
  next();
});

// -------------------- Middleware --------------------
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true,
  responseOnLimit: 'File size exceeds the 5MB limit',
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
app.use((req, res, next) => {
  logToFile(`${req.method} ${req.url} from ${req.ip}`);
  next();
});


// -------------------- Routes --------------------
import authRoutes from './routes/auth.js';
import learnMatRoutes from './routes/learningmat.js';
import archiveRequestRoutes from './routes/archiveRequest.js';
import roomReservationRoutes from './routes/roomReservation.js';
import reserveRoutes from './routes/reserve.js';
import borrowRoutes from './routes/borrow.js';
import bookRatingRoutes from './routes/bookrating.js';
import userRoutes from './routes/users.js';
import notificationRoutes from './routes/notifications.js';
import attendanceRoutes from './routes/attendance.js';
import feedbackRoutes from './routes/feedback.js';
import suggestionRoutes from './routes/suggestion.js';
import bookmarkRoutes from './routes/bookmark.js';

app.use('/', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/learnmat', learnMatRoutes);
app.use('/api/archive-requests', archiveRequestRoutes);
app.use('/api/room-reservations', roomReservationRoutes);
app.use('/api/reserve-requests', reserveRoutes);
app.use('/api/borrow-requests', borrowRoutes);
app.use('/api/ratings', bookRatingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/suggestion', suggestionRoutes);
app.use('/api/bookmarks', bookmarkRoutes);

// -------------------- Database --------------------
mongoose.connect(config.mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.once('open', () => {
  console.log('🚀 MongoDB connection established');

  // Scheduled tasks
  setInterval(updateOverdueStatus, 60 * 60 * 1000);
  setInterval(updateMaterialStatuses, 60 * 60 * 1000);
  setInterval(checkUnclaimedRequests, 60 * 60 * 1000);

  // Run immediately on startup
  updateOverdueStatus();
  updateMaterialStatuses();
  checkUnclaimedRequests();
});

// -------------------- Error Handling --------------------
app.use((err, req, res, next) => {
  console.error(`❌ Error on ${req.method} ${req.url}:`, err.stack);
  logToFile(`ERROR ${req.method} ${req.url} - ${err.stack}`);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// -------------------- Server --------------------
const PORT = process.env.PORT || config.port || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`📍 Location: ${config.location}`);
  console.log(`🌐 Local IP: ${config.localIP}`);
  console.log(`🔗 API URL: ${config.apiUrl}`);
  console.log(`🗄️ MongoDB: ${config.mongoUri ? 'Configured' : 'Not configured'}`);
  console.log(`📧 Brevo API: ${config.brevoApiKey ? 'Configured' : 'Not configured'}`);
});

// -------------------- Export config --------------------
export { config };
