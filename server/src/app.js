import express from "express";
import cookieParser from "cookie-parser"; // <--- ОБОВ'ЯЗКОВО
import cors from "cors";                   // <--- ОБОВ'ЯЗКОВО
import authRoutes from "./routes/auth.js";
import dashboardRoutes from "./routes/dashboard.js";

const app = express();

// 1. Налаштування CORS
// Щоб куки ходили між localhost:3000 і localhost:5000,
// треба чітко вказати origin і credentials: true
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000", // Важливо: точно вказати адресу фронта
  credentials: true, // Дозволяє передавати куки
}));

// 2. JSON парсер
app.use(express.json());

// 3. Cookie парсер - САМЕ ЦЬОГО ВАМ НЕ ВИСТАЧАЛО
app.use(cookieParser()); 

// 4. Ваші роути
app.use("/api", authRoutes);
app.use("/api", dashboardRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));