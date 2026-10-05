const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const telegramId = req.query.telegram_id;
    if (!telegramId) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const telegramIdNum = Number(telegramId);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const user = await sql`
      SELECT u.telegram_id, u.nickname, u.balance, u.role,
             COALESCE(p.current_stage, 1) AS current_stage
      FROM users u
      LEFT JOIN user_progress p ON p.user_id = u.telegram_id
      WHERE u.telegram_id = ${telegramIdNum}
    `;
    if (user.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    const stage = await sql`
      SELECT id, order_num, name, building_image_url
      FROM stages
      WHERE order_num = ${user[0].current_stage}
    `;

    const purchases = await sql`
      SELECT s.id, s.name, s.price
      FROM user_purchases up
      JOIN shop_items s ON s.id = up.shop_item_id
      WHERE up.user_id = ${telegramIdNum}
      ORDER BY up.purchased_at ASC
    `;

    return res.status(200).json({
      user: user[0],
      stage: stage[0] || null,
      purchases
    });

  } catch (err) {
    console.error('Ошибка get-player:', err);
    return res.status(500).json({ error: err.message });
  }
};
