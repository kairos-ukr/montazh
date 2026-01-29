// server/src/routes/microtasks.js
import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = express.Router();

router.use(requireAuth);

// GET: Отримати всі дані
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('microtasks')
      .select('*, installations(id, name, custom_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET: Довідники
router.get('/dictionaries', async (req, res) => {
  try {
    const [installations, employees] = await Promise.all([
      supabaseAdmin.from('installations').select('id, name, custom_id'),
      supabaseAdmin.from('employees').select('id, custom_id, name, email, position, role')
    ]);

    if (installations.error) throw installations.error;
    if (employees.error) throw employees.error;

    res.json({
      installations: installations.data,
      employees: employees.data
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST: Створити задачу
router.post('/', async (req, res) => {
  try {
    const { task_text, status, due_date, installation_id, assigned_to } = req.body;
    const creator_email = req.user.email;

    // Якщо при створенні одразу статус "виконано" (малоймовірно, але можливо)
    let data_complete = null;
    if (status === 'виконано') {
        data_complete = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('microtasks')
      .insert({
        task_text,
        status,
        due_date,
        installation_id,
        assigned_to,
        creator_email,
        data_complete // Записуємо дату виконання, якщо є
      })
      .select('*, installations(id, name, custom_id)')
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT: Оновити задачу
router.put('/:custom_id', async (req, res) => {
  try {
    const { custom_id } = req.params;
    const updates = { ...req.body }; // Копіюємо дані, щоб модифікувати об'єкт
    
    // Перевірка прав
    const { data: currentTask, error: fetchError } = await supabaseAdmin
      .from('microtasks')
      .select('*')
      .eq('custom_id', custom_id)
      .single();

    if (fetchError || !currentTask) return res.status(404).json({ error: "Task not found" });

    const employee = req.employee;
    const userRole = employee?.role;
    const myCustomId = employee?.custom_id;
    const myEmail = req.user.email;

    const isAdminOrOffice = ['admin', 'super_admin', 'office'].includes(userRole);
    const isCreator = currentTask.creator_email === myEmail;
    const isAssignee = currentTask.assigned_to === myCustomId;

    if (!isAdminOrOffice && !isCreator && !isAssignee) {
      return res.status(403).json({ error: "У вас немає прав на редагування цієї задачі" });
    }

    // --- ЛОГІКА DATA_COMPLETE ---
    // Якщо статус змінився
    if (updates.status) {
        if (updates.status === 'виконано') {
            // Якщо переводимо у "виконано" - ставимо поточний час
            updates.data_complete = new Date().toISOString();
        } else {
            // Якщо статус будь-який інший ("в процесі", "нове") - очищаємо дату виконання
            updates.data_complete = null;
        }
    }
    // -----------------------------

    const { data, error } = await supabaseAdmin
      .from('microtasks')
      .update(updates)
      .eq('custom_id', custom_id)
      .select('*, installations(id, name, custom_id)')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE: Видалити задачу
router.delete('/:custom_id', async (req, res) => {
  try {
    const { custom_id } = req.params;
    
    const employee = req.employee;
    const userRole = employee?.role;
    const isAdminOrOffice = ['admin', 'super_admin', 'office'].includes(userRole);

    if (!isAdminOrOffice) {
      return res.status(403).json({ error: "Тільки адміністратори можуть видаляти задачі" });
    }

    const { error } = await supabaseAdmin
      .from('microtasks')
      .delete()
      .eq('custom_id', custom_id);

    if (error) throw error;
    res.json({ message: "Deleted successfully" });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;