// Файл: routes/additionalInfo.js
import express from 'express';
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// POST endpoint для додавання інформації
// Додали middleware 'requireAuth' другим аргументом для захисту роута
router.post('/api/additional-info', requireAuth, async (req, res) => {
    try {
        const { installation_custom_id, message_text, author_name } = req.body;

        // Валідація даних
        if (!installation_custom_id || !message_text) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID об\'єкта та текст повідомлення є обов\'язковими.' 
            });
        }

        // Вставка в Supabase через supabaseAdmin
        const { data, error } = await supabaseAdmin
            .from('project_additional_info')
            .insert({
                installation_custom_id,
                message_text,
                // Пріоритет: ім'я з форми -> email залогіненого юзера -> "Менеджер"
                author_name: author_name || req.user?.email || "Менеджер",
                is_sent_to_telegram: false // Залишаємо false, щоб бот підхопив
            })
            .select();

        if (error) {
            throw error;
        }

        // Успішна відповідь
        return res.status(201).json({ 
            success: true, 
            data: data 
        });

    } catch (error) {
        console.error('Error saving additional info:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Помилка сервера при збереженні повідомлення.',
            error: error.message 
        });
    }
});

export default router;