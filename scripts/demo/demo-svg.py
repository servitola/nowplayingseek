"""ANSI text on stdin -> a terminal card as SVG on stdout. Used for docs/images/demo.svg."""
import sys, re, html
ESC = '\x1b'
# Gruvbox Dark, the bright row: the painters use the terminal's sixteen colours, a picture has to pick a theme.
COLOURS = {'31': '#fb4934', '32': '#b8bb26', '33': '#fabd2f', '34': '#83a598', '35': '#d3869b', '36': '#8ec07c'}
lines = sys.stdin.read().rstrip('\n').split('\n')

def spans(line):
    out, style = [], {}
    for part in re.split('(' + ESC + r'\[[0-9;]*m)', line):
        code = re.fullmatch(ESC + r'\[([0-9;]*)m', part)
        if code:
            c = code.group(1)
            if c in ('0', ''): style = {}
            elif c == '1': style['font-weight'] = '700'
            elif c == '2': style['fill-opacity'] = '0.5'
            elif c in COLOURS: style['fill'] = COLOURS[c]
        elif part:
            attrs = ''.join(f' {k}="{v}"' for k, v in style.items())
            out.append(f'<tspan{attrs}>{html.escape(part)}</tspan>')
    return ''.join(out)

cw, lh, pad = 8.43, 21, 22
plain = [re.sub(ESC + r'\[[0-9;]*m', '', l) for l in lines]
w = int(max(len(p) for p in plain) * cw + pad * 2)
h = int(len(lines) * lh + pad * 2 + 18)
body = []
for i, l in enumerate(lines):
    y = pad + 28 + i * lh
    if l.startswith('$ '):
        command, _, rest = l[2:].partition(' ')
        text = (f'<tspan fill="#83a598">❯ </tspan><tspan fill="#b8bb26" font-weight="700">{html.escape(command)}</tspan>'
                f'<tspan> {html.escape(rest)}</tspan>')
    else:
        text = spans(l)
    body.append(f'<text x="{pad}" y="{y}" xml:space="preserve">{text}</text>')
label = sys.argv[1] if len(sys.argv) > 1 else 'terminal'
print(f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{html.escape(label)}">
<rect width="{w}" height="{h}" rx="10" fill="#282828"/>
<g fill="#504945"><circle cx="20" cy="18" r="5"/><circle cx="38" cy="18" r="5"/><circle cx="56" cy="18" r="5"/></g>
<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="14" fill="#ebdbb2">
{chr(10).join(body)}
</g>
</svg>''')
