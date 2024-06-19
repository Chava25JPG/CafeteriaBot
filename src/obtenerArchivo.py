import sys
import json
from datetime import datetime, timedelta
from pytz import timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os
from PIL import Image
import base64
from googleapiclient.http import MediaFileUpload
import requests

# Configuración de las credenciales
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Construir el servicio de Google Drive y Google Sheets
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

def obtener_o_crear_archivo_dia_especifico():
    """Encuentra o crea un archivo de Google Sheets para el día actual."""
    mx_zone = timezone('America/Mexico_City')
    today = datetime.now(mx_zone).date()
    # Crear un nombre de archivo que incluya la fecha del día actual
    formatted_file_name = f"Registro de Asistencia {today.strftime('%Y-%m-%d')}"

    # Buscar el archivo por el nombre formateado
    query = f"name='{formatted_file_name}' and mimeType='application/vnd.google-apps.spreadsheet'"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])

    if not files:
        # Si el archivo no existe, crear uno nuevo
        file_metadata = {
            'name': formatted_file_name,
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        file = drive_service.files().create(body=file_metadata, fields='id,webViewLink').execute()
        print(f"Archivo creado: {file.get('webViewLink')}")
        return file.get('webViewLink')
    else:
        # Devolver el enlace del archivo existente
        file = drive_service.files().get(fileId=files[0]['id'], fields='webViewLink').execute()
        print(f"Archivo encontrado: {file.get('webViewLink')}")
        return file.get('webViewLink')

if __name__ == '__main__':
    link = obtener_o_crear_archivo_dia_especifico()
    print(link)
