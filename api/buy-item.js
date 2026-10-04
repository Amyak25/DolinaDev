const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { telegram_id, shop_item_id } = req.body;
    if (!telegram_id || !shop_item_id) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const item = await sql`SELECT id, name, price FROM shop_items WHERE id = ${shop_item_id}`;
    if (item.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }

    const user = await sql`SELECT balance FROM users WHERE telegram_id = ${telegram_id}`;
    if (user.length === 0) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    const owned = await sql`
      SELECT id FROM user_purchases
      WHERE user_id = ${telegram_id} AND shop_item_id = ${shop_item_id}
    `;
    if (owned.length > 0) {
      return res.status(400).json({ error: 'Уже куплено' });
    }

    if (user[0].balance < item[0].price) {
      return res.status(400).json({ error: 'Недостаточно монет' });
    }

    await sql`
      UPDATE users SET balance = balance - ${item[0].price}
      WHERE telegram_id = ${telegram_id}
    `;
    await sql`
      INSERT INTO user_purchases (user_id, shop_item_id)
      VALUES (${telegram_id}, ${shop_item_id})
    `;

    const newBalance = await sql`SELECT balance FROM users WHERE telegram_id = ${telegram_id}`;

    return res.status(200).json({
      success: true,
      item: item[0].name,
      new_balance: newBalance[0].balance
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
