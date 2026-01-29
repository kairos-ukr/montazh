import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCheck, FaCamera, FaClock, FaHistory, FaTimes,
  FaChevronRight, FaMapMarkerAlt, FaBoxOpen, FaSolarPanel,
  FaFileSignature, FaBroadcastTower, FaImage, FaExclamationTriangle,
  FaTools, FaTrash, FaPlus, FaSpinner, FaThumbtack, FaCheckCircle,
  FaUserTie, FaSearch, FaArrowRight
} from "react-icons/fa";

import { apiGet, apiPost } from "../api/http";

/**
 * ТЕСТОВИЙ UPLOADER (FastAPI на bot-hosting).
 */
const WORKFLOW_UPLOADER_URL = "http://prem-eu1.bot-hosting.net:20174";

// --- КОНФІГУРАЦІЯ ГРУП ЕТАПІВ ---
const STAGE_GROUPS = [
  { key: "tech_review", label: "Заміри", icon: FaMapMarkerAlt },
  { key: "complectation", label: "Комплектація", icon: FaBoxOpen },
  { key: "installation", label: "Монтаж", icon: FaSolarPanel },
  { key: "grid_connection", label: "Мережа", icon: FaFileSignature },
  { key: "monitoring_setup", label: "Запуск", icon: FaBroadcastTower },
];

// --- ДЕТАЛЬНІ ЗАВДАННЯ ---
const DETAILED_TASKS = {
  tech_review: [
    { id: "tech_measurements", title: "Проведення замірів" }
  ],
  complectation: [
    { id: "comp_materials", title: "Комплектація матеріалів" },
    { id: "comp_protection", title: "Комплектація ел. захисту" }
  ],
  installation: [
    { id: "inst_structure", title: "Монтаж конструкції" },
    { id: "inst_panels", title: "Встановлення панелей" },
    { id: "inst_cabling", title: "Прокладання траси DC" },
    { id: "inst_grounding", title: "Заземлення" },
    { id: "inst_inverter", title: "Підключення інвертора" }
  ],
  grid_connection: [
    { id: "grid_power", title: "Заведення потужності" }
  ],
  monitoring_setup: [
    { id: "mon_launch_station", title: "Запуск станції" }
  ]
};

