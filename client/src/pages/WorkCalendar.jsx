// WorkCalendar.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaCalendarAlt,
  FaSearch,
  FaPlus,
  FaTrash,
  FaUserPlus,
  FaCheck,
  FaTimes,
  FaSave,
  FaBriefcase,
  FaExclamationTriangle,
  FaArrowLeft,
  FaArrowRight,
  FaPen,
  FaTasks,
  FaUser,
  FaBed,
  FaChevronLeft,
  FaEye,
  FaPencilAlt,
  FaRegCalendarAlt,
  FaUserSlash,
  FaLock,
} from "react-icons/fa";
import { useAuth } from "../context/AuthProvider";

/* ---------------- helpers ---------------- */

const pad2 = (n) => String(n).padStart(2, "0");

const formatDateToYYYYMMDD = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().split("T")[0];
};

const formatDateToDDMMYYYY = (date) => {
  const d = new Date(date);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const addDays = (date, days) => {
  const r = new Date(date);
  r.setDate(r.getDate() + days);
  return r;
};

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isDesktop;
};

const isDateInPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return target < today;
};

async function apiFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "include", // cookie auth
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- UI components ---------------- */

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
  disabledItems = [],
  error,
  showInitialList = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search && !showInitialList) return [];
    const s = search.toLowerCase();
    let count = 0;

    return options.filter((opt) => {
      if (count > 50) return false;

      const isDisabled = disabledItems.includes(opt.value);

      const matches =
        !search ||
        opt.label.toLowerCase().includes(s) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(s));

      if (!isDisabled && matches) {
        count++;
        return true;
      }
      return false;
    });
  }, [options, search, disabledItems, showInitialList]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full flex items-center justify-between bg-white border rounded-xl px-4 py-3 text-sm font-medium text-gray-700 shadow-sm active:bg-gray-50 transition-all ${
          error ? "border-red-500 ring-1 ring-red-500" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon className={`flex-shrink-0 ${error ? "text-red-500" : "text-indigo-500"}`} />}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-gray-400">{placeholder}</span>}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-2.5 text-gray-400 text-xs" />
                  <input
                    ref={inputRef}
                    type="text"
                    // ✅ iOS zoom fix: 16px on mobile
                    className="w-full pl-8 pr-3 py-2 bg-white rounded-lg text-[16px] sm:text-sm outline-none border border-gray-200 focus:border-indigo-300 transition-all"
                    placeholder={showInitialList ? "Пошук..." : "Введіть для пошуку..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <div className="font-medium text-gray-800">{opt.label}</div>
                      {opt.subLabel && <div className="text-[10px] text-gray-400">{opt.subLabel}</div>}
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400 italic">
                    {!search && !showInitialList ? "Введіть текст для пошуку..." : "Нічого не знайдено"}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {error && <p className="text-red-500 text-xs mt-1 ml-1">{error}</p>}
    </div>
  );
};

const QuickAbsenceAdder = ({ employees, onAdd }) => {
  const [selectedEmp, setSelectedEmp] = useState("");
  const [status, setStatus] = useState("OFF");

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e.custom_id,
        label: e.name,
        subLabel: e.position || "",
      })),
    [employees]
  );

  const handleAdd = () => {
    if (!selectedEmp) return;
    onAdd(selectedEmp, status);
    setSelectedEmp("");
  };

  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        <FaUserSlash /> Відмітити відсутність
      </h4>

      <div className="space-y-2">
        <SearchableSelect
          options={employeeOptions}
          value={selectedEmp}
          onChange={setSelectedEmp}
          placeholder="Введіть ім'я працівника..."
          icon={FaUser}
          showInitialList={true}
        />

        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            // ✅ iOS zoom fix: 16px on mobile
            className="flex-1 bg-white border border-red-200 text-red-700 text-[16px] sm:text-sm rounded-lg px-3 py-2 outline-none"
          >
            <option value="OFF">Вихідний</option>
            <option value="SICK_LEAVE">Лікарняний</option>
            <option value="VACATION">Відпустка</option>
          </select>

          <button
            onClick={handleAdd}
            disabled={!selectedEmp}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50"
            title="Додати відсутність"
          >
            <FaCheck />
          </button>
        </div>
      </div>
    </div>
  );
};

