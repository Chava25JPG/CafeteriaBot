import sys
import json
from datetime import datetime
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Configuración de las credenciales
SERVICE_ACCOUNT_FILE = './cafeteriabot-423500-4f883c22c073.json'
SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']

credentials = Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)

# Construir el servicio de Google Drive y Google Sheets
drive_service = build('drive', 'v3', credentials=credentials)
sheets_service = build('sheets', 'v4', credentials=credentials)

def obtener_id_hoja(sheet_id):
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=sheet_id).execute()
    sheets = sheet_metadata.get('sheets', '')
    return sheets[0]['properties']['sheetId'] if sheets else None


def buscar_archivo(nombre_archivo, folder_id):
    query = f"name = '{nombre_archivo}' and '{folder_id}' in parents and trashed = false"
    response = drive_service.files().list(q=query).execute()
    files = response.get('files', [])
    return files[0]['id'] if files else None

def leer_datos(sheet_id, range_name):
    result = sheets_service.spreadsheets().values().get(spreadsheetId=sheet_id, range=range_name).execute()
    rows = result.get('values', [])
    return rows if rows else []

def actualizar_datos(sheet_id, range_name, values, value_input_option='USER_ENTERED'):
    body = {'values': values}
    result = sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id, range=range_name, valueInputOption=value_input_option, body=body).execute()
    return result

def formatar_celda(sheet_id, sheet_index, range_name, color):
    requests = [{
        "repeatCell": {
            "range": {
                "sheetId": sheet_index,  # ID de la hoja específica
                "startRowIndex": range_name[1],
                "endRowIndex": range_name[1] + 1,
                "startColumnIndex": range_name[0],
                "endColumnIndex": range_name[0] + 1
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {
                        "red": color[0],
                        "green": color[1],
                        "blue": color[2]
                    }
                }
            },
            "fields": "userEnteredFormat.backgroundColor"
        }
    }]
    body = {'requests': requests}
    response = sheets_service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=body).execute()
    return response

def obtener_lista_empleados(folder_id, archivo_nombre):
    sheet_id = buscar_archivo(archivo_nombre, folder_id)
    if sheet_id:
        datos = leer_datos(sheet_id, 'A3:A')  # Ajusta el rango según tus necesidades para incluir solo nombres
        if datos:
            empleados = [item[0] for item in datos if item]  # Asume que los nombres están en la primera columna
            print(json.dumps(empleados))
        else:
            print(json.dumps([]))
    else:
        print(json.dumps([]))

def registrar_asistencia(folder_id, archivo_nombre, empleado, fecha, hora):
    try:
        sheet_id = buscar_archivo(archivo_nombre, folder_id)
        if not sheet_id:
            print("Archivo no encontrado")
            return

        fecha_columna = datetime.strptime(fecha, "%Y-%m-%d").strftime("%-d/%-m/%Y")  # Formato de fecha D/M/YYYY
        empleados = leer_datos(sheet_id, 'A3:A')
        fechas = leer_datos(sheet_id, 'B1:1')

        # Determinar la columna de la fecha
        if not fechas or fecha_columna not in fechas[0]:
            nueva_columna_index = len(fechas[0]) + 1 if fechas else 2
            actualizar_datos(sheet_id, f'R1C{nueva_columna_index}', [[fecha_columna]], 'RAW')
        else:
            nueva_columna_index = fechas[0].index(fecha_columna) + 2

        # Encontrar la fila del empleado
        empleado_indices = [idx for idx, val in enumerate(empleados) if val and val[0] == empleado]
        if empleado_indices:
            fila_empleado = empleado_indices[0] + 3

            actualizar_datos(sheet_id, f'R{fila_empleado}C{nueva_columna_index}', [[hora]])
            sheet_index = obtener_id_hoja(sheet_id)  # Obtener el ID de la hoja específica
            if sheet_index is not None:
                formatar_celda(sheet_id, sheet_index, (nueva_columna_index - 1, fila_empleado - 1), (0, 1, 0))
            print("Asistencia registrada")
        else:
            print("Empleado no encontrado")
    except Exception as e:
        print(f"Error registrando asistencia: {str(e)}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'listar':
            folder_id = sys.argv[2]
            archivo_nombre = sys.argv[3]
            obtener_lista_empleados(folder_id, archivo_nombre)
        elif command == 'asistencia':
            folder_id = sys.argv[2]
            archivo_nombre = sys.argv[3]
            empleado = sys.argv[4]
            fecha = sys.argv[5]
            hora = sys.argv[6]
            registrar_asistencia(folder_id, archivo_nombre, empleado, fecha, hora)