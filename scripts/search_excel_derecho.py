import openpyxl

file_path = 'backend/exports/DRIVER S.R.L VENTAS.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)
print('Sheets:', wb.sheetnames)
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    for r in range(1, ws.max_row + 1):
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(r, c).value or '').strip()
            if any(k in val.upper() for k in ['DERECHO', 'DEBITO', 'VENTAS NETAS']):
                neighbors = [ws.cell(r, c+i).value for i in range(1, 6)]
                print(f'{sheet_name} R{r}C{c}: {val} -> {neighbors}')
