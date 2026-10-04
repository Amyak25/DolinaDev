const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { submission_id, reward, admin_id } = req.body;

    if (!submission_id  reward === undefined  !admin_id) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }
    if (reward < 0) {
      return res.status(400).json({ error: 'Награда не может быть отрицательной' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что админ — действительно админ
    const admin = await sql`
      SELECT role FROM users WHERE telegram_id = ${admin_id}
    `;
    if (admin.length === 0 || admin[0].role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // Берём заявку
    const sub = await sql`
      SELECT id, user_id, stage_id, premium_task_id, status
      FROM submissions WHERE id = ${submission_id}
    `;
    if (sub.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    if (sub[0].status !== 'pending') {
      return res.status(400).json({ error: 'Заявка уже обработана' });
    }

    const userId = sub[0].user_id;
    const stageId = sub[0].stage_id;
    const premiumId = sub[0].premium_task_id;

    // Обновляем заявку
    await sql`
      UPDATE submissions
      SET status = 'approved', reward = ${reward}, admin_id = ${admin_id}
      WHERE id = ${submission_id}
    `;

    // Начисляем монеты
    await sql`
      UPDATE users SET balance = balance + ${reward}
      WHERE telegram_id = ${userId}
    `;

    // Если это этап — двигаем прогресс
    if (stageId) {
      const stage = await sql`
        SELECT order_num FROM stages WHERE id = ${stageId}
      `;
      if (stage.length > 0) {
        const orderNum = stage[0].order_num;
        const nextStage = orderNum + 1;

        // Обновляем прогресс: если это текущий этап — двигаем вперёд
        await sql`
          UPDATE user_progress
          SET current_stage = GREATEST(current_stage, ${nextStage}),
              premium_unlocked = CASE WHEN ${nextStage} > 15 THEN true ELSE premium_unlocked END
          WHERE user_id = ${userId}
        `;
      }
    }

    // Если это премиум-задание — добавляем в completed_premium
    if (premiumId) {
      await sql`
        UPDATE user_progress
        SET completed_premium = array_append(completed_premium, ${premiumId})
        WHERE user_id = ${userId}
          AND NOT (${premiumId} = ANY(completed_premium))
      `;
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
