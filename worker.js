// توکن ربات تلگرام خود را اینجا قرار دهید.
const BOT_TOKEN = '7956964199:AAE93a1RsT_rt08DDBWAkUUVQ4mVMATX37Y';

/**
 * خواندن وضعیت فعال بودن ربات از KV
 * در صورت عدم وجود مقدار، به صورت پیش‌فرض ربات فعال در نظر گرفته می‌شود.
 */
async function getRobotActive() {
  const val = await MY_KV.get("robot_active");
  return (val === null ? true : (val === "true"));
}

/**
 * ذخیره وضعیت فعال/غیرفعال ربات در KV
 * @param {boolean} value 
 */
async function setRobotActive(value) {
  await MY_KV.put("robot_active", value ? "true" : "false");
}

/**
 * دریافت لیست ارزها از API و ادغام آن با نگاشت ثابت
 */
async function getCryptoList() {
  let availableCryptos = {};
  try {
    const resp = await fetch("https://api.nobitex.ir/market/stats");
    if (resp.ok) {
      const data = await resp.json();
      // استخراج نماد از کلیدهای موجود (مثلاً "btc-rls" → "btc")
      for (const key in data.stats) {
        const symbol = key.split("-")[0];
        availableCryptos[symbol] = symbol;
      }
    }
  } catch (e) {
    // در صورت بروز خطا، ادامه می‌دهیم.
  }
  // نگاشت اختصاصی ارزها: نام فارسی به نماد
  const crypto_map = {
    "تتر": "usdt", "بیت‌کوین": "btc", "اتریوم": "eth", "ریپل": "xrp", "کاردانو": "ada",
    "دوج‌کوین": "doge", "پولکادات": "dot", "لایت‌کوین": "ltc", "ترون": "trx",
    "بیت‌کوین‌کش": "bch", "بایننس‌کوین": "bnb", "ماتیک": "matic", "یونی‌سواپ": "uni",
    "شیبا": "shib", "اتم": "atom", "اتریوم‌کلاسیک": "etc", "استلار": "xlm",
    "ایاس": "eos", "آوالانچ": "avax", "چین‌لینک": "link", "فانتوم": "ftm",
    "نیر": "near", "شیلیز": "chz", "فایل‌کوین": "fil", "تتا": "theta",
    "هدرا": "hnt", "آوی": "aave", "پنکیک‌سواپ": "cake", "مونرو": "xmr",
    "زی‌کش": "zec", "دش": "dash", "نئو": "neo", "تون‌کوین": "ton",
    "نات‌کوین": "not"
  };

  // ادغام نگاشت اختصاصی در لیست ارزهای دریافت شده
  for (const key in crypto_map) {
    availableCryptos[key] = crypto_map[key];
  }
  return availableCryptos;
}

/**
 * دریافت قیمت یک ارز از API به ازای نماد داده شده
 */
async function getCryptoPrice(symbol) {
  const url = new URL("https://api.nobitex.ir/market/stats");
  url.searchParams.append("srcCurrency", symbol);
  url.searchParams.append("dstCurrency", "rls");

  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return { latest: null, bestSell: null, bestBuy: null, trend: null };
    const data = await resp.json();
    const key = `${symbol}-rls`;
    const stats = data.stats[key];
    if (stats) {
      const latest = Number(stats.latest);
      const bestSell = Number(stats.bestSell);
      const bestBuy = Number(stats.bestBuy);
      // تعیین روند: اگر قیمت لحظه‌ای بالاتر از کمترین قیمت باشد، روند افزایشی است.
      const trend = (latest > bestBuy) ? "📈 افزایشی ⬆" : "📉 کاهشی ⬇";
      return { latest, bestSell, bestBuy, trend };
    }
  } catch (e) {
    // در صورت بروز خطا، مقادیر null برگردانده می‌شوند.
  }
  return { latest: null, bestSell: null, bestBuy: null, trend: null };
}

/**
 * دریافت قیمت تتر (USDT)
 */
async function getUSDTPrice() {
  const result = await getCryptoPrice("usdt");
  return result.latest ? result.latest : null;
}

