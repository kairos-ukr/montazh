import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

// --- GET: Отримати статус та історію для об'єкта ---
router.get('/:installationId', async (req, res) => {
  const { installationId } = req.params;

  try {
    const [stagesResponse, historyResponse] = await Promise.all([
      supabaseAdmin
        .from('project_stages')
        .select('stage_key, status')
        .eq('installation_custom_id', installationId),

      supabaseAdmin
        .from('workflow_events')
        .select('*')
        .eq('installation_custom_id', installationId)
        .order('created_at', { ascending: false })
    ]);

    if (stagesResponse.error) throw stagesResponse.error;
    if (historyResponse.error) throw historyResponse.error;

    const stagesDict = (stagesResponse.data || []).reduce((acc, item) => {
      acc[item.stage_key] = item.status;
      return acc;
    }, {});

    const formattedHistory = (historyResponse.data || []).map(event => ({
      ...event,
      user: event.actor || 'Невідомий',
      date: new Date(event.created_at).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    }));

    res.json({ stages: stagesDict, history: formattedHistory });
  } catch (error) {
    console.error('Workflow GET Error:', error.message);
    res.status(500).json({ error: 'Помилка отримання даних workflow' });
  }
});

// --- POST: Оновити етап (Зберегти зміни) ---
router.post('/update', async (req, res) => {
  const {
    installation_id,
    stage_key,
    new_status,
    comment = '',
    photos = [],
    photo_file_ids = [],
    responsible_emp_id = null, // <-- ДОДАНО: Отримуємо ID працівника з фронтенду
    set_as_active_stage = false
  } = req.body;

  const user = req.user;

  if (!installation_id || !stage_key || !new_status) {
    return res.status(400).json({ error: 'Не вистачає обовʼязкових полів' });
  }

  try {
    let actorName = user.email;

    // Спроба отримати ім'я того, хто вносить зміни (Actor)
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('name')
      .eq('user_id', user.id)
      .single();

    if (!empError && employee?.name) {
      actorName = employee.name;
    } else {
      const { data: employeeByEmail } = await supabaseAdmin
        .from('employees')
        .select('name')
        .eq('email', user.email)
        .single();

      if (employeeByEmail?.name) actorName = employeeByEmail.name;
    }

    // Виклик SQL-функції (RPC)
    // ВАЖЛИВО: Переконайся, що SQL функція update_workflow_stage приймає параметр p_new_responsible
    const { data, error } = await supabaseAdmin.rpc('update_workflow_stage', {
      p_installation_id: installation_id,
      p_stage_key: stage_key,
      p_new_status: new_status,
      p_actor: actorName,
      p_comment: comment,
      p_photos: photos,
      p_photo_file_ids: photo_file_ids,
      p_new_responsible: responsible_emp_id, // <-- ДОДАНО: Передаємо в базу
      p_set_as_global_stage: set_as_active_stage
    });

    if (error) throw error;

    if (!data.success) {
      return res.json({
        success: false,
        message: data.message || 'Змін не виявлено або сталася помилка'
      });
    }

    res.json({
      success: true,
      message: 'Збережено успішно',
      actor: actorName,
      new_status: new_status
    });

  } catch (error) {
    console.error('Workflow Update Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;