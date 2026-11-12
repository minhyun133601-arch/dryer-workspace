import json, shutil, re, math
from pathlib import Path
import win32com.client
from openpyxl import load_workbook

root=Path(__file__).resolve().parent.parent
final=root/'outputs'/'2027_KPI_투자근거'/'2027_KPI_투자이행_근거및절감산정.xlsx'
src=load_workbook(final,data_only=False)
cached=load_workbook(final,data_only=True)
assert len(src.sheetnames)==6
ids=[src['투자별근거'].cell(r,1).value for r in range(6,20)]
assert len(set(map(str,ids)))==14
assert sum(src['투자별근거'].cell(r,5).value for r in range(6,20))==1795
assert len([src['보고서검토대장'].cell(r,2).value for r in range(6,55)])==49
for r in range(6,55):
    folder=src['보고서검토대장'].cell(r,13).value
    name=src['보고서검토대장'].cell(r,12).value
    assert (root/folder/name).is_file(),folder
for s in cached:
    for row in s:
        for c in row:
            assert c.data_type!='e',(s.title,c.coordinate,c.value)

temp=root/'_work'/'native_verification.xlsx';shutil.copy2(final,temp)
app=None;book=None
results={'file':str(final),'source_paths_verified':49,'source_investments':14,'native_engine':'Microsoft Excel','checks':[]}
try:
    app=win32com.client.DispatchEx('Excel.Application')
    app.Visible=False;app.DisplayAlerts=False;app.AskToUpdateLinks=False
    book=app.Workbooks.Open(str(temp),UpdateLinks=0,ReadOnly=False,AddToMru=False)
    app.CalculateFull()
    s=book.Worksheets('KPI요약');c=book.Worksheets('절감산정');q=book.Worksheets('2026정량사례')
    expected={'B6':1795,'B7':1620,'B8':175,'B9':20000000,'B10':15000000,'B11':'미확정','B12':'미확정','B13':50000000,'B14':48}
    for addr,val in expected.items():assert s.Range(addr).Value==val,(addr,s.Range(addr).Value,val)
    exq={'G6':4800480,'G7':11400000,'G8':11300000,'G9':12177920,'G10':96000000,'G11':22900000,'G12':32800000,'G13':4676700,'G14':1400000,'G15':1000000,'G16':3188100,'G17':6675000,'G18':5000000,'G19':'미산정','G20':715000,'G21':37500}
    for addr,val in exq.items():
        got=q.Range(addr).Value
        assert got==val or isinstance(val,(int,float)) and math.isclose(got,val,abs_tol=.01),(addr,got,val)
    results['checks'].append('Summary and 16 quantitative source cases recalculated correctly')
    c.Range('C81:C84').Value=((10000,),(8000,),(160,),(50000,))
    c.Range('H22').Value='확인';app.CalculateFull()
    assert c.Range('I22').Value==270000 and s.Range('B11').Value==270000
    c.Range('H22').Value='대기';app.CalculateFull();assert s.Range('B11').Value=='미확정'
    c.Range('D18:F18').Value=((100,120,0),);c.Range('H18').Value='확인';app.CalculateFull()
    assert c.Range('I18').Value==-20 and s.Range('B11').Value==-20
    c.Range('D18').ClearContents();app.CalculateFull();assert c.Range('I18').Value=='미확정'
    c.Range('D41:F41').Value=((1000000,700000,50000),);c.Range('H41').Value='확인';app.CalculateFull()
    assert c.Range('I41').Value==250000 and s.Range('B12').Value==250000
    results['checks'].extend(['Dryer input propagation 270000 KRW','Confirmation gate preserves unconfirmed status','Negative savings -20 preserved','Missing input does not turn into zero','One-off alternative-cost saving 250000 KRW'])
    results['excel_version']=app.Version
finally:
    if book is not None:book.Close(SaveChanges=False)
    if app is not None:app.Quit()
(root/'_work'/'native_workbook_validation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
