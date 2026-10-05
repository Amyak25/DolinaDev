const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const telegram_id = body.telegram_id;

    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id обязателен' });
    }

    const telegramIdNum = Number(telegram_id);
    if (isNaN(telegramIdNum)) {
      return res.status(400).json({ error: 'Некорректный telegram_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Сколько улучшений куплено
    const countResult = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM user_purchases
      WHERE user_id = ${telegramIdNum}
    `;
    const purchased = countResult.length > 0 ? countResult[0].cnt : 0;

    // Все награды
    const awards = await sql`
      SELECT id, order_num, name, min_purchases, max_purchases, image_url
      FROM awards
      ORDER BY order_num ASC
    `;

    // Отмечаем, какие уже получены
    const result = awards.map(function(a) {
      const min = Number(a.min_purchases);
      const max = a.max_purchases !== null ? Number(a.max_purchases) : Infinity;
      const unlocked = purchased >= min && purchased <= max;
      return {
        id: a.id,
        order_num: a.order_num,
        name: a.name,
        image_url: a.image_url,
        min_purchases: min,
        max_purchases: a.max_purchases,
        unlocked: unlocked
      };
    });

    return res.status(200).json({
      purchased: purchased,
      awards: result
    });

  } catch (err) {
    console.error('Ошибка get-awards:', err);
    return res.status(500).json({ error: err.message });
  }
};
