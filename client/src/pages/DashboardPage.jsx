import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api/http";

import {
  FaHardHat,
  FaMapMarkedAlt,
  FaUsers,
  FaTasks,
  FaCalendarDay,
  FaArrowRight,
  FaCheckCircle,
  FaExclamationCircle,
  FaHome,
} from "react-icons/fa";

function formatDateUA(date) {
  try {
    return new Date(date).toLocaleDateString("uk-UA");
  } catch {
    return "";
  }
}

function attendanceLabel(status) {
  switch (status) {
    case "WORKED":
      return { text: "Працюю", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "OFF":
      return { text: "Вихідний", pill: "bg-slate-50 text-slate-700 border-slate-200" };
    case "VACATION":
      return { text: "Відпустка", pill: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "SICK_LEAVE":
      return { text: "Лікарняний", pill: "bg-red-50 text-red-700 border-red-200" };
    default:
      return { text: "Невідомо", pill: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

function dayOffText(status) {
  switch (status) {
    case "OFF":
      return "Сьогодні вихідний";
    case "VACATION":
      return "Сьогодні відпустка";
    case "SICK_LEAVE":
      return "Сьогодні лікарняний";
    default:
      return "Сьогодні вільний день";
  }
}

function openMaps({ gps_link, latitude, longitude }) {
  if (gps_link && typeof gps_link === "string" && gps_link.trim()) {
    window.open(gps_link, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof latitude === "number" && typeof longitude === "number") {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const SectionCard = ({ title, icon: Icon, right, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
    <div className="p-4 sm:p-5 border-b border-slate-50 bg-slate-50/40">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
          {Icon ? <Icon className="text-indigo-600" /> : null}
          {title}
        </h3>
        {right}
      </div>
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </div>
);

const CoworkerCard = ({ p }) => (
  <div className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
    <div className="text-xs font-bold text-slate-800 whitespace-nowrap">{p.name}</div>
    <div className="text-[10px] text-slate-500 whitespace-nowrap">{p.position || "Працівник"}</div>
  </div>
);

const TaskRow = ({ t, onOpen }) => {
  const due = t?.due_date ? new Date(t.due_date) : null;
  const isOverdue = due ? due < new Date(new Date().toDateString()) : false;

  return (
    <button
      onClick={onOpen}
      className={`w-full text-left p-3 rounded-xl border-l-4 flex gap-3 mb-2 transition-colors
        ${isOverdue ? "border-red-500 bg-red-50 hover:bg-red-100" : "border-orange-400 bg-orange-50 hover:bg-orange-100"}
      `}
    >
      <div className={`mt-1 shrink-0 ${isOverdue ? "text-red-500" : "text-orange-500"}`}>
        <FaTasks />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
          {t.task_text}
        </p>

        <div className="flex justify-between items-end mt-1 gap-2">
          <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded text-slate-600 truncate max-w-[60%] border border-black/5">
            {t.installation_name ? t.installation_name : "Без прив’язки до об’єкта"}
          </span>

          {due ? (
            <span className={`text-[10px] font-bold flex items-center gap-1 ${isOverdue ? "text-red-600" : "text-orange-600"}`}>
              <FaCalendarDay size={10} />
              {isOverdue ? "Прострочено" : formatDateUA(t.due_date)}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Без дедлайну</span>
          )}
        </div>
      </div>
    </button>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);

  const todayStr = useMemo(() => new Date().toLocaleDateString("uk-UA"), []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const data = await apiGet("/api/dashboard");
        if (mounted) setDashboard(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Помилка завантаження");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const todayMeta = dashboard?.today || {};
  const attendance = attendanceLabel(todayMeta.attendanceStatus);
  const isDayOffActive = !!todayMeta.isDayOffActive;

  const todayInstallation = dashboard?.todayInstallation || null;
  const tasks = dashboard?.tasksPreview || [];

  const isManual = todayInstallation?.type === "MANUAL";

  const canOpenRoute =
    !isManual &&
    !!todayInstallation &&
    ((typeof todayInstallation.gps_link === "string" && todayInstallation.gps_link.trim()) ||
      (typeof todayInstallation.latitude === "number" && typeof todayInstallation.longitude === "number"));

  const goToProjectDetails = () => {
    // ВАЖЛИВО: тут ми використовуємо installation_custom_id як :id
    // Якщо у тебе ProjectDetailsPage очікує інший id — просто заміниш тут.
    if (!todayInstallation?.installation_custom_id) return;
    navigate(`/project/${todayInstallation.installation_custom_id}`);
  };

  return (
    <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-w-[980px] mx-auto pb-safe">
      {/* Header (без “привіт” і БЕЗ статус-пілу) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FaHome className="text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">
              Робота сьогодні
            </h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Оперативний стан на {todayStr}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-lg text-sm font-medium shadow-sm flex items-start gap-2">
          <FaExclamationCircle className="mt-0.5" />
          <div className="min-w-0">
            <div className="font-bold">Не вдалося завантажити Home</div>
            <div className="text-xs opacity-90 break-words">{error}</div>
            <div className="mt-2">
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-bold text-red-700 underline underline-offset-2 hover:opacity-80"
              >
                Оновити сторінку
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-slate-500">
          Завантаження...
        </div>
      ) : (
        <>
          {/* 1) Де я працюю сьогодні */}
          <SectionCard
            title="Де я працюю сьогодні"
            icon={FaHardHat}
            right={
              todayInstallation?.hasMoreToday ? (
                <button
                  onClick={() => navigate("/installations")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Ще записи ({todayInstallation.todayCount}) <FaArrowRight />
                </button>
              ) : null
            }
          >
            {/* Якщо активний вихідний/відпустка/лікарняний (НЕ скасовано) — показуємо це тут */}
            {isDayOffActive ? (
              <div className={`p-4 rounded-2xl border shadow-sm ${attendance.pill}`}>
                <div className="text-sm font-bold">{dayOffText(todayMeta.attendanceStatus)}</div>
              </div>
            ) : todayInstallation ? (
              <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* Назва:
                        - якщо це INSTALLATION: клікабельна і веде на /project/:id
                        - якщо MANUAL: просто текст (бо id нема) */}
                    {isManual ? (
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {todayInstallation.installation_name || "Завдання"}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={goToProjectDetails}
                        className="text-sm font-bold text-slate-800 truncate hover:underline underline-offset-2 text-left"
                        title="Відкрити детальну інформацію"
                      >
                        {todayInstallation.installation_name || "Об’єкт"}
                        <span className="text-slate-400 font-normal text-xs">
                          {" "}
                          #{todayInstallation.installation_custom_id}
                        </span>
                      </button>
                    )}

                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {isManual
                        ? "Ручне призначення"
                        : (todayInstallation.client_place || "Локація не вказана")}
                    </p>
                  </div>

                  {/* Маршрут тільки для реального об’єкта, і тільки якщо є gps/lat/lng */}
                  {canOpenRoute ? (
                    <button
                      onClick={() => openMaps(todayInstallation)}
                      className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <FaMapMarkedAlt />
                      Маршрут
                    </button>
                  ) : null}
                </div>

                {/* Коментар до виконання (installation_workers.notes) */}
                {!isManual && todayInstallation?.notes ? (
                  <div className="mt-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-700 mb-1">Коментар до виконання</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">
                      {todayInstallation.notes}
                    </p>
                  </div>
                ) : null}

                {/* Команда */}
                {!isManual ? (
                  <div className="mt-4">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
                      <FaUsers className="text-slate-400" /> З ким працюю
                    </p>

                    {Array.isArray(todayInstallation.coworkers) && todayInstallation.coworkers.length ? (
                      <div className="flex gap-2 overflow-x-auto pb-1 pr-1">
                        {todayInstallation.coworkers.map((p) => (
                          <CoworkerCard key={p.employee_custom_id} p={p} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Команда не вказана</p>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl p-6">
                <FaCheckCircle className="mb-2 text-3xl opacity-20 text-emerald-500" />
                <p className="text-sm font-medium">На сьогодні записів немає</p>
                <p className="text-xs mt-1">Перевір “Об’єкти” або задачі</p>
              </div>
            )}
          </SectionCard>

          {/* 2) Задачі */}
          <SectionCard
            title="Задачі"
            icon={FaTasks}
            right={
              <button
                onClick={() => navigate("/tasks")}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                Всі задачі <FaArrowRight />
              </button>
            }
          >
            {tasks.length ? (
              <div className="max-h-[360px] overflow-y-auto pr-1">
                {tasks.map((t) => (
                  <TaskRow key={t.custom_id} t={t} onOpen={() => navigate("/tasks")} />
                ))}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">Поки немає активних задач 🎯</div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
