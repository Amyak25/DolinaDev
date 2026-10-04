const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    const items = await sql`
      SELECT id, order_num, name, price, description, image_url
      FROM shop_items
      ORDER BY order_num ASC
    `;

    return res.status(200).json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
