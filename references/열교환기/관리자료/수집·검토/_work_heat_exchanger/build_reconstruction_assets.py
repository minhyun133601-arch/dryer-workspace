"""Embed immutable source vectors and explicit reconstruction survey in the local viewer."""
import json, base64, re

def enhance(html, work):
    directory = work/'full_reconstruction'
    survey = json.loads((directory/'front_plan_survey.json').read_text('utf8'))
    pid = json.loads((directory/'pid_catalog.json').read_text('utf8'))
    vectors = {key: 'data:image/svg+xml;base64,'+base64.b64encode((directory/'source_assets'/f'{key}.svg').read_bytes()).decode('ascii') for key in ('front','plan')}
    data = {'survey':survey,'pid':pid,'vectors':vectors}
    html = html.replace('</head>', '<style>'+(work/'3d_assets/reconstruction.css').read_text('utf8')+'</style></head>')
    html = html.replace('</body>', '<script id="reconstruction-data" type="application/json">'+json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+'</script></body>')
    return html
