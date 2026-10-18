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

    // Получаем дату окончания и дату следующего сезона
    const config = await sql`
      SELECT end_date, 
             end_date + INTERVAL '1 day' AS next_season_start
      FROM game_config WHERE id = 1
    `;

    if (config.length === 0) {
      return res.status(200).json({
        season_finished: false,
        next_season_start: null,
        reset_done: false
      });
    }

    const endDate = new Date(config[0].end_date);
    const nextSeasonStart = new Date(config[0].next_season_start);
    const now = new Date();
    const isFinished = now >= endDate;

    if (!isFinished) {
      // Сезон ещё идёт
      return res.status(200).json({
        season_finished: false,
        end_date: endDate.toISOString(),
        next_season_start: nextSeasonStart.toISOString(),
        reset_done: false
      });
    }

    // Сезон окончен — проверяем, сделан ли сброс для этого игрока
    const progress = await sql`
      SELECT season_reset_done FROM user_progress WHERE user_id = ${telegramIdNum}
    `;

    const resetDone = progress.length > 0 && progress[0].season_reset_done;

    if (!resetDone) {
      // === СБРОС ДЛЯ ЭТОГО ИГРОКА ===
      // 1. Удаляем покупки
      await sql`DELETE FROM user_purchases WHERE user_id = ${telegramIdNum}`;

      // 2. Удаляем работы
      await sql`DELETE FROM submissions WHERE user_id = ${telegramIdNum}`;

      // 3. Сбрасываем прогресс (кроме earned_awards!)
      await sql`
        UPDATE user_progress
        SET current_stage = 1,
            premium_unlocked = false,
            completed_premium = '{}',
            season_reset_done = true
        WHERE user_id = ${telegramIdNum}
      `;

      // 4. Обнуляем баланс
      await sql`
        UPDATE users SET balance = 0 WHERE telegram_id = ${telegramIdNum}
      `;

      console.log('Сезон сброшен для игрока', telegramIdNum);
    }

    return res.status(200).json({
      season_finished: true,
      end_date: endDate.toISOString(),
      next_season_start: nextSeasonStart.toISOString(),
      reset_done: true
    });

  } catch (err) {
    console.error('Ошибка check-season:', err);
    return res.status(500).json({ error: err.message });
  }
};
