"""Build the A/SHOP logo: a stencilled A whose right foot and the slash form one clay check mark,
followed by SHOP set in Barlow ExtraBold (outlined, so it renders the same everywhere)."""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT = sys.argv[1]; OUT = sys.argv[2]
P = dict(r=43.0, d=None, bar=(57.5, 75.5), cut=57.5, gap=7.5, ov=22.0, track=8.0, lead=17.0)
P.update(json.loads(sys.argv[3]) if len(sys.argv) > 3 else {})

font = TTFont(FONT); gs = font.getGlyphSet(); cmap = font.getBestCmap()
cap = font['OS/2'].sCapHeight; k = 100.0 / cap
def bounds(ch):
    bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp); return bp.bounds
stem = (bounds('I')[2] - bounds('I')[0]) * k
d = P['d'] or round(stem * 1.16, 2)          # a diagonal needs a little more width than an upright stem
r, gap, ov = P['r'], P['gap'], P['ov']
b1, b2 = P['bar']; cut = P['cut']

def poly(pts): return 'M' + 'L'.join('%.2f %.2f' % p for p in pts) + 'Z'
ledge = lambda y: d + r * (100 - y) / 100.0        # inner (right) edge of the left leg
redge = lambda y: r + r * y / 100.0                # inner (left) edge of the right leg
white = [
    poly([(0, 100), (d, 100), (r + d, 0), (r, 0)]),                                   # left leg
    poly([(r, 0), (r + d, 0), (redge(cut - gap) + d, cut - gap), (redge(cut - gap), cut - gap)]),  # top of the right leg
    poly([(ledge(b1) - 1, b1), (redge(b1) - gap, b1), (redge(b2) - gap, b2), (ledge(b2) - 1, b2)]),  # crossbar, stopped short
]
top = lambda y: 2 * r + r * (100 - y) / 100.0      # left edge of the slash
check = [
    poly([(redge(cut), cut), (redge(cut) + d, cut), (2 * r + d, 100), (2 * r, 100)]),  # short arm: the A's right foot
    poly([(2 * r, 100), (2 * r + d, 100), (top(-ov) + d, -ov), (top(-ov), -ov)]),       # long arm: the slash
]
mark_w = top(-ov) + d

x = top(0) + d + P['lead']; letters = []
for ch in 'SHOP':
    g = gs[cmap[ord(ch)]]; pen = SVGPathPen(gs)
    lsb = bounds(ch)[0]
    g.draw(TransformPen(pen, (k, 0, 0, -k, x - lsb * k, 100)))
    letters.append(pen.getCommands()); x += (bounds(ch)[2] - bounds(ch)[0]) * k + P['track']
word_w = x - P['track']

json.dump(dict(white=white, check=check, letters=letters, mark_w=mark_w, word_w=word_w, ov=ov, d=d, stem=stem), open(OUT, 'w'))
print('stem %.1f diag %.1f mark %.1f word %.1f' % (stem, d, mark_w, word_w))
