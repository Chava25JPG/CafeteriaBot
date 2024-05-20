require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');  // Asegúrate de tener Axios instalado
let dateFormat;
import('dateformat').then((module) => {
    dateFormat = module.default;
}).catch(error => console.log('Error loading the dateFormat module', error));


const app = express();
const upload = multer({ dest: 'uploads/' });

const auth = new google.auth.GoogleAuth({
  keyFile: './cafeteriabot-423500-4f883c22c073.json',
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });
const token = '7010537118:AAGqMOUsovqefCvfeMM05XIZHoXB-8e37rc';




const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  polling: {
    interval: 500, // Intervalo de polling en milisegundos
    autoStart: true,
    params: {
      timeout: 30 // Tiempo de espera de la solicitud en segundos
    }
  }
});

bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
  // Intenta reiniciar el polling después de un breve retraso
  setTimeout(() => {
    console.log("Reiniciando polling...");
    bot.startPolling();
  }, 5000); // Espera 5 segundos antes de reiniciar
});






async function ensureFolderExists(parentId, folderName) {
  const query = `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id; // Folder exists, return the ID
  } else {
    // Folder doesn't exist, create it
    const fileMetadata = {
      'name': folderName,
      'mimeType': 'application/vnd.google-apps.folder',
      'parents': [parentId]
    };
    const folder = await drive.files.create({
      resource: fileMetadata,
      fields: 'id'
    });
    return folder.data.id; // Return the new folder ID
  }
}

async function deleteExistingFile(folderId, filename) {
  const query = `name = '${filename}' and '${folderId}' in parents and trashed = false`;
  const existingFiles = await drive.files.list({
    q: query,
    fields: 'files(id)'
  });

  if (existingFiles.data.files.length > 0) {
    await drive.files.delete({
      fileId: existingFiles.data.files[0].id
    });
    console.log(`Archivo existente borrado: ${filename}`);
  }
}



bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    console.log("Usuario interactuando con /start:", chatId);
    bot.sendMessage(chatId, "Hola, bienvenido al bot. ya puede subir los archivos, los archivos se renombran automaticamente dependiendo el dia de la semana");
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  if (msg.text) {
    if (msg.text.toString().toLowerCase().indexOf("hola") === 0) {
      bot.sendMessage(chatId, "Hola, ¿qué tal?");
    } else if (msg.text.toString().toLowerCase().includes("adiós")) {
      bot.sendMessage(chatId, "¡Hasta luego!");
    }
  }
});


bot.on('document', async (msg) => {
  

  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const mimeType = msg.document.mime_type;

  bot.sendMessage(chatId, `Por favor espere, en un momento se le avisara cuando el archivo se suba`);
  console.log(`procesando...`);
  
  const response = await axios({
    method: 'get',
    url: await bot.getFileLink(fileId),
    responseType: 'stream'
  });

  const now = new Date();
  const year = dateFormat(now, "yyyy");
  const month = dateFormat(now, "mm");
  const week = `Week_${Math.ceil(now.getDate() / 7)}`;
  const dayOfWeek = dateFormat(now, "dddd");

  const yearFolderId = await ensureFolderExists('1pS-L0xpDzIeuh9e0XliVhzjZUa7mYkvt', year);
  const monthFolderId = await ensureFolderExists(yearFolderId, month);
  const weekFolderId = await ensureFolderExists(monthFolderId, week);

  await deleteExistingFile(weekFolderId, dayOfWeek);  // Borrar archivo existente si existe

  const fileMetadata = {
    name: dayOfWeek,  // Usar día de la semana como nombre de archivo
    parents: [weekFolderId]
  };
  const media = {
    mimeType: mimeType,
    body: response.data
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  });

  bot.sendMessage(chatId, `Archivo subido con éxito a la carpeta`); //: ${file.data.id}
  console.log(`Archivo subido con éxito: ${dayOfWeek}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));