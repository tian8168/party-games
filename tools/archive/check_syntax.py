import re
import sys

files_to_check = [
    'index.html',
    'games/liarsdice.html',
    'games/iaido.html',
    'common/network.js',
    'sw.js',
    'games/js/liarsdice.js',
    'games/js/iaido.js'
]

def check_brackets(code, filename):
    i = 0
    n = len(code)
    stack = []
    line = 1
    col = 1
    while i < n:
        c = code[i]
        if c == '\n':
            line += 1
            col = 1
            i += 1
            continue
        # Line comment
        if c == '/' and i + 1 < n and code[i+1] == '/':
            while i < n and code[i] != '\n':
                i += 1
            continue
        # Block comment
        if c == '/' and i + 1 < n and code[i+1] == '*':
            i += 2
            while i + 1 < n and not (code[i] == '*' and code[i+1] == '/'):
                if code[i] == '\n': line += 1
                i += 1
            i += 2
            continue
        # Strings
        if c in ('"', "'"):
            quote = c
            i += 1
            while i < n and code[i] != quote:
                if code[i] == '\\':
                    i += 2
                elif code[i] == '\n':
                    print(f'{filename}:{line}:{col} - unescaped newline in string')
                    return False
                else:
                    i += 1
            i += 1
            continue
        # Template literal
        if c == '`':
            i += 1
            while i < n and code[i] != '`':
                if code[i] == '\\':
                    i += 2
                elif code[i] == '\n':
                    line += 1
                    i += 1
                else:
                    i += 1
            i += 1
            continue
        # Brackets
        if c in '({[':
            stack.append((c, line, col))
        elif c in ')}]':
            if not stack:
                print(f'{filename}:{line}:{col} - Extra closing bracket {c}')
                return False
            top, tl, tc = stack.pop()
            matches = {')': '(', '}': '{', ']': '['}
            if matches[c] != top:
                print(f'{filename}:{line}:{col} - Mismatched bracket {c}, expected close for {top} at line {tl}')
                return False
        i += 1
        col += 1
    if stack:
        print(f'{filename} - Unclosed brackets: {stack}')
        return False
    return True

all_ok = True
for f in files_to_check:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    if f.endswith('.html'):
        scripts = re.findall(r'<script(?:\s+[^>]*)?>(.*?)</script>', content, re.DOTALL)
        for idx, s in enumerate(scripts):
            if not check_brackets(s, f'{f}#script{idx}'):
                all_ok = False
    else:
        if not check_brackets(content, f):
            all_ok = False

if all_ok:
    print('ALL JAVASCRIPT CODE CHUNKS HAVE BALANCED SYNTAX!')
else:
    sys.exit(1)
