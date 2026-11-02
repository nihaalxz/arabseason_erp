import json

with open(r'C:\Users\nihaa\.gemini\antigravity\brain\640e936d-fef2-4084-9176-90e97a80fb01\.system_generated\logs\transcript.jsonl', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines[-15:]):
    obj = json.loads(line)
    step = obj.get('step_index')
    src = obj.get('source')
    typ = obj.get('type')
    media = obj.get('media')
    content = str(obj.get('content'))[:120]
    print(f"Step {step} | Src {src} | Typ {typ} | Media {media} | Content: {content}")

