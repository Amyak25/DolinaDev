const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { submission_id, admin_id } = req.body;

    if (!submission_id || !admin_id) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем права админа
    const admin = await sql`
      SELECT role FROM users WHERE telegram_id = ${admin_id}
    `;
    if (admin.length === 0 || admin[0].role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав' });
    }

    const sub = await sql`
      SELECT id, status FROM submissions WHERE id = ${submission_id}
    `;
    if (sub.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    if (sub[0].status !== 'pending') {
      return res.status(400).json({ error: 'Заявка уже обработана' });
    }

    await sql`
      UPDATE submissions
      SET status = 'rejected', reward = 0, admin_id = ${admin_id}
      WHERE id = ${submission_id}
    `;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
