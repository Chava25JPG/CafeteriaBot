require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const XLSX = require('xlsx');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');
const moment = require('moment-timezone');
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
const sheets = google.sheets({ version: 'v4', auth });
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
  if (!folderName || typeof folderName !== 'string' || !parentId || typeof parentId !== 'string') {
    console.error('Datos inválidos para folderName o parentId:', {folderName, parentId});
    return null;  // Retorna null para evitar crear carpetas incorrectas.
  }

  const query = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files.length > 0) {
      console.log(`Carpeta '${folderName}' encontrada con ID: ${response.data.files[0].id}`);
      return response.data.files[0].id;
    } else {
      console.log(`Carpeta '${folderName}' no encontrada, se procederá a crearla.`);
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      };
      const folder = await drive.files.create({
        resource: fileMetadata,
        fields: 'id'
      });
      console.log(`Carpeta '${folderName}' creada con ID: ${folder.data.id}`);
      return folder.data.id;
    }
  } catch (error) {
    console.error('Error al verificar o crear la carpeta:', error);
    return null;  // Retorna null para manejo de error en llamadas.
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
}).catch(error => {
    console.error("Error during HTTP request:", error.message);
    throw error;  // Propagate error
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


async function getFileLink(fileId) {
  try {
      const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${response.data.result.file_path}`;
  } catch (error) {
      console.error("Error fetching file link:", error);
      throw error; // Ensure the error is not unhandled
  }
}


function obtenerEmpleados() {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['./src/archivo.py', 'listar', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'hola']);

    let dataString = '';
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}`));
      } else {
        try {
          resolve(JSON.parse(dataString));
        } catch (e) {
          reject(new Error("Failed to parse python script output: " + e.message));
        }
      }
    });

    pythonProcess.on('error', (err) => {
      reject(new Error("Failed to start python script: " + err.message));
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
    });
  });
}

// Función para ejecutar el script de Python y registrar la asistencia
function registrarAsistencia(empleado, fecha, hora) {
  return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['./src/archivo.py', 'asistencia', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'hola', empleado, fecha, hora]);

      pythonProcess.stdout.on('data', (data) => {
          console.log(data.toString());  // Puedes decidir qué hacer con la salida aquí
      });

      pythonProcess.stdout.on('end', () => {
          resolve();
      });

      pythonProcess.stderr.on('data', (data) => {
          reject(data.toString());
      });
  });
}

// Manejador para comenzar el flujo de asistencia
bot.onText(/\/asistencia/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const employees = await obtenerEmpleados();
    if (employees.length === 0) {
      bot.sendMessage(chatId, "No se encontraron empleados.");
      return;
    }
    const keyboard = employees.map(name => [{ text: name }]);
    const replyMarkup = {
      keyboard: keyboard,
      one_time_keyboard: true
    };
    bot.sendMessage(chatId, "Seleccione un empleado:", { reply_markup: replyMarkup });
  } catch (error) {
    console.error('Error during /asistencia command:', error);
    bot.sendMessage(chatId, "Error al obtener la lista de empleados. Por favor, intente nuevamente.");
  }
});

// Manejador para registrar la asistencia
bot.on('message', async (msg) => {
  if (msg.text && !msg.text.startsWith('/')) {
    const chatId = msg.chat.id;
    const selectedEmployee = msg.text.trim();

    // Obtener la fecha y hora actual en la zona horaria de México Central
    const now = moment().tz("America/Mexico_City");
    const fecha = now.format('YYYY-MM-DD'); // Formato YYYY-MM-DD
    const hora = now.format('HH:mm:ss'); // Formato HH:MM:SS

      try {
          await registrarAsistencia(selectedEmployee, fecha, hora);
          bot.sendMessage(chatId, `Asistencia registrada para ${selectedEmployee}`);
      } catch (error) {
          console.error('Error registrando asistencia:', error);
          bot.sendMessage(chatId, "Error al registrar la asistencia.");
      }
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));