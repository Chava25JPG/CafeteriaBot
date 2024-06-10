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
const bot = require('./confBot.js');    




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
      const pythonProcess = spawn('python3', ['./src/archivo.py', 'listar', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'Asistencia']);
      let dataString = '';
  
      pythonProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });
  
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data.toString()}`);
        reject(new Error(`Python Error: ${data.toString()}`));
      });
  
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}`));
        } else {
          try {
            resolve(JSON.parse(dataString.trim()));
          } catch (e) {
            reject(new Error("Failed to parse python script output: " + e.message));
          }
        }
      });
  
      pythonProcess.on('error', (err) => {
        reject(new Error("Failed to start python script: " + err.message));
      });
    });
  }
  
  function registrarAsistencia(empleado, fecha, hora, rol, motivo) {
    return new Promise((resolve, reject) => {
      const args = ['asistencia', '13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', 'Asistencia', empleado, fecha, hora, rol, motivo];
      const pythonProcess = spawn('python3', ['./src/archivo.py', ...args]);
  
      let output = '';
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
  
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Python Output:', output); // Log output from Python script
          resolve(output); // Resolve the promise with the output
        } else {
          reject(new Error(`Python script exited with code ${code}`));
        }
      });
  
      pythonProcess.stderr.on('data', (data) => {
        console.error('Python Error:', data.toString());
        reject(new Error(`Python Error: ${data.toString()}`));
      });
    });
  }
  
  
  
  async function handleCambioCommand(chatId) {
    
    const employees = await obtenerEmpleados();
    if (!employees || employees.length === 0) {
      await bot.sendMessage(chatId, "No se encontraron empleados.");
      return;
    }
  
    // Start the process to choose employee and role
    await chooseEmployee(chatId, employees);
  }
  
  async function chooseEmployee(chatId, employees) {
    await bot.sendMessage(chatId, "Quien en turno? 👤:", {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => handleRoleSelection(chatId, msg.text));
  }
  
  async function handleRoleSelection(chatId, empleado) {
    const roles = ['servicio', 'barra', 'cocina', 'runner', 'lava loza'];
    await bot.sendMessage(chatId, "Seleccione el rol:", {
      reply_markup: {
        keyboard: roles.map(rol => [{ text: rol }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      const rol = msg.text;
      const now = moment().tz('America/Mexico_City');
      const fecha = now.format('YYYY-MM-DD');
      const hora = now.format('HH:mm:ss');
      const result = await registrarAsistencia(empleado, fecha, hora, rol);
      await bot.sendMessage(chatId, `Asistencia registrada para ${empleado} como ${rol}.`);
      askForMore(chatId);
    });
  }
  
  async function askForMore(chatId) {
    await bot.sendMessage(chatId, "¿Desea registrar a otro empleado👥?", {
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', msg => {
      if (msg.text === 'Sí ✅') {
        const chatId = msg.chat.id;
        handleCambioCommand(chatId);
      } else {
        handleAdditionalOptions(chatId);
      }
    });
  }
  
  async function handleAdditionalOptions(chatId) {
    await bot.sendMessage(chatId, "Seleccione una opción:", {
      reply_markup: {
        keyboard: [['Marcar falta⛔', 'Marcar retardo⛔🕐'], ['Finalizar registro✨']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      if (msg.text) {
        switch (msg.text.toLowerCase()) {
          case 'marcar falta⛔':
          case 'marcar retardo⛔🕐':
            await handleFaltaRetardo(chatId, msg.text);
            break;
          case 'finalizar registro✨':
            await bot.sendMessage(chatId, "Registro de asistencia terminado.👌");
            await manageBarSetup(chatId, 'panques🧁', 'barra de panques');
            break;
        }
      } else {
        await bot.sendMessage(chatId, "Por favor, envíe un mensaje de texto.");
      }
    });
  }
  
  async function manageBarSetup(chatId, nextStep, barType) {
    await bot.sendMessage(chatId, `¿Ha montado ya la barra de ${barType}?`,{
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    }) ;
    bot.once('message', async msg => {
      
      if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
        await bot.sendMessage(chatId, `Por favor, suba una foto de la barra de ${barType} montada.`);
        bot.once('photo', async (msg) => {
          const tipo = `barra de ${barType}`;
          await handlePhotoUpload(chatId, msg, tipo);
          const nextBar = nextStep === 'panques🧁' ? 'food🍲' : nextStep === 'food🍲' ? 'bebidas🍹' : 'equipos dañados';
          if (nextBar !== 'equipos dañados') {
            await manageBarSetup(chatId, nextBar, nextBar);
          } else {
            await manageEquipmentIssues(chatId);
          }
        });
      } else {
        await bot.sendMessage(chatId, `Por favor monte la barra de ${barType} y luego suba la foto.`);
      }
    });
  }
  
  async function manageEquipmentIssues(chatId) {
    await bot.sendMessage(chatId, "¿Hay algún equipo dañado que necesite reportar?",{
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
    bot.once('message', async msg => {
      if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
        await bot.sendMessage(chatId, "Por favor, describa el problema del equipo.");
        bot.once('message', async descMsg => {
          if (descMsg.text) {
            await bot.sendMessage(chatId, "Ahora, por favor suba una foto del equipo dañado📸⛔.");
            bot.once('photo', async (msg) => {
              const tipo = 'equipos dañados';
              const descripcion = descMsg.text;
              await handlePhotoUpload(chatId, msg, tipo, descripcion);
              await bot.sendMessage(chatId, "Reporte de equipo dañado completado👌.");
              await askPlaylistInfo(chatId);
            });
          } else {
            await bot.sendMessage(chatId, "Por favor proporcione una descripción del problema.");
          }
        });
      } else {
        await bot.sendMessage(chatId, "No se reportaron equipos dañados.😎");
        await askPlaylistInfo(chatId);
      }
    });
  }
  
  
  async function askSpeakersVolume(chatId) {
    await bot.sendMessage(chatId, "¿Las bocinas estan en un buen nivel de volumen🔊?",{
      reply_markup: {
        keyboard: [['Sí ✅', 'No ⛔']],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
    bot.once('message', async msg => {
      if (msg.text && (msg.text.toLowerCase() === 'sí ✅' || msg.text.toLowerCase() === 'si')) {
        const tipo = 'bocinas';
        const descripcion = 'Bocinas en buen nivel';
        await registerSpeakersVolume(chatId, tipo, descripcion);
        await bot.sendMessage(chatId, "Información de las bocinas registrada correctamente.");
        await askRationalWindow(chatId);
      } else {
        await bot.sendMessage(chatId, "Por favor, asegúrese de que las bocinas estén en un buen nivel de volumen.");
      }
    });
  }
  
  async function registerSpeakersVolume(chatId, tipo, descripcion) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const file_url = ''; // Dejar vacío ya que no se sube foto
    await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_url, tipo, descripcion);
  }
  
  
  async function askPlaylistInfo(chatId) {
    await bot.sendMessage(chatId, "La playlist de Boicot Cafe se esta reproduciendo?💚🎶💚");
    bot.once('message', async msg => {
      if (msg.text) {
        const playlistName = msg.text;
        await bot.sendMessage(chatId, "Por favor, suba una foto de la pantalla que muestra la playlist.📸💚");
        bot.once('photo', async (msg) => {
          const tipo = 'playlist';
          const descripcion = playlistName;
          await handlePhotoUpload(chatId, msg, tipo, descripcion);
          await bot.sendMessage(chatId, "Información de la playlist registrada correctamente.💚👌");
          await askSpeakersVolume(chatId);
        });
      } else {
        await bot.sendMessage(chatId, "Por favor, envíe el nombre de la playlist como un mensaje de texto.");
      }
    });
  }
  
  
  
  
  async function askRationalWindow(chatId) {
    await bot.sendMessage(chatId, "Por favor, suba una foto de la ventana Rational limpia.");
    bot.once('photo', async (msg) => {
      const tipo = 'ventana rational';
      const descripcion = 'Ventana Rational limpia';
      await handlePhotoUpload(chatId, msg, tipo, descripcion);
      await bot.sendMessage(chatId, "Foto de la ventana Rational registrada correctamente.");
      
    });
  }
  
  
  
  async function handleFaltaRetardo(chatId, tipo) {
    const now = moment().tz('America/Mexico_City');
    const fecha = now.format('YYYY-MM-DD');
    const employees = await obtenerEmpleados();
  
    await bot.sendMessage(chatId, `Seleccione el empleado para ${tipo.toLowerCase()}:`, {
      reply_markup: {
        keyboard: employees.map(name => [{ text: name }]),
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  
    bot.once('message', async msg => {
      const empleado = msg.text;
      await bot.sendMessage(chatId, `Ingrese el motivo del ${tipo.toLowerCase()}:`);
      bot.once('message', async msg => {
        const motivo = msg.text;
        const hora = now.format('HH:mm:ss');
        const rol = tipo === 'Marcar falta' ? 'Falta' : 'Retardo';
        await registrarAsistencia(empleado, fecha, hora, rol, motivo);
        await bot.sendMessage(chatId, `Se ha registrado un ${tipo.toLowerCase()} para ${empleado}.`);
        askForMore(chatId);
      });
    });
  }
  
  async function handlePhotoUpload(chatId, msg, tipo, descripcion = '') {
    if (msg.photo) {
      const chatId = msg.chat.id;
      const photo = msg.photo.pop();
      const file_id = photo.file_id;
      const file_path = await getFileLink(file_id);
      const now = moment().tz('America/Mexico_City');
      const fecha = now.format('YYYY-MM-DD');
      await subirFoto('13Eir9iwT-z8vtQsxCzcONTlfLfMaBKvl', fecha, file_path, tipo, descripcion);
      await bot.sendMessage(chatId, "Foto subida exitosamente a la hoja de cálculo.");
    } else {
      await bot.sendMessage(chatId, "Por favor envíe una foto.");
    }
  }
  
  function getFileLink(file_id) {
    return bot.getFileLink(file_id);
  }
  
  function subirFoto(folder_id,fecha ,file_url, tipo, descripcion) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['./src/archivo.py', 'subir_foto', folder_id,fecha, file_url, tipo, descripcion]);
  
      pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Output: ${data.toString()}`);
      });
  
      pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data.toString()}`);
        reject(new Error(`Python Error: ${data.toString()}`));
      });
  
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script exited with code ${code}`));
        }
      });
    });
  }
  
  
module.exports = {
    handleCambioCommand
};