#!/usr/bin/env python3
"""重构仓库结构：清理根目录重复文件，建立层级目录"""
import json, urllib.request, ssl, base64, os

with open(r'D:\ReimbursementSystem\token.txt', 'rb') as f:
    raw = f.read()
TOKEN = raw.decode('utf-16').strip() if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else raw.decode().strip()

CTX = ssl._create_unverified_context()
OWNER, REPO = 'CHsd-jpg', 'mci-reimb'

def gh(method, path, data=None):
    url = f'https://api.github.com/repos/{OWNER}/{REPO}/{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Authorization', f'Bearer {TOKEN}')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {'err': e.code, 'body': e.read().decode()[:150]}

def sha_of(path):
    r = gh('GET', f'contents/{path}')
    return r.get('sha') if isinstance(r, dict) else None

def upload_file(local, remote):
    with open(local, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    data = {'message': f'add {remote}', 'content': b64}
    s = sha_of(remote)
    if s:
        data['sha'] = s
    r = gh('PUT', f'contents/{remote}', data)
    if 'commit' in r:
        print(f'  OK {remote}')
    else:
        error = r.get('err', r.get('message', '?'))
        if error == 422:
            print(f'  EXISTS {remote}')
        else:
            print(f'  FAIL {remote}: {error}')

def delete_path(path):
    s = sha_of(path)
    if not s:
        return False
    r = gh('DELETE', f'contents/{path}', {'message': f'clean {path}', 'sha': s})
    if 'commit' in r:
        print(f'  DEL {path}')
        return True
    return False

BASE = r'D:\ReimbursementSystem'

print('=== 1. 删除根目录重复文件 ===')
for p in ['index.html', 'build.py']:
    delete_path(p)
for p in ['css', 'js']:
    delete_path(p)

print('\n=== 2. 上传文件到正确位置 ===')
upload_file(os.path.join(BASE, 'worker_complete.js'), 'worker/worker_complete.js')
upload_file(os.path.join(BASE, 'scripts', 'build.py'), 'scripts/build.py')

# README
readme = '''# MCI 报销系统

广东多机位影像科技有限公司 — 企业报销数字化管理

## 目录结构

```
mci-reimb/
├── frontend/           # 前端源码（GitHub Pages）
│   ├── index.html
│   ├── css/main.css
│   └── js/api.js, app.js
├── worker/             # Cloudflare Worker
│   └── worker_complete.js
├── scripts/            # 构建/部署脚本
│   ├── build.py
│   └── reorg_repo.py
├── docs/               # 文档
├── .gitignore
└── README.md
```

## 子项目

| 项目 | 目录 | 状态 |
|------|------|------|
| 报销管理 | frontend/ + worker/ | 开发中 |
| (后续项目) | ... | |

## 部署

部署文档见 docs/ 目录。
'''
data = {'message': 'add README.md', 'content': base64.b64encode(readme.encode()).decode()}
s = sha_of('README.md')
if s:
    data['sha'] = s
r = gh('PUT', 'contents/README.md', data)
print(f'  OK README.md' if 'commit' in r else f'  README: {r}')

print('\n=== 3. 配置 GitHub Pages ===')
r = gh('POST', 'pages', {'source': {'branch': 'main', 'path': '/frontend'}})
url = r.get('html_url', '')
if url:
    print(f'  Pages: {url}')
else:
    print(f'  已配置或出错: {r.get("err", "")}')

print('\n=== 4. 最终仓库结构 ===')
tree = gh('git/trees/main?recursive=1')
for t in tree['tree']:
    if t['type'] == 'blob':
        print(f'  {t["path"]}')

print(f'\n✅ 完成: {url or "https://chsd-jpg.github.io/mci-reimb/"}')
