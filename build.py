#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MCI 报销系统 — 构建脚本
用途：读取前端文件，生成可直接部署到 Cloudflare Worker 的完整代码
"""

import json
import os
import base64
import re

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), 'frontend')
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), 'worker_complete.js')

# 需要嵌入的前端文件
FILES_TO_EMBED = {
    'index.html': 'index.html',
    'css/main.css': os.path.join('css', 'main.css'),
    'js/api.js': os.path.join('js', 'api.js'),
    'js/app.js': os.path.join('js', 'app.js'),
}

def read_file(relative_path):
    """读取前端文件，返回字符串"""
    full_path = os.path.join(FRONTEND_DIR, relative_path)
    with open(full_path, 'r', encoding='utf-8') as f:
        return f.read()

def build_worker():
    """构建完整的Worker JS代码"""
    
    # 1. 读取所有前端文件
    embedded = {}
    for key, rel_path in FILES_TO_EMBED.items():
        try:
            content = read_file(rel_path)
            embedded[key] = content
            print(f"  ✅ {key} ({len(content)} bytes)")
        except FileNotFoundError:
            print(f"  ❌ {key} not found")
            embedded[key] = ''
    
    # 2. 构建Worker代码
    worker_code = f'''// MCI报销系统 — Cloudflare Worker（自动构建）
const EMBEDDED = {json.dumps(embedded, ensure_ascii=False, indent=2)};

// ===== 环境变量（在Cloudflare Dashboard设置）=====
// APP_ID, APP_SECRET, APP_TOKEN, JODOO_URL

let tokenCache = {{ token: null, expires: 0 }};

async function getToken(env) {{
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const r = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {{
    method: 'POST',
    headers: {{ 'Content-Type': 'application/json' }},
    body: JSON.stringify({{ app_id: env.APP_ID, app_secret: env.APP_SECRET }})
  }});
  const d = await r.json();
  if (d.code !== 0) throw new Error('Feishu auth: ' + d.msg);
  tokenCache = {{ token: d.tenant_access_token, expires: Date.now() + (d.expire - 120) * 1000 }};
  return tokenCache.token;
}}

const cors = {{
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}};

function json(data, status) {{
  return new Response(JSON.stringify(data), {{
    status: status || 200,
    headers: {{ ...cors, 'Content-Type': 'application/json; charset=utf-8' }}
  }});
}}

const MIME = {{ html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'application/javascript; charset=utf-8' }};

export default {{
  async fetch(request, env) {{
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {{ headers: cors }});

    try {{
      const path = url.pathname;

      // 飞书Bitable代理
      if (path.startsWith('/api/feishu/')) {{
        if (!env.APP_TOKEN) return json({{ error: 'APP_TOKEN 未配置' }}, 500);
        const token = await getToken(env);
        const targetPath = '/open-apis/bitable/v1' + path.replace('/api/feishu', '');
        const body = ['GET','HEAD'].includes(request.method) ? null : await request.text();
        const fr = await fetch('https://open.feishu.cn' + targetPath, {{
          method: request.method,
          headers: {{ 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }},
          body,
        }});
        return new Response(await fr.text(), {{
          status: fr.status,
          headers: {{ ...cors, 'Content-Type': 'application/json; charset=utf-8' }}
        }});
      }}

      // 简道云接口预留
      if (path.startsWith('/api/jodoo/')) {{
        if (!env.JODOO_URL) return json({{ error: '简道云接口未配置' }}, 501);
        const body = ['GET','HEAD'].includes(request.method) ? null : await request.text();
        const fr = await fetch(env.JODOO_URL + path.replace('/api/jodoo', ''), {{
          method: request.method,
          headers: {{ 'Content-Type': 'application/json' }},
          body,
        }});
        return new Response(await fr.text(), {{
          status: fr.status,
          headers: {{ ...cors, 'Content-Type': 'application/json; charset=utf-8' }}
        }});
      }}

      // 前端静态文件
      let fileName = '';
      if (path === '/' || path === '/index.html') fileName = 'index.html';
      else if (path.startsWith('/css/')) fileName = path.substring(1);
      else if (path.startsWith('/js/')) fileName = path.substring(1);

      if (fileName && EMBEDDED[fileName]) {{
        const ext = fileName.split('.').pop();
        return new Response(EMBEDDED[fileName], {{
          headers: {{ 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'public, max-age=3600' }}
        }});
      }}

      // SPA fallback
      if (EMBEDDED['index.html']) {{
        return new Response(EMBEDDED['index.html'], {{
          headers: {{ 'Content-Type': 'text/html; charset=utf-8' }}
        }});
      }}

      return json({{ error: 'Not found' }}, 404);

    }} catch (e) {{
      return json({{ error: e.message }}, 500);
    }}
  }}
}};
'''
    
    # 3. 写入输出文件
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(worker_code)
    
    size_kb = len(worker_code) / 1024
    print(f'\n✅ 构建完成: {OUTPUT_FILE}')
    print(f'   文件大小: {size_kb:.1f} KB')
    print(f'   Cloudflare Worker 限制: 1MB = 1024KB')
    print(f'   剩余空间: {1024 - size_kb:.1f} KB')

def main():
    print('MCI 报销系统 — 构建脚本')
    print('=' * 40)
    print('正在嵌入前端文件...')
    build_worker()
    print('=' * 40)
    print('部署步骤：')
    print('1. 打开 https://dash.cloudflare.com')
    print('2. Workers → 创建 → 粘贴 worker_complete.js')
    print('3. 设置环境变量: APP_ID, APP_SECRET, APP_TOKEN')
    print('4. 部署')
    print('5. 飞书开发者后台 → YK助手 → 网页应用 → 填Worker地址')

if __name__ == '__main__':
    main()
