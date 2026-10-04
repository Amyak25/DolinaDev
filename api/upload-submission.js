const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_id, stage_id, premium_task_id, photo_before_url, photo_after_url } = req.body;

    if (!telegram_id || !photo_before_url || !photo_after_url) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }
    if (!stage_id && !premium_task_id) {
      return res.status(400).json({ error: 'Нужен stage_id или premium_task_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const result = await sql`
      INSERT INTO submissions (user_id, stage_id, premium_task_id, photo_before_url, photo_after_url, status)
     VALUES (${Number(telegram_id)}, ${stage_id ? Number(stage_id) : null}, ${premium_task_id ? Number(premium_task_id) : null}, ${photo_before_url}, ${photo_after_url}, 'pending')
      RETURNING id
    `;

    return res.status(200).json({ success: true, submission_id: result[0].id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
