import sys
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from datetime import datetime
from pytz import timezone

# Configuración de las credenciales y servicios
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

def obtener_empleados_por_sucursal(sucursal, parent_folder_id):
    
    nombre_archivo = f"Equipo{sucursal}"

    # Buscar el archivo dentro de la carpeta especificada
    query = f"name='{nombre_archivo}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])

    if not files:
        return {'status': 'error', 'message': 'No se encontró el archivo'}

    # Abrir la hoja de cálculo y leer los datos de empleados
    try:
        spreadsheet_id = files[0]['id']
        range_name = 'A3:A'  # Asume que los nombres están desde la celda A3 hacia abajo
        result = sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        empleados = result.get('values', [])
        return {'status': 'success', 'data': [emp[0] for emp in empleados if emp]}  # Devuelve solo nombres no vacíos
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

if __name__ == '__main__':
    sucursal = sys.argv[1]
    parent_folder_id = '1QqK-zY5dom7WW-fhfAG5TsYkCml05g8B'  # ID de la carpeta contenedora
    resultado = obtener_empleados_por_sucursal(sucursal, parent_folder_id)
    print(resultado)
