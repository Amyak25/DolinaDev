const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const action = body.action;           // 'list' | 'add' | 'remove'
    const admin_id = body.admin_id;       // кто выполняет действие
    const target_id = body.target_id;     // кого добавляют/удаляют (для add/remove)

    if (!action || !admin_id) {
      return res.status(400).json({ error: 'Не хватает данных' });
    }

    const adminIdNum = Number(admin_id);
    if (isNaN(adminIdNum)) {
      return res.status(400).json({ error: 'Некорректный admin_id' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Проверяем, что запрашивающий — админ
    const requester = await sql`
      SELECT role FROM users WHERE telegram_id = ${adminIdNum}
    `;
    if (requester.length === 0 || requester[0].role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав' });
    }

    // === LIST ===
    if (action === 'list') {
      const admins = await sql`
        SELECT telegram_id, nickname, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
      `;
      return res.status(200).json({ admins });
    }

    // === ADD ===
    if (action === 'add') {
      const targetIdNum = Number(target_id);
      if (isNaN(targetIdNum)) {
        return res.status(400).json({ error: 'Некорректный target_id' });
      }

      // Проверяем, есть ли такой игрок
      const target = await sql`
        SELECT telegram_id, nickname, role FROM users WHERE telegram_id = ${targetIdNum}
      `;
      if (target.length === 0) {
        return res.status(404).json({ error: 'Игрок с таким ID не найден. Сначала он должен зайти в игру.' });
      }
      if (target[0].role === 'admin') {
        return res.status(400).json({ error: 'Он уже админ' });
      }

      await sql`
        UPDATE users SET role = 'admin' WHERE telegram_id = ${targetIdNum}
      `;

      return res.status(200).json({
        success: true,
        nickname: target[0].nickname
      });
    }

    // === REMOVE ===
    if (action === 'remove') {
      const targetIdNum = Number(target_id);
      if (isNaN(targetIdNum)) {
        return res.status(400).json({ error: 'Некорректный target_id' });
      }

      if (targetIdNum === adminIdNum) {
        return res.status(400).json({ error: 'Нельзя снять админку с себя' });
      }

      const target = await sql`
        SELECT role FROM users WHERE telegram_id = ${targetIdNum}
      `;
      if (target.length === 0) {
        return res.status(404).json({ error: 'Игрок не найден' });
      }
      if (target[0].role !== 'admin') {
        return res.status(400).json({ error: 'Он не админ' });
      }

      // Проверяем, что остаётся хотя бы один админ
      const adminCount = await sql`
        SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'admin'
      `;
      if (adminCount[0].cnt <= 1) {
        return res.status(400).json({ error: 'Нельзя удалить последнего админа' });
      }

      await sql`
        UPDATE users SET role = 'player' WHERE telegram_id = ${targetIdNum}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Неизвестное действие' });

  } catch (err) {
    console.error('Ошибка admin-manage:', err);
    return res.status(500).json({ error: err.message });
  }
};
