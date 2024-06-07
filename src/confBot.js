const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
    polling: {
      interval: 500, // Intervalo de polling en milisegundos
      autoStart: true,
      params: {
        timeout: 30 // Tiempo de espera de la solicitud en segundos
      }
    }
  });

  module.exports = bot;