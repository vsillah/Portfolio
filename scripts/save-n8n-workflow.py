#!/usr/bin/env python3
"""Save an n8n workflow JSON (from MCP n8n_get_workflow output) to n8n-exports/.
Usage: echo '{"success":true,"data":{...}}' | python3 scripts/save-n8n-workflow.py
   or: python3 scripts/save-n8n-workflow.py < file.json
"""
import json, sys, os

def save_workflow(data_or_wrapper):
    if isinstance(data_or_wrapper, dict) and 'success' in data_or_wrapper:
        wf = data_or_wrapper.get('data', {})
    else:
        wf = data_or_wrapper

    name = wf.get('name', 'Unknown')
    safe_name = name.replace(':', '').replace(' ', '-').replace('/', '-')
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'n8n-exports')
    out_path = os.path.join(out_dir, f"{safe_name}.json")

    with open(out_path, 'w') as f:
        json.dump(wf, f, indent=2)
    print(f"Saved: {safe_name}.json ({name})")
    return out_path

if __name__ == '__main__':
    content = sys.stdin.read()
    data = json.loads(content)
    save_workflow(data)
