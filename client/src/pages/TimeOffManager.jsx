import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch,
  FaPlus,
  FaPlane,
  FaBed,
  FaNotesMedical,
  FaCalendarAlt,
  FaUser,
  FaCheck,
  FaChevronDown,
  FaChevronUp,
  FaTimes,
  FaListUl,
  FaArrowsAltH,
  FaArrowRight,
  FaCalendarDay,
  FaUndo
} from "react-icons/fa";

import { apiGet, apiPost, apiPatch } from "../api/http";
import { useAuth } from "../context/AuthProvider";

// --- HELPERS ---
const formatDateToYYYYMMDD = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const adjustedDate = new Date(d.getTime() - offset * 60 * 1000);
  return adjustedDate.toISOString().split("T")[0];
};

const getRelativeDateLabel = (dateStr) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = formatDateToYYYYMMDD(today);
  const tomorrowStr = formatDateToYYYYMMDD(tomorrow);

  if (dateStr === todayStr) return "Сьогодні";
  if (dateStr === tomorrowStr) return "Завтра";

  const target = new Date(dateStr);
  return target.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isDesktop;
};

// --- COMPONENTS ---
const SearchableSelect = ({ options, value, onChange, placeholder, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return options.filter((opt) => {
      const label = (opt.label ?? "").toLowerCase();
      const val = String(opt.value ?? "").toLowerCase();
      return label.includes(q) || val.includes(q);
    });
  }, [options, search]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === value) || null;
  }, [options, value]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-medium text-gray-700 shadow-sm active:bg-gray-50 transition-all touch-manipulation"
      >
        <span className="flex items-center gap-2 truncate">
          {Icon && <Icon className="text-indigo-500" />}
          <span className="truncate flex items-center gap-2">
            {selectedOption ? (
              <>
                <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs font-mono">
                  {selectedOption.value}
                </span>
                {selectedOption.label}
              </>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto overscroll-contain"
            >
              <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="relative">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"/>
                    <input
                        autoFocus
                        type="text"
                        className="w-full pl-8 pr-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                        placeholder="Пошук..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
              </div>
              <div>
                {filteredOptions.length ? (
                  filteredOptions.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0 active:bg-indigo-100"
                    >
                      <div className="font-medium text-gray-800 flex items-center gap-3">
                        <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-xs font-mono w-10 text-center">
                          {opt.value}
                        </span>
                        {opt.label}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-gray-400">Нічого не знайдено</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MODAL СКАСУВАННЯ ---
const CancelConfirmModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-orange-100"
        >
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
              <FaTimes />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Скасувати вихідний?</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Цей запис залишиться в історії, але буде позначений як 
              <span className="font-bold text-gray-800"> скасований</span>. 
              <br/>Працівник вважатиметься активним.
            </p>
          </div>
          <div className="flex bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors active:bg-gray-200"
            >
              Залишити
            </button>
            <div className="w-px bg-gray-200" />
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 py-4 text-sm font-bold text-orange-600 hover:bg-orange-50 transition-colors active:bg-orange-100"
            >
              Скасувати
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// --- MAIN PAGE ---

export default function TimeOffManager() {
  const { role: authRole, employee } = useAuth();
  
  // Витягуємо роль безпечніше: або з useAuth, або прямо з об'єкта employee
  const activeRole = authRole || employee?.role;

  const isAdminOrOffice = activeRole === "admin" || activeRole === "super_admin" || activeRole === "office";
  const isInstaller = activeRole === "installer";
  
  const myCustomIdStr = employee?.custom_id ? String(employee.custom_id) : null;

  const isDesktop = useIsDesktop();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [upcomingRecords, setUpcomingRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [cancelModal, setCancelModal] = useState({ show: false, id: null });

  const [mode, setMode] = useState("RANGE");
  const [manualDates, setManualDates] = useState([]);
  const [singleDateInput, setSingleDateInput] = useState(formatDateToYYYYMMDD(new Date()));

  const [formData, setFormData] = useState({
    employeeId: null,
    type: "OFF",
    startDate: formatDateToYYYYMMDD(new Date()),
    endDate: formatDateToYYYYMMDD(new Date()),
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const empData = await apiGet("/api/timeoff/employees");
      setEmployees(empData || []);

      const attData = await apiGet("/api/timeoff/upcoming?days=10");
      setUpcomingRecords(attData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setIsFormOpen(isDesktop);
  }, [isDesktop]);

  useEffect(() => {
    if (!myCustomIdStr) return;
    setFormData((prev) => {
      if (prev.employeeId) return prev;
      return { ...prev, employeeId: myCustomIdStr };
    });
  }, [myCustomIdStr]);

  const employeeOptions = useMemo(() => {
    return (employees || []).map((e) => ({
      value: String(e.custom_id),
      label: e.name,
    }));
  }, [employees]);

  const groupedRecords = useMemo(() => {
    const groups = {};
    (upcomingRecords || []).forEach((rec) => {
      const key = rec.work_date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(rec);
    });
    return groups;
  }, [upcomingRecords]);

  // --- HANDLERS ---
  const addManualDate = () => {
    if (!singleDateInput) return;
    if (!manualDates.includes(singleDateInput)) {
      setManualDates([...manualDates, singleDateInput].sort());
    }
  };

  const removeManualDate = (d) => {
    setManualDates(manualDates.filter((x) => x !== d));
  };

  const handleAddRecord = async () => {
    if (!formData.employeeId) {
      alert("Оберіть працівника");
      return;
    }

    let finalDates = [];
    if (mode === "RANGE") {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) return alert("Дата кінця менша за дату початку");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        finalDates.push(formatDateToYYYYMMDD(d));
      }
    } else {
      if (!manualDates.length) return alert("Додайте дати");
      finalDates = [...manualDates];
    }

    setIsSaving(true);
    const empIdNum = Number(formData.employeeId);
    
    if (isNaN(empIdNum)) {
        alert("Помилка ID");
        setIsSaving(false);
        return;
    }

    const records = finalDates.map((dateStr) => ({
      work_date: dateStr,
      employee_custom_id: empIdNum,
      status: formData.type,
      notes: formData.notes,
    }));

    try {
      await apiPost("/api/timeoff/upsert", { records });
      await loadData();
      
      setFormData(prev => ({ 
          ...prev, 
          employeeId: isInstaller ? myCustomIdStr : myCustomIdStr || null,
          notes: "" 
      }));
      setManualDates([]);
      if (!isDesktop) setIsFormOpen(false);
    } catch (e) {
      alert("Помилка: " + (e?.message || "Error"));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelModal.id) return;
    try {
      await apiPatch(`/api/timeoff/attendance/${cancelModal.id}/cancel`);
      await loadData();
    } catch (e) {
      alert("Помилка скасування: " + (e?.message || "Unknown error"));
    } finally {
      setCancelModal({ show: false, id: null });
    }
  };

  return (
    <div className="h-dvh w-full bg-slate-100 flex flex-col md:flex-row overflow-hidden relative">
      
      <CancelConfirmModal
        isOpen={cancelModal.show}
        onClose={() => setCancelModal({ show: false, id: null })}
        onConfirm={confirmCancel}
      />

      {/* LEFT PANEL (FORM) */}
      <div className="bg-white border-b md:border-b-0 md:border-r border-gray-200 md:w-[400px] flex-shrink-0 z-20 shadow-md flex flex-col transition-all relative">
        <div
          onClick={() => !isDesktop && setIsFormOpen((v) => !v)}
          className="p-5 flex justify-between items-center cursor-pointer md:cursor-default bg-white z-10 border-b border-gray-50 flex-shrink-0"
        >
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaPlus className="text-indigo-600" /> Додати вихідний
          </h2>
          {!isDesktop && <div className="text-gray-400 p-2">{isFormOpen ? <FaChevronUp /> : <FaChevronDown />}</div>}
        </div>

        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              initial={isDesktop ? { opacity: 1, flex: 1 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", flex: isDesktop ? 1 : "none" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-y-auto custom-scrollbar overscroll-contain max-h-[75dvh] md:max-h-full"
            >
              <div className="px-6 pb-8 space-y-6 pt-2">
                
                {/* Employee Select */}
                <div>
                   <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wide">Працівник</label>
                   {/* Якщо бос — може вибрати будь-кого */}
                   {isInstaller && !isAdminOrOffice ? (
                       <div className="p-3.5 bg-gray-100 rounded-xl text-gray-500 flex gap-2 items-center text-sm border font-medium">
                           <FaUser className="text-gray-400"/> {employee?.name || "Я"}
                       </div>
                   ) : (
                       <SearchableSelect 
                           options={employeeOptions} 
                           value={formData.employeeId}
                           onChange={v => setFormData(p => ({...p, employeeId: String(v)}))}
                           placeholder="Оберіть зі списку..."
                           icon={FaUser}
                       />
                   )}
                </div>

                {/* Type Select */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wide">Тип відсутності</label>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                           {id: "OFF", label: "Вихідний", icon: FaBed, color: "red"},
                           {id: "VACATION", label: "Відпустка", icon: FaPlane, color: "blue"},
                           {id: "SICK_LEAVE", label: "Лікарняний", icon: FaNotesMedical, color: "orange"},
                        ].map(t => (
                            <button
                              key={t.id} type="button"
                              onClick={() => setFormData(p => ({...p, type: t.id}))}
                              className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 active:scale-95 touch-manipulation ${
                                  formData.type === t.id 
                                  ? `bg-${t.color}-50 border-${t.color}-500 text-${t.color}-700 shadow-sm` 
                                  : `bg-white border-gray-100 text-gray-400 hover:border-gray-200`
                              }`}
                            >
                                <t.icon size={20} className="mb-1.5"/>
                                <span className="text-[10px] font-bold uppercase tracking-tight">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Dates Section */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wide">Період та дати</label>
                    <div className="bg-gray-100 p-1.5 rounded-xl flex text-sm mb-4 font-medium">
                        <button type="button" onClick={() => setMode("RANGE")} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${mode === "RANGE" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}><FaArrowsAltH/> Період</button>
                        <button type="button" onClick={() => setMode("DATES")} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all ${mode === "DATES" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400 hover:text-gray-600"}`}><FaListUl/> Окремі дні</button>
                    </div>

                    {mode === "RANGE" ? (
                        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 md:gap-4 relative">
                                <div className="flex-1 min-w-0">
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 ml-1">Початок</label>
                                    <div className="relative">
                                        <input 
                                            type="date" 
                                            value={formData.startDate} 
                                            onChange={e => setFormData(p => ({...p, startDate: e.target.value}))} 
                                            className="w-full p-3 pl-3 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all appearance-none"
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 text-gray-300 flex-shrink-0">
                                    <FaArrowRight />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 ml-1">Кінець</label>
                                    <input 
                                        type="date" 
                                        value={formData.endDate} 
                                        min={formData.startDate} 
                                        onChange={e => setFormData(p => ({...p, endDate: e.target.value}))} 
                                        className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all appearance-none"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                                <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1 ml-1">Оберіть дату</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="date" 
                                        value={singleDateInput} 
                                        onChange={e => setSingleDateInput(e.target.value)} 
                                        className="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-100 outline-none"
                                    />
                                    <button type="button" onClick={addManualDate} className="w-12 bg-gray-800 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"><FaPlus/></button>
                                </div>
                            </div>

                            {manualDates.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    {manualDates.map(d => (
                                        <div key={d} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex gap-2 items-center shadow-sm">
                                            {d} <button onClick={() => removeManualDate(d)} className="text-red-400 hover:text-red-600 p-1"><FaTimes/></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wide">Коментар</label>
                    <input 
                        type="text" 
                        value={formData.notes} 
                        onChange={e => setFormData(p => ({...p, notes: e.target.value}))} 
                        className="w-full p-3.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow" 
                        placeholder="Наприклад: Сімейні обставини"
                    />
                </div>

                <button 
                    type="button" 
                    onClick={handleAddRecord} 
                    disabled={isSaving} 
                    className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-4"
                >
                    {isSaving ? "Збереження..." : <><FaCheck/> Зберегти</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT PANEL (LIST) */}
      <div className="flex-1 bg-slate-50 overflow-y-auto overscroll-contain pb-24 md:pb-0">
        <div className="p-4 md:p-8 max-w-2xl mx-auto min-h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 sticky top-0 bg-slate-50 z-10 py-2">
                <FaCalendarAlt className="text-indigo-500"/> Графік
                <span className="text-xs font-normal text-gray-500 bg-white px-2 py-1 rounded-md border shadow-sm">10 днів</span>
            </h2>

            {loading ? (
                <div className="flex flex-col gap-4">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse"/>)}
                </div>
            ) : upcomingRecords.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 mx-4 mt-10">
                    <FaBed className="text-gray-300 text-5xl mx-auto mb-4"/>
                    <p className="text-gray-500 font-medium">Всі працюють!</p>
                    <p className="text-xs text-gray-400 mt-2">Немає запланованих відсутностей</p>
                </div>
            ) : (
                <div className="space-y-8 pb-10">
                    {Object.keys(groupedRecords).map(dateStr => {
                        const records = groupedRecords[dateStr];
                        const label = getRelativeDateLabel(dateStr);
                        const isToday = label === "Сьогодні";

                        return (
                            <div key={dateStr} className="animate-fadeIn">
                                <div className={`sticky top-12 md:top-0 z-10 py-2 mb-3 flex items-center gap-3 ${isToday ? "text-indigo-600" : "text-gray-500"}`}>
                                    <div className={`font-bold text-lg shadow-sm ${isToday ? "bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100" : "bg-white/80 backdrop-blur px-3 py-1 rounded-lg border border-gray-100"}`}>{label}</div>
                                    <div className="h-px bg-gray-200 flex-1"/>
                                    <div className="text-xs font-mono opacity-50 bg-slate-50 px-1">{dateStr}</div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 pl-2 border-l-2 border-gray-200 ml-4 border-dashed">
                                    {records.map(rec => {
                                        const emp = employees.find(e => String(e.custom_id) === String(rec.employee_custom_id));
                                        
                                        let config = { icon: FaBed, text: "Вихідний", bg: "bg-red-50", border: "border-red-100", textCol: "text-red-700" };
                                        if (rec.status === "VACATION") config = { icon: FaPlane, text: "Відпустка", bg: "bg-blue-50", border: "border-blue-100", textCol: "text-blue-700" };
                                        if (rec.status === "SICK_LEAVE") config = { icon: FaNotesMedical, text: "Лікарняний", bg: "bg-orange-50", border: "border-orange-100", textCol: "text-orange-700" };

                                        if (rec.is_cancelled) {
                                            config = { icon: FaUndo, text: "СКАСОВАНО", bg: "bg-gray-100", border: "border-gray-200", textCol: "text-gray-400" };
                                        }

                                        const isMyRecord = myCustomIdStr && String(rec.employee_custom_id) === myCustomIdStr;
                                        
                                        // ОСНОВНА ПРАВКА: Бос може все
                                        const canCancel = !rec.is_cancelled && (isAdminOrOffice || isMyRecord);

                                        return (
                                            <div key={rec.id} className={`bg-white p-4 rounded-2xl border ${config.border} shadow-sm flex justify-between items-center group relative overflow-hidden transition-transform active:scale-[0.99]`}>
                                                
                                                {rec.is_cancelled && <div className="absolute inset-0 bg-gray-50/60 z-10 pointer-events-none"/>}

                                                <div className={`flex items-center gap-4 ${rec.is_cancelled ? "opacity-50 grayscale" : ""}`}>
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.bg} ${config.textCol} shadow-inner`}>
                                                        <config.icon size={20}/>
                                                    </div>
                                                    <div>
                                                        <h4 className={`font-bold text-gray-800 text-base ${rec.is_cancelled ? "line-through decoration-gray-400" : ""}`}>
                                                            {emp?.name || "Невідомий"}
                                                        </h4>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${config.bg} ${config.textCol}`}>
                                                                {config.text}
                                                            </span>
                                                            {rec.notes && <span className="text-xs text-gray-400 italic truncate max-w-[150px] flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-gray-300 inline-block"/> {rec.notes}</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                {canCancel && (
                                                    <button 
                                                        onClick={() => setCancelModal({show: true, id: rec.id})}
                                                        className="relative z-20 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all active:bg-orange-100"
                                                        title="Скасувати вихідний"
                                                    >
                                                        <FaTimes size={18}/>
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}