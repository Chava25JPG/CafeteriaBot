import sys
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Configuración de las credenciales y servicios
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

def obtener_empleados_por_sucursal(sucursal, parent_folder_id):
    # El nombre del archivo ahora incluye el sufijo " (telegram)"
    file_name = f"Personal {sucursal} (telegram)"
    query = f"name='{file_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])
    
    if not files:
        return json.dumps({'status': 'error', 'message': 'Archivo no encontrado'})

    try:
        spreadsheet_id = files[0]['id']
        range_name = 'A3:A'
        result = sheets_service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        empleados = [emp[0] for emp in result.get('values', []) if emp]
        return json.dumps({'status': 'success', 'data': empleados})
    except Exception as e:
        return json.dumps({'status': 'error', 'message': str(e)})

if __name__ == '__main__':
    sucursal = sys.argv[1]
    parent_folder_id = '1QqK-zY5dom7WW-fhfAG5TsYkCml05g8B'
    resultado = obtener_empleados_por_sucursal(sucursal, parent_folder_id)
    print(resultado)  # Solo una impresión del resultado en formato JSON
