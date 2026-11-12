module.exports = async (req, res) => {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Получаем файл из тела запроса
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Файл не получен' });
    }

    // Ключ ImgBB
    const IMGBB_KEY = 'f713e98d2e2690e2855ba795dc35eb23';

    // Формируем FormData для ImgBB
    const formData = new FormData();
    formData.append('image', buffer.toString('base64'));

    // Отправляем в ImgBB
    const url = 'https://api.imgbb.com/1/upload?key=' + IMGBB_KEY + '&expiration=604800';

    const imgbbRes = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const data = await imgbbRes.json();

    if (!data.success) {
      return res.status(500).json({ error: data.error?.message || 'Ошибка ImgBB' });
    }

    // Возвращаем ссылку
    return res.status(200).json({ url: data.data.url });

  } catch (err) {
    console.error('Ошибка upload:', err);
    return res.status(500).json({ error: err.message });
  }
};
