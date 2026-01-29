import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaInfoCircle,
  FaFolderOpen,
  FaTools,
  FaUsers,
  FaPhone,
  FaCity,
  FaMapMarkerAlt,
  FaBolt,
  FaCommentDots,
  FaChevronDown,
  FaUserTie,
  FaCheckCircle,
  FaClock
} from "react-icons/fa";

import { apiGet } from "../api/http";
import { useAuth } from "../context/AuthProvider";
import ProjectWorkflowTab from "../components/PWT";
import AdditionalInfoModal from "../components/AdditionalInfoModal";
import ProjectDocumentsPage from "./ProjectDocumentsPage"; 

// Константи
const PROJECT_STATUS_LABELS = {
  planning: 'Планування',
  in_progress: 'Виконується',
  on_hold: 'Призупинено',
  completed: 'Завершено',
  cancelled: 'Скасовано'
};

const TABS = [
  { id: "main", label: "Основна", icon: FaInfoCircle },
  { id: "docs", label: "Документи", icon: FaFolderOpen },
  { id: "workflow", label: "Хід роботи", icon: FaTools },
];

function formatDateUA(date) {
  try {
    return date ? new Date(date).toLocaleDateString("uk-UA") : "—";
  } catch {
    return "—";
  }
}

// UI Components
const Field = ({ label, value, icon: Icon, className = "", subValue = null }) => (
  <div className={`min-w-0 ${className}`}>
    <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-0.5">
      {Icon && <Icon className="text-slate-400 text-xs flex-shrink-0" />} {label}
    </div>
    <div className="text-sm font-semibold text-slate-800 break-words whitespace-normal leading-snug">
        {value ?? "—"}
    </div>
    {subValue && (
      <div className="mt-1">{subValue}</div>
    )}
  </div>
);

