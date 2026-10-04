const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_id } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, открыт ли премиум у игрока
    const progress = await sql`
      SELECT premium_unlocked, completed_premium
      FROM user_progress
      WHERE user_id = ${Number(telegram_id)}
    `;

    const unlocked = progress.length > 0 && progress[0].premium_unlocked;
    const completed = progress.length > 0 && progress[0].completed_premium
      ? progress[0].completed_premium
      : [];

    // Всегда возвращаем список заданий, но с флагом unlocked
    const tasks = await sql`
      SELECT id, order_num, name, description
      FROM premium_tasks
      ORDER BY order_num ASC
    `;

    return res.status(200).json({
      unlocked: unlocked,
      completed: completed,
      tasks: tasks
    });
  } catch (err) {
    console.error('Ошибка get-premium:', err);
    return res.status(500).json({ error: err.message });
  }
};
