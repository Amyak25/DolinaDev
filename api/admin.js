const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const action = body.action;
    const admin_id = body.admin_id;

    if (!action) {
      return res.status(400).json({ error: 'Не указан action' });
    }
    if (!admin_id) {
      return res.status(400).json({ error: 'Не указан admin_id' });
    }

    const adminIdNum = Number(admin_id);
    if (isNaN(adminIdNum)) {
      return res.status(400).json({ error: 'Некорректный admin_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что запрашивающий — админ (кроме случая 'submissions_list' — там проверка ниже)
    const requester = await sql`
      SELECT role FROM users WHERE telegram_id = ${adminIdNum}
    `;
    if (requester.length === 0 || requester[0].role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // ===== СПИСОК ЗАЯВОК =====
    if (action === 'submissions_list') {
      const status = body.status || 'pending';
      let submissions;

      if (status === 'pending') {
        submissions = await sql`
  SELECT s.id, s.user_id, s.stage_id, s.premium_task_id,
         s.photo_before_url, s.photo_after_url, s.status, s.reward, s.created_at,
         u.nickname,
         st.name AS stage_name,
         st.description AS stage_description,
         st.order_num AS stage_order_num,
         pt.name AS premium_name,
         pt.description AS premium_description,
         pt.order_num AS premium_order_num
  FROM submissions s
  LEFT JOIN users u ON u.telegram_id = s.user_id
  LEFT JOIN stages st ON st.id = s.stage_id
  LEFT JOIN premium_tasks pt ON pt.id = s.premium_task_id
  WHERE s.status = 'pending'
  ORDER BY s.created_at ASC
`;
      } else {
        submissions = await sql`
  SELECT s.id, s.user_id, s.stage_id, s.premium_task_id,
         s.photo_before_url, s.photo_after_url, s.status, s.reward, s.created_at,
         u.nickname,
         st.name AS stage_name,
         st.description AS stage_description,
         st.order_num AS stage_order_num,
         pt.name AS premium_name,
         pt.description AS premium_description,
         pt.order_num AS premium_order_num
  FROM submissions s
  LEFT JOIN users u ON u.telegram_id = s.user_id
  LEFT JOIN stages st ON st.id = s.stage_id
  LEFT JOIN premium_tasks pt ON pt.id = s.premium_task_id
  WHERE s.status IN ('approved', 'rejected')
  ORDER BY s.created_at DESC
  LIMIT 100
`;
      }

      return res.status(200).json({ submissions });
    }

    // ===== ОДОБРИТЬ ЗАЯВКУ =====
    if (action === 'approve') {
      const submission_id = body.submission_id;
      const reward = body.reward;

      if (!submission_id || reward === undefined) {
        return res.status(400).json({ error: 'Не хватает данных' });
      }

      const submissionIdNum = parseInt(submission_id);
      const rewardNum = parseInt(reward);

      if (isNaN(submissionIdNum)) {
        return res.status(400).json({ error: 'Некорректный submission_id' });
      }
      if (isNaN(rewardNum) || rewardNum < 0) {
        return res.status(400).json({ error: 'Некорректная награда' });
      }

      const sub = await sql`
        SELECT id, user_id, stage_id, premium_task_id, status
        FROM submissions
        WHERE id = ${submissionIdNum}
      `;
      if (sub.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      if (sub[0].status !== 'pending') {
        return res.status(400).json({ error: 'Заявка уже обработана' });
      }

      const userId = Number(sub[0].user_id);
      const stageId = sub[0].stage_id ? Number(sub[0].stage_id) : null;
      const premiumId = sub[0].premium_task_id ? Number(sub[0].premium_task_id) : null;

      await sql`
        UPDATE submissions
        SET status = 'approved', reward = ${rewardNum}, admin_id = ${adminIdNum}
        WHERE id = ${submissionIdNum}
      `;

      await sql`
        UPDATE users
        SET balance = balance + ${rewardNum}
        WHERE telegram_id = ${userId}
      `;

      if (stageId) {
        const stage = await sql`
          SELECT order_num FROM stages WHERE id = ${stageId}
        `;
        if (stage.length > 0) {
          const orderNum = Number(stage[0].order_num);
          const nextStage = orderNum + 1;

          await sql`
            INSERT INTO user_progress (user_id, current_stage, premium_unlocked, completed_premium)
            VALUES (${userId}, ${nextStage}, false, '{}')
            ON CONFLICT (user_id) DO UPDATE
            SET current_stage = GREATEST(user_progress.current_stage, ${nextStage}),
                premium_unlocked = CASE WHEN ${nextStage} > 15 THEN true ELSE user_progress.premium_unlocked END
          `;
        }
      }

      if (premiumId) {
        await sql`
          UPDATE user_progress
          SET completed_premium = array_append(completed_premium, ${premiumId})
          WHERE user_id = ${userId}
            AND NOT (${premiumId} = ANY(completed_premium))
        `;
      }

      return res.status(200).json({ success: true });
    }

    // ===== ОТКЛОНИТЬ ЗАЯВКУ =====
    if (action === 'reject') {
      const submission_id = body.submission_id;
      if (!submission_id) {
        return res.status(400).json({ error: 'Не указан submission_id' });
      }

      const submissionIdNum = parseInt(submission_id);
      if (isNaN(submissionIdNum)) {
        return res.status(400).json({ error: 'Некорректный submission_id' });
      }

      const sub = await sql`
        SELECT id, status FROM submissions WHERE id = ${submissionIdNum}
      `;
      if (sub.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      if (sub[0].status !== 'pending') {
        return res.status(400).json({ error: 'Заявка уже обработана' });
      }

      await sql`
        UPDATE submissions
        SET status = 'rejected', reward = 0, admin_id = ${adminIdNum}
        WHERE id = ${submissionIdNum}
      `;

      return res.status(200).json({ success: true });
    }

    // ===== СПИСОК АДМИНОВ =====
    if (action === 'admins_list') {
      const admins = await sql`
        SELECT telegram_id, nickname, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ admins });
    }

    // ===== ДОБАВИТЬ АДМИНА =====
    if (action === 'admins_add') {
      const target_id = body.target_id;
      const targetIdNum = Number(target_id);
      if (isNaN(targetIdNum)) {
        return res.status(400).json({ error: 'Некорректный target_id' });
      }

      const target = await sql`
        SELECT telegram_id, nickname, role FROM users WHERE telegram_id = ${targetIdNum}
      `;
      if (target.length === 0) {
        return res.status(404).json({ error: 'Игрок с таким ID не найден. Сначала он должен зайти в игру.' });
      }
      if (target[0].role === 'admin') {
        return res.status(400).json({ error: 'Он уже админ' });
      }

      await sql`
        UPDATE users SET role = 'admin' WHERE telegram_id = ${targetIdNum}
      `;

      return res.status(200).json({ success: true, nickname: target[0].nickname });
    }

    // ===== УДАЛИТЬ АДМИНА =====
    if (action === 'admins_remove') {
      const target_id = body.target_id;
      const targetIdNum = Number(target_id);
      if (isNaN(targetIdNum)) {
        return res.status(400).json({ error: 'Некорректный target_id' });
      }

      if (targetIdNum === adminIdNum) {
        return res.status(400).json({ error: 'Нельзя снять админку с себя' });
      }

      const target = await sql`
        SELECT role FROM users WHERE telegram_id = ${targetIdNum}
      `;
      if (target.length === 0) {
        return res.status(404).json({ error: 'Игрок не найден' });
      }
      if (target[0].role !== 'admin') {
        return res.status(400).json({ error: 'Он не админ' });
      }

      const adminCount = await sql`
        SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'
      `;
      if (adminCount[0].cnt <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить последнего админа' });
      }

      await sql`
        UPDATE users SET role = 'player' WHERE telegram_id = ${targetIdNum}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие: ' + action });

  } catch (err) {
    console.error('Ошибка admin:', err);
    return res.status(500).json({ error: err.message });
  }
};
