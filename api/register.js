const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_id, nickname } = req.body;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, есть ли игрок
    const existing = await sql`
      SELECT telegram_id, nickname, balance, role
      FROM users
      WHERE telegram_id = ${telegram_id}
    `;

    if (existing.length > 0) {
      // Игрок уже есть — возвращаем его данные
      return res.status(200).json({
        registered: false,
        user: existing[0]
      });
    }

    // Новый игрок — создаём
    await sql`
      INSERT INTO users (telegram_id, nickname, role, balance)
      VALUES (${telegram_id}, ${nickname || 'Игрок'}, 'player', 0)
    `;

    // Создаём запись прогресса
    await sql`
      INSERT INTO user_progress (user_id, current_stage, premium_unlocked)
      VALUES (${telegram_id}, 1, false)
    `;

    return res.status(200).json({
      registered: true,
      user: {
        telegram_id,
        nickname: nickname || 'Игрок',
        balance: 0,
        role: 'player'
      }
    });
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    return res.status(500).json({ error: err.message });
  }
};
