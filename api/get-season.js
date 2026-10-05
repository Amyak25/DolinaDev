const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const config = await sql`
      SELECT end_date FROM game_config WHERE id = 1
    `;

    if (config.length === 0) {
      // Если таблица пустая — игра без дедлайна
      return res.status(200).json({
        end_date: null,
        is_finished: false,
        seconds_left: null
      });
    }

    const endDate = new Date(config[0].end_date);
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const isFinished = diffMs <= 0;

    return res.status(200).json({
      end_date: endDate.toISOString(),
      is_finished: isFinished,
      seconds_left: isFinished ? 0 : Math.floor(diffMs / 1000)
    });

  } catch (err) {
    console.error('Ошибка get-season:', err);
    return res.status(500).json({ error: err.message });
  }
};