// --- КОНФІГУРАЦІЯ СТАТУСІВ ---
const STATUS_CONFIG = {
  default: [
    { key: "todo", label: "Не почато", color: "bg-slate-50 text-slate-500 border-slate-200" },
    { key: "in_progress", label: "В роботі", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { key: "done", label: "Виконано", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ],
  tech_review: [
    { key: "waiting_client", label: "Очікуємо від клієнта", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "on_site", label: "Виконали на виїзді", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "done", label: "Виконано", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ],
  grid_connection: [
    { key: "waiting", label: "Очікуємо", color: "bg-slate-50 text-slate-500 border-slate-200" },
    { key: "docs_submitted", label: "Документи подано", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { key: "done", label: "Виконано", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ],
  monitoring_setup: [
    { key: "waiting", label: "Очікуємо", color: "bg-slate-50 text-slate-500 border-slate-200" },
    { key: "setup_needed", label: "Потрібно налаштування моніторингу", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { key: "launched", label: "Станція запущена", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "done", label: "Все виконано", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ]
};

// --- СЛОВНИК ПЕРЕКЛАДІВ (Для історії) ---
const ALL_STATUS_LABELS = {
  'not_started': 'Не розпочато',
  'todo': 'Не почато',
  'in_progress': 'В роботі',
  'done': 'Виконано',
  'waiting': 'Очікуємо',
  'waiting_client': 'Очікуємо від клієнта',
  'on_site': 'Виконали на виїзді',
  'docs_submitted': 'Документи подано',
  'setup_needed': 'Потрібно налаштування',
  'launched': 'Станція запущена'
};

// --- HELPER: Отримання метаданих статусу ---
const getStatusMeta = (stageGroupKey, statusKey) => {
  const config = STATUS_CONFIG[stageGroupKey] || STATUS_CONFIG.default;
  const item = config.find(i => i.key === statusKey);
  if (item) return item;
  const label = ALL_STATUS_LABELS[statusKey] || statusKey;
  return { label: label, color: "bg-slate-100 text-slate-500 border-slate-200" };
};

// --- Drive helpers (preview by fileId) ---
const driveThumbUrl = (fileId, size = 240) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}-h${size}`;

// ✅ Заміна: було uc?export=view → робимо великий thumbnail
const driveViewUrl = (fileId) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w2000`;


// --- HELPER: Upload фото через окремий FastAPI uploader ---
// ✅ Повертаємо { links: string[], fileIds: string[] } (бо твій FastAPI повертає files[])
async function uploadWorkflowPhotos({ files, installationId }) {
  if (!files || files.length === 0) return { links: [], fileIds: [] };

  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  fd.append("object_number", String(installationId));
  fd.append("doc_type", "Фотозвіт");

  const url = `${WORKFLOW_UPLOADER_URL}/workflow/upload`;
  const res = await fetch(url, { method: "POST", body: fd });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data || data.status !== "success") {
    const msg =
      (data && (data.message || data.detail)) ||
      `Upload error (${res.status})`;
    throw new Error(msg);
  }

  // твій формат:
  // { files: [{ fileId, webViewLink, ...}, ...] }
  const filesArr = Array.isArray(data.files) ? data.files : [];

  const links = filesArr.map(x => x?.webViewLink).filter(Boolean);
  const fileIds = filesArr.map(x => x?.fileId).filter(Boolean);

  return { links, fileIds };
}

// --- КОМПОНЕНТИ ---

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <div className="flex items-center gap-3 text-amber-500 mb-4">
          <FaExclamationTriangle size={24} />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <p className="text-slate-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition">
            Скасувати
          </button>
          <button onClick={onConfirm} className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition shadow-lg">
            Підтвердити
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeSelect({ employees, selectedId, onSelect, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);

  const selectedEmployee = (employees || []).find(e => String(e.custom_id) === String(selectedId));

  const filteredEmployees = (employees || []).filter(e => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return e.name.toLowerCase().includes(lowerTerm) || String(e.custom_id).includes(lowerTerm);
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-w-0 relative" ref={wrapperRef}>
      <div className="text-[11px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
        <FaUserTie /> {label}
      </div>
      <div className="relative" onClick={() => setIsOpen(true)}>
        <div className={`w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm bg-white cursor-text transition-all ${isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200 hover:border-indigo-300'}`}>
          {!isOpen && selectedEmployee ? (
            <span className="font-bold text-slate-800 truncate pr-2">
              {selectedEmployee.name} <span className="text-slate-400 font-normal">#{selectedEmployee.custom_id}</span>
            </span>
          ) : (
            <input
              type="text"
              className="w-full outline-none bg-transparent placeholder:text-slate-400 font-medium"
              placeholder={selectedEmployee ? selectedEmployee.name : "Введіть ім'я або ID..."}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
              autoFocus={isOpen}
            />
          )}
          <div className="flex items-center gap-1 text-slate-400">
            {selectedEmployee && !isOpen && (
              <button onClick={(e) => { e.stopPropagation(); onSelect(null); setSearchTerm(""); }} className="p-1 hover:text-red-500 hover:bg-red-50 rounded-full transition" type="button"><FaTimes /></button>
            )}
            {!isOpen && <FaSearch className="text-xs" />}
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {filteredEmployees.length > 0 ? (
            filteredEmployees.map(emp => (
              <button key={emp.id} onClick={() => { onSelect(emp.custom_id); setIsOpen(false); setSearchTerm(""); }} className={`w-full text-left px-4 py-3 text-sm flex justify-between items-center hover:bg-indigo-50 transition border-b border-slate-50 last:border-0 ${String(selectedId) === String(emp.custom_id) ? "bg-indigo-50/50 text-indigo-700" : "text-slate-700"}`} type="button">
                <div className="flex flex-col"><span className="font-bold">{emp.name}</span><span className="text-xs text-slate-400">{emp.position || "Працівник"}</span></div>
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">#{emp.custom_id}</span>
              </button>
            ))
          ) : <div className="px-4 py-3 text-sm text-slate-400 text-center italic">Нікого не знайдено</div>}
        </div>
      )}
    </div>
  );
}

function StageNavigator({ activeStage, onSelect }) {
  const scrollRef = useRef(null);
  const itemRefs = useRef({});

  useEffect(() => {
    const el = itemRefs.current[activeStage];
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeStage]);

  return (
    <div ref={scrollRef} className="flex overflow-x-auto gap-2 px-4 py-4 bg-white border-b border-slate-100 sticky top-0 z-30 no-scrollbar shadow-sm">
      {STAGE_GROUPS.map((s) => {
        const isActive = s.key === activeStage;
        return (
          <button
            key={s.key}
            ref={(el) => (itemRefs.current[s.key] = el)}
            onClick={() => onSelect(s.key)}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 flex items-center gap-2 border ${isActive ? "bg-slate-900 text-white border-slate-900 shadow-md scale-105" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"}`}
            type="button"
          >
            <s.icon className={isActive ? "text-yellow-400" : "text-slate-400"} /> {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ✅ ДОДАНО: модалка перегляду фото по fileId (без переходу на Drive)
function PhotoViewerModal({ isOpen, onClose, fileIds, startIndex = 0 }) {
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    if (isOpen) setIdx(startIndex);
  }, [isOpen, startIndex]);

  if (!isOpen) return null;
  const currentId = fileIds[idx];

  const onPrev = () => setIdx((p) => Math.max(0, p - 1));
  const onNext = () => setIdx((p) => Math.min(fileIds.length - 1, p + 1));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-500">
            Фото {idx + 1} / {fileIds.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={idx === 0}
              className={`px-3 py-2 rounded-xl border font-bold text-xs ${idx === 0 ? "bg-slate-100 text-slate-400 border-slate-100" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"}`}
              type="button"
            >
              Назад
            </button>
            <button
              onClick={onNext}
              disabled={idx === fileIds.length - 1}
              className={`px-3 py-2 rounded-xl border font-bold text-xs ${idx === fileIds.length - 1 ? "bg-slate-100 text-slate-400 border-slate-100" : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"}`}
              type="button"
            >
              Далі
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition"
              type="button"
              title="Закрити"
            >
              <FaTimes />
            </button>
          </div>
        </div>
        <div className="bg-black flex items-center justify-center">
          <img
            src={driveViewUrl(currentId)}
            alt="Фото"
            className="max-h-[78vh] w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function HistoryTimeline({ logs, stageGroupKey }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIds, setViewerIds] = useState([]);
  const [viewerStart, setViewerStart] = useState(0);

  const openViewer = (ids, index) => {
    setViewerIds(ids);
    setViewerStart(index);
    setViewerOpen(true);
  };

  if (!logs || logs.length === 0) return <div className="text-center text-slate-400 py-6 text-xs italic">Історія порожня.</div>;

  return (
    <>
      <div className="space-y-4 mt-4">
        {logs.map((log) => {
          const hasStatusChange = log.old_status && log.new_status && log.old_status !== log.new_status;
          const oldMeta = hasStatusChange ? getStatusMeta(stageGroupKey, log.old_status) : null;
          const newMeta = hasStatusChange ? getStatusMeta(stageGroupKey, log.new_status) : null;

          const fileIds = Array.isArray(log.photo_file_ids) ? log.photo_file_ids.filter(Boolean) : [];
          const links = Array.isArray(log.photos) ? log.photos.filter(Boolean) : [];

          return (
            <div key={log.id} className="flex gap-3 relative group">
              <div className="absolute left-[15px] top-8 bottom-[-20px] w-0.5 bg-slate-100 group-last:hidden" />
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 z-10 border border-slate-200 bg-white shadow-sm">
                <span className="text-[10px] font-black text-slate-600 uppercase">{log.actor?.[0] || "U"}</span>
              </div>
              <div className="flex-1 bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-xs text-slate-800">{log.actor}</span>
                  <span className="text-[10px] font-bold text-slate-400">{log.date}</span>
                </div>

                {hasStatusChange && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded border ${oldMeta.color} opacity-60 line-through`}>
                      {oldMeta.label}
                    </span>
                    <FaArrowRight className="text-slate-300 text-[10px]" />
                    <span className={`px-2 py-0.5 rounded border ${newMeta.color} font-bold`}>
                      {newMeta.label}
                    </span>
                  </div>
                )}

                {log.comment && (
                  <p className="text-sm text-slate-700 mb-2 leading-relaxed whitespace-pre-line bg-slate-50/50 p-2 rounded-lg">
                    {log.comment}
                  </p>
                )}

                {/* ✅ ОНОВЛЕНО: якщо є fileIds — показуємо прев’ю і модалку */}
                {fileIds.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {fileIds.map((id, i) => (
                      <button
                        key={`${id}-${i}`}
                        type="button"
                        onClick={() => openViewer(fileIds, i)}
                        className="block w-12 h-10 bg-slate-100 rounded border border-slate-200 overflow-hidden hover:bg-slate-200 transition"
                        title="Переглянути фото"
                      >
                        <img
                          src={driveThumbUrl(id, 240)}
                          alt="preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // fallback: якщо thumbnail недоступний
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FaImage size={14} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* fallback: якщо ще є старі links у photos */}
                {fileIds.length === 0 && links.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {links.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-12 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition overflow-hidden"
                        title="Відкрити фото (Drive link)"
                      >
                        <FaImage size={14} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PhotoViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        fileIds={viewerIds}
        startIndex={viewerStart}
      />
    </>
  );
}

function TaskDetailModal({ task, stageGroupKey, onClose, onAddUpdate, isLoading, employees, currentResponsibleId }) {
  const [newComment, setNewComment] = useState("");
  const statusOptions = STATUS_CONFIG[stageGroupKey] || STATUS_CONFIG.default;
  const initialStatus = statusOptions.find(s => s.key === task.status) ? task.status : statusOptions[0].key;

  const [newStatus, setNewStatus] = useState(initialStatus);
  const [assignedEmpId, setAssignedEmpId] = useState(currentResponsibleId);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const hasChanges =
    newStatus !== task.status ||
    newComment.trim().length > 0 ||
    selectedFiles.length > 0 ||
    String(assignedEmpId) !== String(currentResponsibleId);

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).map((file) => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setSelectedFiles((prev) => [...prev, ...filesArray]);
    }
  };

  const removePhoto = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!hasChanges) return;

    let finalComment = newComment;
    if (String(assignedEmpId) !== String(currentResponsibleId)) {
      const empName = employees.find(e => String(e.custom_id) === String(assignedEmpId))?.name || "Працівник";
      finalComment = finalComment
        ? `${finalComment}\n(Призначено: ${empName})`
        : `Призначено відповідального: ${empName}`;
    }

    onAddUpdate(task.id, {
      status: newStatus,
      comment: finalComment,
      photos: [],
      rawFiles: selectedFiles.map(f => f.file),
      assigned_to: assignedEmpId
    });
  };

  useEffect(() => {
    return () => selectedFiles.forEach(f => URL.revokeObjectURL(f.preview));
  }, [selectedFiles]);

  return (
    <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl rounded-t-2xl flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Редагування завдання</div>
            <h3 className="font-extrabold text-lg text-slate-900 leading-tight">{task.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition" type="button"><FaTimes /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/50">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm mb-6 space-y-5">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <FaClock className="text-indigo-500" /> Статус завдання
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {statusOptions.map((opt) => {
                  const isSelected = newStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setNewStatus(opt.key)}
                      className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-between border ${
                        isSelected
                          ? `${opt.color.replace('text-', 'border-').split(' ')[0]} ${opt.color} ring-1 ring-inset ring-black/5`
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                      type="button"
                    >
                      <span>{opt.label}</span>
                      {isSelected && <FaCheck />}
                    </button>
                  );
                })}
              </div>
            </div>

            <EmployeeSelect
              label="Відповідальний за етап"
              employees={employees}
              selectedId={assignedEmpId}
              onSelect={setAssignedEmpId}
            />

            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase mb-1">Коментар</div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Опишіть виконану роботу або проблему..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] font-medium text-slate-700"
              />
            </div>

            <div>
              <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {selectedFiles.map((fileObj, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={fileObj.preview} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-90 hover:opacity-100 transition shadow-sm"
                        type="button"
                      >
                        <FaTrash size={10} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition"
                    type="button"
                  >
                    <FaPlus />
                  </button>
                </div>
              )}
              {selectedFiles.length === 0 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 border border-dashed border-indigo-200 text-indigo-600 bg-indigo-50/50 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition"
                  type="button"
                >
                  <FaCamera /> Додати фото
                </button>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <FaHistory /> Хронологія
            </h4>
            <HistoryTimeline logs={task.history} stageGroupKey={stageGroupKey} />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isLoading || !hasChanges}
            className={`w-full py-3.5 rounded-xl font-bold text-lg shadow-lg transition flex justify-center items-center gap-2 ${
              hasChanges
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 active:scale-[0.98]"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            type="button"
          >
            {isLoading && <FaSpinner className="animate-spin" />} Зберегти зміни
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ГОЛОВНИЙ ЕКРАН ---

export default function FieldWorkflow({ project }) {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState(project?.workflow_stage || "tech_review");
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null });

  const installationId = project?.custom_id;

  useEffect(() => {
    apiGet('/api/employees?pageSize=100')
      .then(res => { if (res?.items) setEmployees(res.items); })
      .catch(console.error);
  }, []);

  const loadWorkflowData = async () => {
    if (!installationId) return;
    setLoading(true);
    try {
      const data = await apiGet(`/api/workflow/${installationId}`);
      if (data) {
        const tasksTemplate = DETAILED_TASKS[activeStage] || [];
        const mappedTasks = tasksTemplate.map(templateTask => {
          const taskKey = templateTask.id;
          let statusFromDB = data.stages?.[taskKey] || 'todo';

          const config = STATUS_CONFIG[activeStage] || STATUS_CONFIG.default;
          if (!config.find(s => s.key === statusFromDB)) {
            statusFromDB = config[0].key;
          }

          const history = (data.history || []).filter(h => h.stage_key === taskKey);

          return {
            ...templateTask,
            status: statusFromDB,
            history: history,
            responsibleId: null
          };
        });
        setTasks(mappedTasks);
      }
    } catch (error) {
      console.error("Workflow Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflowData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, activeStage]);

  const handleAddUpdate = async (taskId, updateData) => {
    setSaveLoading(true);
    try {
      // 1) Якщо є rawFiles — спочатку грузимо на FastAPI uploader
      let uploadedLinks = [];
      let uploadedFileIds = [];

      if (updateData?.rawFiles?.length) {
        const up = await uploadWorkflowPhotos({
          files: updateData.rawFiles,
          installationId
        });

        uploadedLinks = up.links || [];
        uploadedFileIds = up.fileIds || [];
      }

      // 2) Формуємо text[] для photos (залишаємо для сумісності/бекап)
      const photos = [
        ...(Array.isArray(updateData.photos) ? updateData.photos : []),
        ...uploadedLinks
      ];

      // 3) Формуємо text[] для photo_file_ids (новий головний масив)
      const photo_file_ids = [
        ...(Array.isArray(updateData.photo_file_ids) ? updateData.photo_file_ids : []),
        ...uploadedFileIds
      ];

      // 4) Зберігаємо подію в workflow (Node.js -> Supabase RPC)
      const payload = {
        installation_id: installationId,
        stage_key: taskId,
        new_status: updateData.status,
        comment: updateData.comment,
        photos: photos,                     // старе поле (можеш потім прибрати)
        photo_file_ids: photo_file_ids,     // ✅ НОВЕ
        responsible_emp_id: updateData.assigned_to
      };

      const response = await apiPost('/api/workflow/update', payload);

      if (response && response.success) {
        setActiveTask(null);
        await loadWorkflowData();
      } else {
        alert(response?.message || "Помилка");
      }
    } catch (error) {
      alert(`Помилка: ${error?.message || "Помилка з'єднання"}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSetCurrentStage = () => {
    const stageLabel = STAGE_GROUPS.find(s => s.key === activeStage)?.label;
    setConfirmModal({
      isOpen: true,
      title: "Змінити етап проекту?",
      message: `Ви впевнені, що хочете встановити етап "${stageLabel}" як поточний активний етап для всього проекту?`,
      onConfirm: async () => {
        try {
          await apiPost('/api/workflow/update', {
            installation_id: installationId,
            stage_key: activeStage,
            new_status: 'active',
            set_as_active_stage: true,
            actor: "Користувач"
          });
          window.location.reload();
        } catch (e) {
          alert("Помилка");
        }
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const getStatusLabel = (stageKey, statusKey) => {
    const config = STATUS_CONFIG[stageKey] || STATUS_CONFIG.default;
    const item = config.find(i => i.key === statusKey);
    const fallbackLabel = ALL_STATUS_LABELS[statusKey] || statusKey;
    return item ? item : { label: fallbackLabel, color: "bg-slate-100 text-slate-500 border-slate-200" };
  };

  const openMeasurementTool = () => { navigate(`/measurements/${installationId}`); };

  const sortedTasks = [...tasks].sort((a, b) => {
    const isDoneA = ['done', 'launched', 'on_site'].includes(a.status);
    const isDoneB = ['done', 'launched', 'on_site'].includes(b.status);
    if (isDoneA === isDoneB) return 0;
    return isDoneA ? 1 : -1;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white">

      <StageNavigator activeStage={activeStage} onSelect={setActiveStage} />

      <div className="flex-1 p-4 md:p-6 bg-slate-50 overflow-y-auto">

        <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {project?.workflow_stage !== activeStage && (
            <button
              onClick={handleSetCurrentStage}
              className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-3 rounded-xl hover:bg-indigo-100 transition flex items-center gap-2 border border-indigo-200 shadow-sm w-full sm:w-auto justify-center"
              type="button"
            >
              <FaThumbtack /> Зробити цей етап поточним
            </button>
          )}

          {activeStage === "tech_review" && (
            <button
              onClick={openMeasurementTool}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-3 font-bold text-sm"
              type="button"
            >
              <FaTools className="text-yellow-400" /> Інструмент замірів
            </button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-10 text-slate-400">
            <FaSpinner className="animate-spin text-3xl" />
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {sortedTasks.map(task => {
              const statusMeta = getStatusLabel(activeStage, task.status);
              const lastLog = task.history && task.history[0];
              const isDone = ['done', 'launched', 'on_site'].includes(task.status);

              return (
                <div
                  key={task.id}
                  onClick={() => setActiveTask(task)}
                  className={`
                    group p-5 rounded-2xl border shadow-sm transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden min-h-[140px]
                    ${isDone
                      ? "bg-slate-50 border-slate-200 opacity-90 hover:opacity-100"
                      : "bg-white border-slate-200 hover:shadow-md hover:border-indigo-200"}
                  `}
                >
                  {isDone && <FaCheckCircle className="absolute -right-4 -bottom-4 text-7xl text-emerald-500/10 pointer-events-none" />}

                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`font-extrabold text-lg leading-snug pr-2 transition-colors ${isDone ? "text-slate-500" : "text-slate-900 group-hover:text-indigo-700"}`}>
                        {task.title}
                      </div>
                      {!isDone && <FaChevronRight className="text-slate-300 mt-1 shrink-0 group-hover:text-indigo-300" />}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center mb-3">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      {lastLog && (
                        <span className="text-xs text-slate-400 font-bold flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-100">
                          <FaClock size={10} /> {lastLog.date}
                        </span>
                      )}
                    </div>
                  </div>

                  {lastLog && lastLog.comment && !isDone && (
                    <div className="mt-auto pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-600 italic line-clamp-2 flex gap-2">
                        <span className="font-bold not-italic text-slate-800">{lastLog.actor}:</span>
                        "{lastLog.comment}"
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          stageGroupKey={activeStage}
          onClose={() => setActiveTask(null)}
          onAddUpdate={handleAddUpdate}
          isLoading={saveLoading}
          employees={employees}
          currentResponsibleId={activeTask.responsibleId}
        />
      )}

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}