const AbsentEmployeesList = ({ employees, canManageSchedule, isPast, onCancelAbsence }) => {
  if (!employees || employees.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <FaBed /> Відсутні ({employees.length})
      </h4>

      <div className="space-y-2">
        {employees.map((emp) => (
          <div
            key={emp.custom_id}
            className="flex justify-between items-center text-sm p-2 bg-white rounded-lg text-red-700 border border-red-100 shadow-sm"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{emp.name}</div>
              <div className="text-[10px] text-gray-400 truncate">{emp.position || ""}</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 rounded-md text-red-500 border border-red-100 uppercase">
                {emp.status === "OFF" ? "Вихідний" : emp.status === "VACATION" ? "Відпустка" : "Лікарняний"}
              </span>

              {canManageSchedule && !isPast && (
                <button
                  onClick={() => onCancelAbsence(emp.custom_id)}
                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
                  title="Скасувати відсутність (is_cancelled=true)"
                >
                  Скасувати
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SchedulePreview = ({
  schedule,
  isPreviewMode,
  onEdit,
  onSave,
  onClose,
  isSaving,
  absentEmployees,
  isPast,
  canManageSchedule,
  onCancelAbsence,

  // ✅ optimized maps
  employeeById,
  installationById,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 border-b flex items-center justify-between bg-white rounded-t-2xl shadow-sm z-20 flex-none">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
          {isPreviewMode ? "Попередній перегляд" : "План робіт"}
          {isPast && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full flex items-center gap-1">
              <FaLock size={10} /> Архів
            </span>
          )}
        </h3>

        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-800">
          <FaTimes />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {schedule.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FaCalendarAlt className="mx-auto text-4xl mb-3 opacity-20" />
            <p>Немає запланованих робіт</p>
          </div>
        ) : (
          schedule.map((item) => {
            const isCustom = item.installationId === "custom";

            const inst = !isCustom && item.installationId != null ? installationById.get(String(item.installationId)) : null;

            const instName = isCustom
              ? item.notes || "Кастомне завдання"
              : item.installationId
              ? inst?.name || `Об'єкт #${item.installationId}`
              : "Не обрано";

            const displayId = !isCustom && item.installationId ? `#${item.installationId}` : "";

            return (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-start gap-3 mb-3 border-b border-gray-100 pb-3">
                  <div className={`p-2 rounded-lg ${isCustom ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
                    {isCustom ? <FaTasks /> : <FaBriefcase />}
                  </div>

                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm">
                      {instName} <span className="text-gray-400 font-normal ml-1">{displayId}</span>
                    </h4>
                    {isCustom && <span className="text-xs text-amber-500 font-medium">Ручне завдання</span>}
                  </div>
                </div>

                {item.notes && !isCustom && (
                  <div className="mb-3 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg italic">"{item.notes}"</div>
                )}

                <div className="space-y-2">
                  {item.workers.length === 0 && <p className="text-xs text-red-400 italic">Працівників не призначено</p>}

                  {item.workers.map((wId) => {
                    const emp = employeeById.get(wId);
                    return (
                      <div key={wId} className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                          {emp?.name?.charAt(0)}
                        </div>
                        <span className="text-gray-700 font-medium">{emp?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        <AbsentEmployeesList
          employees={absentEmployees}
          canManageSchedule={canManageSchedule}
          isPast={isPast}
          onCancelAbsence={onCancelAbsence}
        />
      </div>

      <div className="p-4 border-t bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] space-y-3 flex-none">
        {isPreviewMode ? (
          <>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? "Збереження..." : (
                <>
                  <FaSave /> Зберегти зміни
                </>
              )}
            </button>

            <button
              onClick={onEdit}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Повернутись до редагування
            </button>
          </>
        ) : !isPast && canManageSchedule ? (
          <button
            onClick={onEdit}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <FaPencilAlt /> Редагувати план
          </button>
        ) : (
          <div className="text-center text-gray-400 text-sm py-2 flex items-center justify-center gap-2">
            {isPast ? (
              <>
                <FaLock /> Редагування минулих періодів заборонено
              </>
            ) : (
              <span className="italic">Тільки для перегляду</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------------- main component ---------------- */

export default function WorkCalendar() {
  const { role } = useAuth();

  const isDesktop = useIsDesktop();

  const [canManageSchedule, setCanManageSchedule] = useState(false);
  const [authError, setAuthError] = useState(null);

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    if (day === 0) return getStartOfWeek(addDays(today, 1));
    return getStartOfWeek(today);
  });

  const weekDays = useMemo(
    () => Array.from({ length: 6 }).map((_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  );

  const [installations, setInstallations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignmentsByDate, setAssignmentsByDate] = useState({});
  const [timeOffMap, setTimeOffMap] = useState({}); // тільки активні (is_cancelled=false), бек так віддає

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingDate, setEditingDate] = useState(null);
  const [dayAssignments, setDayAssignments] = useState([]);
  const [modalMode, setModalMode] = useState("view");
  const [validationErrors, setValidationErrors] = useState({});
  const [isPastDate, setIsPastDate] = useState(false);

  const todayRef = useRef(null);
  const dateInputRef = useRef(null);

  // ✅ optimized maps (no more repeated .find in renders)
  const installationById = useMemo(() => {
    const m = new Map();
    (installations || []).forEach((i) => {
      if (i?.custom_id != null) m.set(String(i.custom_id), i);
    });
    return m;
  }, [installations]);

  const employeeById = useMemo(() => {
    const m = new Map();
    (employees || []).forEach((e) => {
      if (e?.custom_id != null) m.set(e.custom_id, e);
    });
    return m;
  }, [employees]);

  const triggerDatePicker = () => {
    try {
      if (!dateInputRef.current) return;
      if (dateInputRef.current.showPicker) dateInputRef.current.showPicker();
      else {
        dateInputRef.current.focus();
        dateInputRef.current.click();
      }
    } catch (e) {
      console.error("Error opening date picker:", e);
    }
  };

  const handleJumpToDate = (e) => {
    const date = new Date(e.target.value);
    if (!isNaN(date)) setCurrentWeekStart(getStartOfWeek(date));
  };

  const loadWeekData = useCallback(async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const startStr = formatDateToYYYYMMDD(currentWeekStart);
      const data = await apiFetch(`/api/work-calendar/week?start=${startStr}`);

      setCanManageSchedule(!!data.canManageSchedule);
      setInstallations(data.installations || []);
      setEmployees(data.employees || []);
      setTimeOffMap(data.timeOffMap || {});
      setAssignmentsByDate(data.assignmentsByDate || {});
    } catch (e) {
      if (e.status === 401) {
        setAuthError("Не авторизовано (нема активної сесії).");
      } else {
        setAuthError("Помилка завантаження: " + e.message);
      }
      const uiCan = role === "admin" || role === "super_admin" || role === "office";
      setCanManageSchedule(uiCan);
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart, role]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [loading, currentWeekStart]);

  const openDayEditor = (date) => {
    const past = isDateInPast(date);
    setIsPastDate(past);

    const dateStr = formatDateToYYYYMMDD(date);
    const existing = assignmentsByDate[dateStr] ? JSON.parse(JSON.stringify(assignmentsByDate[dateStr])) : [];

    setDayAssignments(existing);
    setEditingDate(date);
    setValidationErrors({});

    if (!canManageSchedule || past) {
      setModalMode("view");
    } else if (existing.length === 0) {
      setDayAssignments([{ id: Date.now(), installationId: null, workers: [], notes: "" }]);
      setModalMode("edit");
    } else {
      setModalMode("view");
    }
  };

  const closeDayEditor = () => {
    setEditingDate(null);
    setDayAssignments([]);
    setModalMode("view");
    setValidationErrors({});
    setIsPastDate(false);
  };

  const getAbsentEmployees = () => {
    if (!editingDate) return [];
    const dateStr = formatDateToYYYYMMDD(editingDate);
    const dayOffs = timeOffMap[dateStr] || {};
    return employees
      .filter((emp) => Object.prototype.hasOwnProperty.call(dayOffs, emp.custom_id))
      .map((emp) => ({ ...emp, status: dayOffs[emp.custom_id] }));
  };

  const getAvailableEmployees = (currentIdx) => {
    const assignedElsewhere = new Set();
    const assignedInCurrent = new Set();

    dayAssignments.forEach((assign, idx) => {
      if (idx !== currentIdx) assign.workers.forEach((wId) => assignedElsewhere.add(wId));
      else assign.workers.forEach((wId) => assignedInCurrent.add(wId));
    });

    const dateStr = formatDateToYYYYMMDD(editingDate);
    const dayOffs = timeOffMap[dateStr] || {};

    return employees
      .filter((emp) => {
        if (Object.prototype.hasOwnProperty.call(dayOffs, emp.custom_id)) return false;
        if (assignedElsewhere.has(emp.custom_id)) return false;
        if (assignedInCurrent.has(emp.custom_id)) return false;
        return true;
      })
      .map((emp) => ({
        value: emp.custom_id,
        label: emp.name,
        subLabel: emp.position || "",
      }));
  };

  const addCard = () =>
    setDayAssignments((prev) => [...prev, { id: Date.now(), installationId: null, workers: [], notes: "" }]);

  const removeCard = (idx) => {
    setDayAssignments((prev) => prev.filter((_, i) => i !== idx));
    setValidationErrors({});
  };

  const updateCard = (idx, field, val) => {
    setDayAssignments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };

      if (field === "installationId" && val === "custom") {
        if (!next[idx].notes) next[idx].notes = "";
      }
      return next;
    });

    setValidationErrors((prev) => {
      if (!prev[idx] || !prev[idx][field]) return prev;
      return { ...prev, [idx]: { ...prev[idx], [field]: null } };
    });
  };

  const addWorker = (idx, wId) => {
    setDayAssignments((prev) => {
      const next = [...prev];
      const workers = new Set(next[idx].workers);
      workers.add(wId);
      next[idx] = { ...next[idx], workers: Array.from(workers) };
      return next;
    });

    setValidationErrors((prev) => {
      if (!prev[idx]?.workers) return prev;
      return { ...prev, [idx]: { ...prev[idx], workers: null } };
    });
  };

  const removeWorker = (idx, wId) => {
    setDayAssignments((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], workers: next[idx].workers.filter((id) => id !== wId) };
      return next;
    });
  };

  const handleQuickAbsence = async (empId, status) => {
    if (!editingDate) return;
    const dateStr = formatDateToYYYYMMDD(editingDate);

    try {
      await apiFetch("/api/work-calendar/day/absence", {
        method: "POST",
        body: { date: dateStr, employee_custom_id: empId, status },
      });

      setTimeOffMap((prev) => ({
        ...prev,
        [dateStr]: { ...(prev[dateStr] || {}), [empId]: status },
      }));

      setDayAssignments((prev) => prev.map((a) => ({ ...a, workers: a.workers.filter((w) => w !== empId) })));
    } catch (e) {
      alert("Помилка: " + e.message);
    }
  };

  const handleCancelAbsence = async (empId) => {
    if (!editingDate) return;
    const dateStr = formatDateToYYYYMMDD(editingDate);

    try {
      await apiFetch("/api/work-calendar/day/absence/cancel", {
        method: "POST",
        body: { date: dateStr, employee_custom_id: empId },
      });

      setTimeOffMap((prev) => {
        const day = { ...(prev[dateStr] || {}) };
        delete day[empId];
        return { ...prev, [dateStr]: day };
      });
    } catch (e) {
      alert("Помилка скасування: " + e.message);
    }
  };

  const handleSwitchToPreview = () => {
    const errors = {};
    let hasError = false;

    dayAssignments.forEach((assign, idx) => {
      if (!assign.installationId) {
        errors[idx] = errors[idx] || {};
        errors[idx].installationId = "Оберіть об'єкт або завдання";
        hasError = true;
      }
      if (assign.installationId === "custom" && !assign.notes.trim()) {
        errors[idx] = errors[idx] || {};
        errors[idx].notes = "Введіть назву завдання";
        hasError = true;
      }
      if (assign.installationId && assign.workers.length === 0) {
        errors[idx] = errors[idx] || {};
        errors[idx].workers = "Додайте працівників";
        hasError = true;
      }
    });

    if (hasError) {
      setValidationErrors(errors);
      return;
    }
    setModalMode("preview");
  };

  const handleSaveDay = async () => {
    if (isPastDate) {
      alert("Неможливо зберегти зміни для минулої дати.");
      return;
    }

    setSaving(true);
    const dateStr = formatDateToYYYYMMDD(editingDate);

    try {
      await apiFetch("/api/work-calendar/day/save", {
        method: "POST",
        body: { date: dateStr, assignments: dayAssignments },
      });

      await loadWeekData();
      closeDayEditor();
    } catch (e) {
      alert("Помилка: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const installationOptions = useMemo(() => {
    const base = installations.map((inst) => ({
      value: inst.custom_id,
      label: `${inst.name} (#${inst.custom_id})`,
      subLabel: `ID: ${inst.custom_id}`,
    }));
    return [{ value: "custom", label: "⚡ Інше / Створити вручну", subLabel: "Для робіт поза базою" }, ...base];
  }, [installations]);

  const absentEmployees = getAbsentEmployees();

  const employeesAvailableForAbsence = useMemo(() => {
    if (!editingDate) return [];
    const dateStr = formatDateToYYYYMMDD(editingDate);
    const dayOffs = timeOffMap[dateStr] || {};
    return employees.filter((e) => !Object.prototype.hasOwnProperty.call(dayOffs, e.custom_id));
  }, [employees, timeOffMap, editingDate]);

  const todayStr = useMemo(() => formatDateToYYYYMMDD(new Date()), []);

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <div className="max-w-7xl mx-auto px-4 pt-5">
        <h1 className="text-xl font-extrabold text-gray-900">Розклад робіт</h1>
        {authError && (
          <div className="mt-3 text-xs bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2">
            {authError}
          </div>
        )}
      </div>

      <div className="bg-white relative z-30 shadow-sm border-b border-gray-200 mt-4">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setCurrentWeekStart((d) => addDays(d, -7))}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
            title="Попередній тиждень"
          >
            <FaArrowLeft />
          </button>

          <div className="flex-1 flex justify-center">
            <div
              onClick={triggerDatePicker}
              className="relative group cursor-pointer px-4 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
              title="Перейти до дати"
            >
              <input ref={dateInputRef} type="date" onChange={handleJumpToDate} className="absolute top-0 left-0 w-0 h-0 opacity-0" />
              <div className="text-center">
                <h2 className="text-base font-bold text-gray-800 flex items-center justify-center gap-2 group-hover:text-indigo-600 transition-colors">
                  <FaRegCalendarAlt className="text-indigo-500" />
                  <span className="whitespace-nowrap">
                    {formatDateToDDMMYYYY(weekDays[0])} — {formatDateToDDMMYYYY(weekDays[5])}
                  </span>
                </h2>
              </div>
            </div>
          </div>

          <button
            onClick={() => setCurrentWeekStart((d) => addDays(d, 7))}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
            title="Наступний тиждень"
          >
            <FaArrowRight />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-2 sm:p-4 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 min-w-[300px]">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[120px] bg-white rounded-xl border border-gray-100 p-3 flex flex-col gap-2 animate-pulse"
              >
                <div className="h-4 w-10 bg-gray-200 rounded"></div>
                <div className="h-6 w-full bg-gray-100 rounded-lg mt-2"></div>
              </div>
            ))
          ) : (
            weekDays.map((date) => {
              const dateStr = formatDateToYYYYMMDD(date);
              const isToday = dateStr === todayStr;
              const dayTasks = assignmentsByDate[dateStr] || [];
              const dayOffsCount = Object.keys(timeOffMap[dateStr] || {}).length;
              const past = isDateInPast(date);

              return (
                <div
                  key={dateStr}
                  ref={isToday ? todayRef : null}
                  onClick={() => openDayEditor(date)}
                  className={`
                    min-h-[120px] bg-white rounded-xl border p-3 flex flex-col gap-2 cursor-pointer transition-all active:scale-[0.98] hover:shadow-md
                    ${isToday ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-200 hover:border-indigo-300"}
                  `}
                >
                  <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                    <span className={`text-sm font-bold ${isToday ? "text-indigo-600" : "text-gray-700"}`}>
                      {date.toLocaleDateString("uk-UA", { weekday: "short" }).toUpperCase()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isToday ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  <div className="flex-1 space-y-1.5 overflow-hidden">
                    {dayTasks.length > 0 ? (
                      dayTasks.map((task, i) => {
                        const isCustom = task.installationId === "custom";
                        const inst = !isCustom && task.installationId != null ? installationById.get(String(task.installationId)) : null;

                        const instName = isCustom
                          ? task.notes || "Без назви"
                          : task.installationId
                          ? inst?.name || `Об'єкт #${task.installationId}`
                          : "Завантаження...";

                        return (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1.5 rounded-lg font-medium ${
                              isCustom ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isCustom ? <FaTasks size={10} /> : <FaBriefcase size={10} />}
                              <span className="truncate">{instName}</span>
                              <span className="opacity-60 ml-auto text-[10px] flex-shrink-0">{task.workers.length}</span>
                            </div>

                            {!isCustom && task.notes && (
                              <div className="text-[10px] opacity-70 truncate mt-0.5">{task.notes}</div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      canManageSchedule &&
                      !past && (
                        <div className="h-full flex items-center justify-center text-gray-300 text-xs" title="Додати план">
                          <FaPlus />
                        </div>
                      )
                    )}
                  </div>

                  {dayOffsCount > 0 && (
                    <div className="mt-auto pt-2 text-[10px] text-red-400 font-medium flex items-center gap-1">
                      <FaExclamationTriangle size={10} /> {dayOffsCount} відсутні
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 flex justify-center items-end md:justify-end md:items-start"
            onClick={closeDayEditor}
          >
            <motion.div
              initial={isDesktop ? { x: "100%" } : { y: "100%" }}
              animate={isDesktop ? { x: 0 } : { y: 0 }}
              exit={isDesktop ? { x: "100%" } : { y: "100%" }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
              className="bg-white w-full h-[100dvh] md:h-full md:w-[600px] shadow-2xl flex flex-col rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
              onClick={(e) => e.stopPropagation()}
            >
              {(modalMode === "view" || modalMode === "preview") && (
                <SchedulePreview
                  schedule={dayAssignments}
                  isPreviewMode={modalMode === "preview"}
                  onEdit={() => setModalMode("edit")}
                  onSave={handleSaveDay}
                  onClose={closeDayEditor}
                  isSaving={saving}
                  absentEmployees={absentEmployees}
                  isPast={isPastDate}
                  canManageSchedule={canManageSchedule}
                  onCancelAbsence={handleCancelAbsence}
                  employeeById={employeeById}
                  installationById={installationById}
                />
              )}

              {modalMode === "edit" && canManageSchedule && (
                <>
                  <div className="p-4 border-b flex items-center justify-between bg-white z-20 rounded-t-2xl md:rounded-tl-2xl flex-none shadow-sm">
                    <button
                      onClick={closeDayEditor}
                      className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full md:hidden"
                      title="Назад"
                    >
                      <FaChevronLeft size={20} />
                    </button>

                    <div className="text-center flex-1 md:text-left md:flex-none">
                      <h3 className="font-bold text-lg text-gray-800">{formatDateToDDMMYYYY(editingDate)}</h3>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">Редагування</p>
                    </div>

                    <button
                      onClick={closeDayEditor}
                      className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 shadow-sm hidden md:block"
                      title="Закрити"
                    >
                      <FaTimes />
                    </button>

                    <div className="w-10 md:hidden"></div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-6">
                    <div className="space-y-4">
                      {dayAssignments.map((assign, idx) => (
                        <div
                          key={assign.id}
                          className={`bg-white p-4 rounded-xl shadow-sm border relative ${
                            validationErrors[idx] ? "border-red-300 ring-1 ring-red-100" : "border-gray-200"
                          }`}
                        >
                          <button
                            onClick={() => removeCard(idx)}
                            className="absolute top-2 right-2 text-gray-300 hover:text-red-500 p-2"
                            title="Видалити завдання"
                          >
                            <FaTrash size={14} />
                          </button>

                          <div className="mb-3 pr-6">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                              Завдання #{idx + 1}
                            </label>

                            <SearchableSelect
                              options={installationOptions}
                              value={assign.installationId}
                              onChange={(val) => updateCard(idx, "installationId", val)}
                              placeholder="Оберіть об'єкт..."
                              icon={FaBriefcase}
                              error={validationErrors[idx]?.installationId}
                              showInitialList={true}
                            />
                          </div>

                          {assign.installationId === "custom" && (
                            <div className="mb-3">
                              <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1 block flex items-center gap-1">
                                <FaPen size={10} /> Назва завдання
                              </label>

                              <input
                                type="text"
                                placeholder="Наприклад: Прибирання складу..."
                                value={assign.notes}
                                onChange={(e) => updateCard(idx, "notes", e.target.value)}
                                // ✅ iOS zoom fix: 16px on mobile
                                className={`w-full border rounded-lg px-3 py-2 text-[16px] sm:text-sm focus:ring-2 outline-none ${
                                  validationErrors[idx]?.notes
                                    ? "border-red-500 ring-red-100"
                                    : "border-amber-200 bg-amber-50/50 focus:ring-amber-200"
                                }`}
                                autoFocus
                              />

                              {validationErrors[idx]?.notes && (
                                <p className="text-red-500 text-xs mt-1">{validationErrors[idx].notes}</p>
                              )}
                            </div>
                          )}

                          {assign.installationId && assign.installationId !== "custom" && (
                            <div className="mb-3">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                                Коментар до виїзду
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Напр.: Заїхати ще на заміри — адреса..., зателефонувати..., уточнити..."
                                value={assign.notes || ""}
                                onChange={(e) => updateCard(idx, "notes", e.target.value)}
                                // ✅ iOS zoom fix: 16px on mobile
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-[16px] sm:text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                              />
                            </div>
                          )}

                          {assign.installationId && (
                            <div>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {assign.workers.map((wId) => {
                                  const emp = employeeById.get(wId);
                                  return (
                                    <span
                                      key={wId}
                                      className="inline-flex items-center gap-2 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100"
                                    >
                                      <FaUser size={10} /> {emp?.name || wId}
                                      <button
                                        onClick={() => removeWorker(idx, wId)}
                                        className="text-indigo-300 hover:text-red-500"
                                        title="Прибрати"
                                      >
                                        <FaTimes size={10} />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>

                              <SearchableSelect
                                options={getAvailableEmployees(idx)}
                                onChange={(val) => addWorker(idx, val)}
                                placeholder="Додати працівника..."
                                icon={FaUserPlus}
                                value={null}
                                showInitialList={true}
                              />

                              {validationErrors[idx]?.workers && (
                                <p className="text-red-500 text-xs mt-1">{validationErrors[idx].workers}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={addCard}
                        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <FaPlus /> Додати ще завдання
                      </button>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <QuickAbsenceAdder employees={employeesAvailableForAbsence} onAdd={handleQuickAbsence} />
                      <AbsentEmployeesList
                        employees={absentEmployees}
                        canManageSchedule={canManageSchedule}
                        isPast={isPastDate}
                        onCancelAbsence={handleCancelAbsence}
                      />
                    </div>
                  </div>

                  <div className="p-4 border-t bg-white sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-b-none md:rounded-b-2xl flex-none">
                    <button
                      onClick={handleSwitchToPreview}
                      className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-lg hover:bg-indigo-700"
                    >
                      <FaEye /> Попередній перегляд
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
