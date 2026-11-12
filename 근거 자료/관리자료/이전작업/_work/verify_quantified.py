import json, math, shutil
from pathlib import Path
from openpyxl import load_workbook
import win32com.client

root=Path(__file__).resolve().parent.parent
file=root/'outputs'/'2027_투자효과_정량보강'/'2027_투자효과_미실행손실_정량보강.xlsx'
work=root/'_work'/'quantified_native_check.xlsx'
source=load_workbook(file,data_only=False)
cached=load_workbook(file,data_only=True)
assert source.sheetnames==['투자효과비교','단건산정']
assert sum(source['단건산정'].cell(r,2).value for r in range(90,104))==1795000000
for s in cached:
    for row in s:
        for c in row:
            assert c.data_type!='e',(s.title,c.coordinate,c.value)
shutil.copy2(file,work)
app=book=None
result={'native_engine':'Microsoft Excel','checks':[]}
def check(s,a,want):
    got=s.Range(a).Value
    if isinstance(want,(int,float)):
        assert isinstance(got,(int,float)) and math.isclose(got,want,abs_tol=.001),(s.Name,a,got,want)
    else: assert got==want,(s.Name,a,got,want)
try:
    app=win32com.client.DispatchEx('Excel.Application')
    app.Visible=False;app.DisplayAlerts=False;app.AskToUpdateLinks=False
    book=app.Workbooks.Open(str(work),UpdateLinks=0,ReadOnly=False,AddToMru=False)
    app.CalculateFull()
    s=book.Worksheets('투자효과비교');c=book.Worksheets('단건산정')
    for a,v in {'D6':2000,'D7':7000,'D8':4800,'D9':550,'D10':900,'D11':667.5,'B13':1500,'E13':3.5,'E14':-5500,'C22':1400,'C28':700/3}.items():check(s,a,v)
    for a,v in {'B18':30000000,'B30':190000000,'B32':50000000,'B41':48000000,'B47':9.375,'B55':5500000,'B56':350,'B57':350000000/5.5,'B66':32800000,'B77':2675000,'B81':6675000,'B105':1795000000,'B46':'미산정','B60':'미산정','B70':'미산정','B84':'미산정'}.items():check(c,a,v)
    result['checks'].append('Headline values, 14 source budgets and seven recovery thresholds match independent calculations')
    c.Range('B11').Value=2000000;app.CalculateFull();check(c,'B12',18000000);check(c,'B14',70000000/18000000)
    c.Range('B11').Value=0;app.CalculateFull();check(c,'B12',20000000);check(c,'B14',3.5)
    c.Range('B11').ClearContents();app.CalculateFull();check(c,'B14','미산정')
    c.Range('B8').Value=0;app.CalculateFull();check(s,'B13',2000)
    c.Range('B8').Value=12;app.CalculateFull();check(s,'B13',0)
    c.Range('B8').Value=3
    result['checks'].append('Dryer extra cost, blank versus zero, and completion-month boundaries recalculate')
    s.Range('B18').Value=5;app.CalculateFull();check(s,'C28',140);check(s,'C22',840)
    s.Range('B18').Value=0;app.CalculateFull();check(s,'C28','기간 확인')
    s.Range('B18').Value=3
    result['checks'].append('Review horizon updates all threshold rows and zero does not divide by zero')
    c.Range('B44').Value=1;c.Range('B45').Value=48000000;app.CalculateFull();check(c,'B46',48000000)
    c.Range('B44').Value=0;app.CalculateFull();check(c,'B46',0)
    c.Range('B44:B45').ClearContents();app.CalculateFull();check(c,'B46','미산정')
    result['checks'].append('Labor cash savings require both verified inputs; zero and missing remain distinct')
    c.Range('B53').Value=2000000;app.CalculateFull();check(s,'D9',1100);check(c,'B56',175)
    assert '200만원' in s.Range('F9').Value,s.Range('F9').Value
    c.Range('B53').Value=0;app.CalculateFull();check(s,'D9',0);check(c,'B56','회수 불가')
    c.Range('B53').Value=1000000
    c.Range('B58').Value=10;c.Range('B59').Value=1000000;app.CalculateFull();check(c,'B60',10000000)
    c.Range('B58:B59').ClearContents();app.CalculateFull();check(c,'B60','미산정')
    result['checks'].append('PLC unit-cost changes update amount, threshold and explanatory text')
    c.Range('B68').Value='확인';c.Range('B69').Value=1000000;app.CalculateFull();check(c,'B70',8000000)
    c.Range('B69').Value=10000000;app.CalculateFull();check(c,'B70',-1000000)
    c.Range('B68').Value='미확인';c.Range('B69').ClearContents();app.CalculateFull();check(c,'B70','미산정')
    c.Range('B82').Value=100;c.Range('B83').Value=200;app.CalculateFull();check(c,'B84',300)
    c.Range('B82:B83').ClearContents();app.CalculateFull();check(c,'B84','미산정')
    result['checks'].append('Spare-scope gate, negative savings and disposal comparison recalculate correctly')
    for sheet in [s,c]:
        values=sheet.UsedRange.Value
        for vals in values:
            for v in vals:
                assert v not in ('#REF!','#DIV/0!','#VALUE!','#NAME?','#N/A','#NUM!','#NULL!','#SPILL!','#CALC!'),(sheet.Name,v)
    result['excel_version']=app.Version
finally:
    if book is not None:book.Close(SaveChanges=False)
    if app is not None:app.Quit()
(root/'_work'/'quantified_native_validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(result,ensure_ascii=False,indent=2))
