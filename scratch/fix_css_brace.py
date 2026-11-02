with open('frontend/src/index.css', 'r', encoding='utf-8') as f:
    text = f.read()

if text.endswith('}\n}\n'):
    text = text[:-2]
    with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed extra closing brace at end of index.css")
elif text.endswith('}\n}'):
    text = text[:-1]
    with open('frontend/src/index.css', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed extra closing brace at end of index.css")
else:
    print("Pattern not matched")

