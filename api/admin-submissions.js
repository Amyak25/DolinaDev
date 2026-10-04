const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = req.query.status || 'pending';
    const sql = neon(process.env.DATABASE_URL);

    let submissions;
    if (status === 'pending') {
      submissions = await sql`
        SELECT id, user_id, stage_id, premium_task_id,
               photo_before_url, photo_after_url, status, reward, created_at
        FROM submissions
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `;
    } else {
      submissions = await sql`
        SELECT id, user_id, stage_id, premium_task_id,
               photo_before_url, photo_after_url, status, reward, created_at
        FROM submissions
        WHERE status IN ('approved', 'rejected')
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    return res.status(200).json({ submissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