// Accordion Header Component
const AccordionHeader = ({ title, icon: Icon, isOpen, onToggle, count, colorClass = "text-slate-800" }) => (
  <div 
    onClick={onToggle} 
    className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
  >
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className={`text-lg ${colorClass}`} />}
      <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
          {count}
        </span>
      )}
    </div>
    <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
      <FaChevronDown />
    </div>
  </div>
);

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("main");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [project, setProject] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [additionalInfo, setAdditionalInfo] = useState([]);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Accordion States (Фінанси видалено)
  const [isClientInfoOpen, setIsClientInfoOpen] = useState(true);
  const [isAdditionalInfoOpen, setIsAdditionalInfoOpen] = useState(true); 
  const [isObjectDetailsOpen, setIsObjectDetailsOpen] = useState(true);

  // ---- LOAD DATA ----
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          search: String(id),
          page: "1",
          pageSize: "1",
        });

        // Завантажуємо проект, співробітників (для телефону) та інфо
        const [projectRes, employeesRes, infoRes] = await Promise.all([
             apiGet(`/api/installations?${qs.toString()}`),
             apiGet(`/api/employees?pageSize=100`),
             apiGet(`/api/additional-info/${id}`).catch(() => ({ data: [] }))
        ]);

        const item = (projectRes?.items || [])[0] || null;

        if (!item) {
          throw new Error("Об’єкт не знайдено");
        }

        if (!mounted) return;

        setProject(item);
        setEmployees(employeesRes?.items || []);
        setAdditionalInfo(infoRes?.data || []);

      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Помилка завантаження");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [id]);

  const locationLink = useMemo(() => {
    if (!project) return "";
    if (project.gps_link) return project.gps_link;
    const oblast = project?.client?.oblast;
    const city = project?.client?.populated_place;
    if (oblast && city) return `http://maps.google.com/?q=${encodeURIComponent(`${oblast}, ${city}`)}`;
    return "";
  }, [project]);

  // Знаходимо телефон відповідального
  const responsiblePhone = useMemo(() => {
    if (!project) return null;
    // 1. Спробувати взяти з вкладеного об'єкта
    if (project.responsible_employee?.phone) return project.responsible_employee.phone;
    // 2. Якщо немає, знайти в списку всіх співробітників по ID
    if (project.responsible_emp_id && employees.length > 0) {
        const emp = employees.find(e => e.custom_id === project.responsible_emp_id);
        return emp?.phone || null;
    }
    return null;
  }, [project, employees]);

  const TabButton = ({ tab }) => {
    const Icon = tab.icon;
    const active = activeTab === tab.id;
    return (
      <button
        onClick={() => setActiveTab(tab.id)}
        className={`w-full flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2
          px-2 sm:px-3 py-2 rounded-xl text-[11px] sm:text-sm font-bold border transition
          ${active ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}
      >
        <Icon className={active ? "text-white" : "text-indigo-600"} />
        <span className="leading-tight">{tab.label}</span>
      </button>
    );
  };

  const handleInfoSent = () => {
      apiGet(`/api/additional-info/${id}`)
        .then(res => {
            const newData = res.data || [];
            setAdditionalInfo(newData);
            if (newData.length > 0) setIsAdditionalInfoOpen(true);
        })
        .catch(console.error);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-slate-500">
        <div className="flex flex-col items-center gap-3">
             <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             <span>Завантаження...</span>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700">
           Помилка: {error}
           <button onClick={() => navigate("/installations")} className="block mt-2 font-bold underline">Назад</button>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      
      <AdditionalInfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        project={project}
        currentUser={user} 
        showToast={(msg) => alert(msg)} 
        onSuccess={handleInfoSent} 
      />

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <button
                onClick={() => navigate("/installations")}
                className="p-2 rounded-xl hover:bg-slate-100 transition shrink-0"
                title="Назад"
              >
                <FaArrowLeft className="text-slate-600" />
              </button>

              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-extrabold text-slate-800 truncate">
                  {project.name || `Об’єкт #${project.custom_id}`}
                </div>
                <div className="text-xs sm:text-sm text-slate-500 truncate">
                  #{project.custom_id} · {project.client?.company_name || project.client?.name || "Клієнт"}
                </div>
              </div>
            </div>

            {/* Покращена кнопка повідомлення */}
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={() => setIsInfoModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition flex items-center gap-2 font-bold text-sm shadow-sm"
              >
                <FaCommentDots className="text-lg" />
                <span className="hidden sm:inline">Написати коментар</span>
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="grid grid-cols-3 gap-2">
              {TABS.map((t) => (
                <TabButton key={t.id} tab={t} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {activeTab === "main" ? (
         // ----- Вкладка ОСНОВНА -----
         <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT COLUMN */}
              <div className="space-y-6">
                
                {/* Client Info */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <AccordionHeader 
                    title="Клієнт" 
                    icon={FaUsers} 
                    isOpen={isClientInfoOpen} 
                    onToggle={() => setIsClientInfoOpen(!isClientInfoOpen)} 
                    colorClass="text-indigo-600"
                  />
                  <AnimatePresence>
                    {isClientInfoOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: "auto", opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5"
                      >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                            <Field label="Контакт" value={project.client?.name ?? "—"} />
                            <Field label="Компанія" value={project.client?.company_name ?? "—"} />
                            <Field 
                                label="Телефон" 
                                value={project.client?.phone ?? "—"} 
                                icon={FaPhone} 
                                subValue={project.client?.phone && (
                                    <a href={`tel:${project.client.phone}`} className="text-xs text-indigo-600 font-bold hover:underline">
                                        Зателефонувати
                                    </a>
                                )}
                            />
                            <div className="sm:col-span-2">
                              <Field 
                                  label="Адреса" 
                                  value={project.client?.oblast ? `${project.client.oblast}, ${project.client.populated_place}` : "—"} 
                                  icon={FaCity}
                                  className="break-words whitespace-normal"
                              />
                            </div>
                          </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ADDITIONAL INFO */}
                {additionalInfo.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <AccordionHeader 
                      title="Додаткова інформація" 
                      icon={FaCommentDots} 
                      isOpen={isAdditionalInfoOpen} 
                      onToggle={() => setIsAdditionalInfoOpen(!isAdditionalInfoOpen)} 
                      count={additionalInfo.length}
                      colorClass="text-indigo-500"
                    />
                    <AnimatePresence>
                      {isAdditionalInfoOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: "auto", opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }}
                          className="px-5 pb-5"
                        >
                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1 border-t border-slate-50 pt-4 custom-scrollbar">
                              {additionalInfo.map((info) => (
                                  <div key={info.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm transition-colors hover:bg-slate-100">
                                      <div className="flex justify-between items-start mb-1.5">
                                          <span className="font-bold text-slate-700 text-xs uppercase">{info.author_name}</span>
                                          <span className="text-[10px] text-slate-400">{new Date(info.created_at).toLocaleString('uk-UA')}</span>
                                      </div>
                                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{info.message_text}</p>
                                      <div className="mt-2 flex justify-end">
                                          {info.is_sent_to_telegram ? (
                                              <span className="text-[10px] text-green-600 flex items-center gap-1 font-bold bg-green-50 px-1.5 py-0.5 rounded"><FaCheckCircle/> Telegram</span>
                                          ) : (
                                              <span className="text-[10px] text-slate-400 flex items-center gap-1"><FaClock/> Очікування</span>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <AccordionHeader 
                    title="Деталі об’єкту" 
                    icon={FaBolt} 
                    isOpen={isObjectDetailsOpen} 
                    onToggle={() => setIsObjectDetailsOpen(!isObjectDetailsOpen)} 
                    colorClass="text-amber-500"
                  />
                  <AnimatePresence>
                    {isObjectDetailsOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: "auto", opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-5"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-50 pt-4">
                          
                          {/* ВІДПОВІДАЛЬНИЙ З ТЕЛЕФОНОМ */}
                          <Field
                             label="Відповідальний"
                             value={project.responsible_employee?.name || "—"}
                             icon={FaUserTie}
                             subValue={responsiblePhone && (
                                <a href={`tel:${responsiblePhone}`} className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition mt-1">
                                    <FaPhone size={10}/> {responsiblePhone}
                                </a>
                             )}
                          />

                          <div className="min-w-0">
                                <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Статус</div>
                                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${
                                  project.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {PROJECT_STATUS_LABELS[project.status] || project.status}
                                </span>
                          </div>
                          
                          {/* Tech Specs */}
                          <Field label="Потужність" value={project.capacity_kw ? `${project.capacity_kw} кВт` : "—"} />
                          <Field label="Фази" value={project.quant_phase ? `${project.quant_phase}ф` : "—"} />
                          <Field label="Тип станції" value={project.station_type} />
                          <Field label="Тип монтажу" value={project.mount_type} />
                          <Field label="Пріоритет" value={project.priority === 'high' ? 'Високий' : project.priority === 'low' ? 'Низький' : 'Середній'} />
                          <Field label="Виконавець" value={project.working_company} />

                          <div className="sm:col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                            <Field label="Дата початку" value={formatDateUA(project.start_date)} />
                            <Field label="Дата завершення" value={formatDateUA(project.end_date)} />
                          </div>

                          <div className="sm:col-span-2 pt-2 border-t border-slate-50">
                             <div className="min-w-0 mb-3">
                                  <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><FaMapMarkerAlt/> Маршрут</div>
                                  {locationLink ? (
                                     <a href={locationLink} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:underline">
                                        Відкрити мапу
                                     </a>
                                  ) : <span className="text-sm text-slate-400">—</span>}
                             </div>
                            
                            <div className="mt-3">
                                <div className="min-w-0">
                                   <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Примітки</div>
                                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 italic">
                                     {project.notes || "Примітки відсутні"}
                                   </div>
                                </div>
                            </div>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
         </div>
      ) : (
        // ----- Вкладки ХІД РОБОТИ та ДОКУМЕНТИ -----
        <div className="w-full bg-slate-50 h-full min-h-[calc(100vh-160px)]">
           {activeTab === "workflow" && (
             <ProjectWorkflowTab
               project={project}
               isEditing={false}
               currentStage={project.workflow_stage ?? "tech_review"}
               onChangeStage={() => {}} // Read-only
             />
           )}
           
           {activeTab === "docs" && (
             <ProjectDocumentsPage project={project} />
           )}
        </div>
      )}
    </div>
  );
}