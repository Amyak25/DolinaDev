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
  SELECT s.id, s.user_id, s.stage_id, s.premium_task_id,
         s.photo_before_url, s.photo_after_url, s.status, s.reward, s.created_at,
         u.nickname
  FROM submissions s
  LEFT JOIN users u ON u.telegram_id = s.user_id
  WHERE s.status = 'pending'
  ORDER BY s.created_at ASC
`;
    } else {
      submissions = await sql`
  SELECT s.id, s.user_id, s.stage_id, s.premium_task_id,
         s.photo_before_url, s.photo_after_url, s.status, s.reward, s.created_at,
         u.nickname
  FROM submissions s
  LEFT JOIN users u ON u.telegram_id = s.user_id
  WHERE s.status IN ('approved', 'rejected')
  ORDER BY s.created_at DESC
  LIMIT 100
`;
    }

    return res.status(200).json({ submissions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
