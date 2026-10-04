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

    const sql = neon(process.env.DATABASE_URL);

    const user = await sql`
      SELECT u.telegram_id, u.nickname, u.balance, u.role,
             COALESCE(p.current_stage, 1) AS current_stage
      FROM users u
      LEFT JOIN user_progress p ON p.user_id = u.telegram_id
      WHERE u.telegram_id = ${telegramId}
    `;
    if (user.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    const purchases = await sql`
      SELECT s.id, s.name, s.price
      FROM user_purchases up
      JOIN shop_items s ON s.id = up.shop_item_id
      WHERE up.user_id = ${telegramId}
      ORDER BY up.purchased_at DESC
    `;

    return res.status(200).json({ user: user[0], purchases });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
