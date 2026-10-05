const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const user = await sql`
      SELECT telegram_id, nickname, balance, role
      FROM users WHERE telegram_id = ${telegramIdNum}
    `;
    if (user.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    const progress = await sql`
      SELECT current_stage, premium_unlocked, completed_premium
      FROM user_progress WHERE user_id = ${telegramIdNum}
    `;

    const stage = await sql`
      SELECT id, order_num, name, description, building_image_url
      FROM stages
      WHERE order_num = ${progress[0] ? progress[0].current_stage : 1}
    `;

    const purchases = await sql`
      SELECT s.id, s.name, s.price
      FROM user_purchases up
      JOIN shop_items s ON s.id = up.shop_item_id
      WHERE up.user_id = ${telegramIdNum}
      ORDER BY up.purchased_at DESC
    `;

    // Проверяем, есть ли активная заявка
    const pending = await sql`
      SELECT id, stage_id, premium_task_id, status, created_at
      FROM submissions
      WHERE user_id = ${telegramIdNum} AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return res.status(200).json({
      user: user[0],
      progress: progress[0] || { current_stage: 1, premium_unlocked: false, completed_premium: [] },
      stage: stage[0] || null,
      purchases,
      pending_submission: pending[0] || null
    });

  } catch (err) {
    console.error('Ошибка get-progress:', err);
    return res.status(500).json({ error: err.message });
  }
};
