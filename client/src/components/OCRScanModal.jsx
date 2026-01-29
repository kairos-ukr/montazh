import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Fa from "react-icons/fa";

// --- УТИЛІТИ (Стиснення та форматування) ---

function fmtKB(bytes) {
    if (!bytes) return "0 KB";
    return `${Math.round(bytes / 1024)} KB`;
}

async function compressImageToLimit(file, {
    maxBytes = 950 * 1024,
    maxSide = 2200,
    mime = "image/jpeg",
    initialQuality = 0.85,
    minQuality = 0.32,
} = {}) {
    if (!file || !file.type?.startsWith("image/")) return file;
    if (file.size < 1024 * 1024) return file; // Якщо менше 1MB - не чіпаємо
    if (file.size <= maxBytes) return file;

    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    const largest = Math.max(width, height);
    
    if (largest > maxSide) {
        const scale = maxSide / largest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const toBlob = (q) => new Promise((resolve) => canvas.toBlob(resolve, mime, q));

    let blob = await toBlob(initialQuality);
    if (blob.size > maxBytes) blob = await toBlob(minQuality);
    
    // Якщо все ще завеликий, зменшуємо розмір canvas
    if (blob.size > maxBytes) {
        canvas.width = Math.round(width * 0.8);
        canvas.height = Math.round(height * 0.8);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await toBlob(minQuality);
    }

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".compressed.jpg", { type: mime });
}

// --- ОСНОВНИЙ КОМПОНЕНТ ---

export default function OCRScanModal({ closeModal, installation, showNotification }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Авто-закриття після успіху
    useEffect(() => {
        if (isSuccess) {
            const timer = setTimeout(() => {
                closeModal();
            }, 2500); // Закриваємо через 2.5 сек
            return () => clearTimeout(timer);
        }
    }, [isSuccess, closeModal]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!file) return;
        setLoading(true);

        try {
            // 1. Стиснення на клієнті
            const processedFile = await compressImageToLimit(file);

            // 2. Підготовка даних
            const fd = new FormData();
            fd.append("installation_custom_id", installation.custom_id);
            fd.append("quantity", "1"); // За замовчуванням 1 шт
            fd.append("file", processedFile);

            // 3. Відправка
            const res = await fetch("/api/ocr/scan-and-assign", {
                method: "POST",
                body: fd,
                credentials: "include",
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Помилка завантаження");

            // 4. Успіх
            setIsSuccess(true);
            if (showNotification) showNotification("Фото прийнято в обробку");

        } catch (e) {
            console.error(e);
            if (showNotification) showNotification(e.message, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}
            >
                <motion.div
                    className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90dvh]"
                    initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* --- ВАРІАНТ 1: УСПІХ --- */}
                    {isSuccess ? (
                        <div className="p-10 flex flex-col items-center justify-center text-center h-full min-h-[300px] bg-emerald-50">
                            <motion.div 
                                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-600 shadow-sm border-4 border-white"
                            >
                                <Fa.FaCheck size={40} />
                            </motion.div>
                            <h3 className="text-2xl font-black text-emerald-900 mb-2">ПРИЙНЯТО!</h3>
                            <p className="text-emerald-700 text-sm font-medium mb-6 leading-relaxed">
                                Фото передано на сервер.<br />Система розпізнає обладнання<br/>у фоновому режимі.
                            </p>
                            <div className="animate-pulse text-[10px] uppercase font-bold text-emerald-400 tracking-widest">
                                Вікно закриється автоматично...
                            </div>
                        </div>
                    ) : (
                        /* --- ВАРІАНТ 2: ФОРМА --- */
                        <>
                            {/* Header */}
                            <div className="flex-none p-6 border-b border-slate-100 bg-white">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Fa.FaCamera className="text-indigo-600" /> Фотосканер
                                </h3>
                                <div className="flex items-center gap-2 text-sm mt-1">
                                    <span className="text-slate-500">Об'єкт:</span>
                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">
                                        #{installation.custom_id}
                                    </span>
                                    <span className="text-slate-400 truncate max-w-[150px]">{installation.name}</span>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                                <label 
                                    className={`
                                        relative group flex flex-col items-center justify-center w-full aspect-[4/3] rounded-2xl 
                                        border-2 border-dashed transition-all cursor-pointer overflow-hidden bg-white
                                        ${file 
                                            ? 'border-indigo-500 shadow-md ring-4 ring-indigo-50' 
                                            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleFileChange} 
                                        disabled={loading}
                                    />
                                    
                                    {file ? (
                                        <div className="flex flex-col items-center p-4 w-full z-10">
                                            <Fa.FaFileImage className="text-5xl text-indigo-500 mb-3 drop-shadow-sm" />
                                            <p className="font-bold text-slate-700 text-sm truncate w-full text-center px-4">{file.name}</p>
                                            <p className="text-xs text-indigo-500 font-medium mt-1 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                                                {fmtKB(file.size)}
                                            </p>
                                            <div className="absolute inset-0 bg-indigo-500/5 group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                                            <p className="mt-4 text-[10px] text-slate-400 uppercase font-bold tracking-wider">Натисніть щоб змінити</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                                            <Fa.FaCamera className="text-5xl mb-4 opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                                            <p className="font-bold text-sm">Зробити фото / Обрати</p>
                                            <p className="text-[10px] mt-2 opacity-70">JPG, PNG до 10MB</p>
                                        </div>
                                    )}
                                </label>
                                
                                <p className="text-xs text-center text-slate-400 mt-4 leading-relaxed px-4">
                                    Зробіть чітке фото серійного номера або шильдика обладнання.
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex-none p-6 bg-white border-t border-slate-100 flex gap-3 pb-safe">
                                <button 
                                    onClick={closeModal} 
                                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                                    disabled={loading}
                                >
                                    Скасувати
                                </button>
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={!file || loading}
                                    className={`
                                        flex-[2] py-3.5 rounded-xl font-bold text-white shadow-lg text-sm flex items-center justify-center gap-2
                                        transition-all transform active:scale-95
                                        ${(!file || loading) ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200'}
                                    `}
                                >
                                    {loading ? (
                                        <>
                                            <Fa.FaSpinner className="animate-spin" /> Обробка...
                                        </>
                                    ) : (
                                        <>
                                            <Fa.FaPaperPlane /> ВІДПРАВИТИ
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}