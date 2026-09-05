import ast
import pathlib

for p in pathlib.Path(".").rglob("*.py"):
    try:
        ast.parse(p.read_text())
        print(f"OK: {p}")
    except SyntaxError as e:
        print(f"SYNTAX ERROR in {p}: {e}")
