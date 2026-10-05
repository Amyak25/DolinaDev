const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const players = await sql`
      SELECT u.telegram_id, u.nickname, u.balance, u.role,
             COALESCE(p.current_stage, 1) AS current_stage
      FROM users u
      LEFT JOIN user_progress p ON p.user_id = u.telegram_id
      ORDER BY current_stage DESC, u.balance DESC
      LIMIT 100
    `;

    return res.status(200).json({ players });
  } catch (err) {
    console.error('Ошибка get-players:', err);
    return res.status(500).json({ error: err.message });
  }
};
