import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import installationsRoutes from "./routes/installations.js";
import additionalInfoRoutes from "./routes/additionalInfo.js";
import workflowRouter from './routes/workflow.js';
import timeoffRoutes from "./routes/timeoff.routes.js"
import reportsRoutes from "./routes/reports.js"
import workCalendarRouter from "./routes/workCalendar.routes.js";
import microtasksRoutes from "./routes/microtasks.js"
import equipment2Router from "./routes/equipment2.routes.js";
import ocrRouter from "./routes/ocr.routes.js";
const app = express();
app.set("etag", false);
const PORT = process.env.PORT || 5000;

// 1. Налаштування CORS
// ВАЖЛИВО: origin має точно співпадати з адресою фронтенду
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://192.168.0.106:3000",
  ],
  credentials: true, // Це дозволяє браузеру відправляти нам куки
}));

// 2. Middleware
app.use(express.json());
app.use(cookieParser()); // Це перетворює заголовок Cookie в об'єкт req.cookies
app.use(additionalInfoRoutes);
app.use(express.json());

// 3. Маршрути
app.use("/api", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", installationsRoutes);
app.use('/api/workflow', workflowRouter);
app.use("/api/timeoff", timeoffRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/work-calendar", workCalendarRouter);
app.use('/api/microtasks', microtasksRoutes);
app.use("/api/equipment2", equipment2Router);
app.use("/api/ocr", ocrRouter);
// 4. Глобальна обробка помилок
app.use((err, req, res, next) => {
  console.error("Server Error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});