/**
 * ارسال پیام به تلگرام با استفاده از Bot API
 * @param {number} chat_id - شناسه چت
 * @param {string} text - متن پیام
 * @param {object} extra - گزینه‌های اضافی مانند disable_web_page_preview و parse_mode
 */
async function sendTelegramMessage(chat_id, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id,
    text,
    ...extra
  };
  const init = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  };
  return await fetch(url, init);
}

/**
 * تابع اصلی پردازش درخواست‌های ورودی (به عنوان webhook تلگرام)
 */
async function handleRequest(request) {
  const urlObj = new URL(request.url);
  const pathname = urlObj.pathname;

  // اگر درخواست GET است:
  if (request.method === "GET") {
    // در مسیر /setweb وبهوک تنظیم می‌شود.
    if (pathname === "/setweb") {
      // تنظیم وبهوک روی آدرس اصلی ورکر (با تغییر مسیر به "/")
      urlObj.pathname = "/";
      const webhookUrl = urlObj.toString();
      const setWebhookApi = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
      const resp = await fetch(setWebhookApi);
      const data = await resp.json();
      return new Response(JSON.stringify(data, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // برای سایر درخواست‌های GET می‌توان پیغام ساده‌ای برگرداند.
    return new Response("این endpoint برای دریافت به‌روزرسانی‌های تلگرام است. برای تنظیم وبهوک به /setweb مراجعه کنید.", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // فقط درخواست‌های POST را پردازش می‌کنیم.
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response("Bad Request", { status: 400 });
  }

  // اگر به‌روزرسانی شامل پیام نباشد، پاسخ OK داده می‌شود.
  if (!update.message) {
    return new Response("No message", { status: 200 });
  }

  const message = update.message;
  const chat_id = message.chat.id;
  const text = (message.text || "").trim();

  // دستورات برای روشن/خاموش کردن ربات
  if (text === "روشن!") {
    await setRobotActive(true);
    await sendTelegramMessage(chat_id, "✅ ربات روشن شد.");
    return new Response("OK", { status: 200 });
  } else if (text === "خاموش!") {
    await setRobotActive(false);
    await sendTelegramMessage(chat_id, "❌ ربات خاموش شد.");
    return new Response("OK", { status: 200 });
  }

  // بررسی وضعیت ربات از KV (در صورتی که ربات خاموش باشد، ادامه نمی‌دهیم)
  const active = await getRobotActive();
  if (!active) {
    return new Response("OK", { status: 200 });
  }

  // پردازش پیام‌های کاربر برای درخواست قیمت ارز
  const cryptoList = await getCryptoList();
  for (const name in cryptoList) {
    if (text.includes(name)) {
      const usdt_price = await getUSDTPrice();
      if (!usdt_price) {
        await sendTelegramMessage(chat_id, "❌ خطا در دریافت قیمت تتر!");
        return new Response("OK", { status: 200 });
      }
      const { latest, bestSell, bestBuy, trend } = await getCryptoPrice(cryptoList[name]);
      if (latest) {
        const price_in_usdt = (latest / usdt_price).toFixed(4);
        const response_text =
          `💰 **قیمت لحظه‌ای ${name.toUpperCase()}:** ${latest} تومان (~${price_in_usdt} USDT)\n` +
          `📈 **بالاترین:** ${bestSell} تومان\n` +
          `📉 **کمترین:** ${bestBuy} تومان\n` +
          `📊 **روند:** ${trend}\n\n` +
          `[👨‍💻 ساخته شده توسط crypto](https://t.me/airdropdaily_free)`;
        await sendTelegramMessage(chat_id, response_text, {
          disable_web_page_preview: true,
          parse_mode: "Markdown"
        });
      } else {
        await sendTelegramMessage(chat_id, `❌ خطا در دریافت قیمت ${name.toUpperCase()}!`);
      }
      // فقط اولین تطابق پردازش می‌شود.
      return new Response("OK", { status: 200 });
    }
  }

  return new Response("OK", { status: 200 });
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

