const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;
    const stage_id = body.stage_id;
    const premium_task_id = body.premium_task_id;
    const photo_before_url = body.photo_before_url;
    const photo_after_url = body.photo_after_url;

    // Проверка обязательных полей
    if (!telegram_id || !photo_before_url || !photo_after_url) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }

    // Должен быть либо stage_id, либо premium_task_id
    if (!stage_id && !premium_task_id) {
      return res.status(400).json({ error: 'Нужен stage_id или premium_task_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Преобразуем в числа
    const telegramIdNum = Number(telegram_id);
    const stageIdNum = stage_id ? Number(stage_id) : null;
    const premiumTaskIdNum = premium_task_id ? Number(premium_task_id) : null;

    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }
    if (stageIdNum !== null && isNaN(stageIdNum)) {
      return res.status(400).json({ error: 'Некорректный stage_id' });
    }
    if (premiumTaskIdNum !== null && isNaN(premiumTaskIdNum)) {
      return res.status(400).json({ error: 'Некорректный premium_task_id' });
    }

    // Если это премиум — проверяем, что он открыт и не выполнен
    if (premiumTaskIdNum !== null) {
      const progress = await sql`
        SELECT premium_unlocked, completed_premium
        FROM user_progress
        WHERE user_id = ${telegramIdNum}
      `;

      if (progress.length === 0 || !progress[0].premium_unlocked) {
        return res.status(403).json({ error: 'Премиум-задания ещё не открыты' });
      }

      const completed = progress[0].completed_premium || [];
      if (completed.indexOf(premiumTaskIdNum) !== -1) {
        return res.status(400).json({ error: 'Это задание уже выполнено' });
      }
    }

    // Вставляем заявку
    const result = await sql`
      INSERT INTO submissions (
        user_id, stage_id, premium_task_id,
        photo_before_url, photo_after_url, status
      )
      VALUES (
        ${telegramIdNum},
        ${stageIdNum},
        ${premiumTaskIdNum},
        ${photo_before_url},
        ${photo_after_url},
        'pending'
      )
      RETURNING id
    `;

    return res.status(200).json({
      success: true,
      submission_id: result[0].id
    });

  } catch (err) {
    console.error('Ошибка upload-submission:', err);
    return res.status(500).json({ error: err.message });
  }
};
