# 后端目录结构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将散落在仓库根目录的 Python 后端代码统一迁移到 `backend/` 目录，并修正所有内部 import 路径，确保后端可正常启动、测试可通过。

**Architecture:** 采用"完全平移"策略，所有后端文件和目录原样移入 `backend/`，仅做必要的 `backend.` 前缀 import 修正；前端、Docker、文档、配置保持在根目录不动。

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy, LangChain, uv, pytest; 前端使用 Vite + React + TypeScript，本次不改动。

## Global Constraints

- 本次为"最小改造"，不拆分独立 Python 包，不做 Clean Architecture 重构。
- `pyproject.toml` 与 `uv.lock` 保留在仓库根目录。
- 前端代码与 API 路径保持不变。
- 所有文件移动使用 `git mv` 以保留历史。
- `example.db` 本次不处理，保持现状。
- 每次任务完成后必须提交（frequent commits）。

---

## File Structure

迁移后的关键文件分布：

```
agent_project/
├── pyproject.toml                # 保留根目录
├── uv.lock                       # 保留根目录
├── README.md                     # 修改启动命令
├── frontend/                     # 不动
├── backend/                      # 新增后端根目录
│   ├── __init__.py
│   ├── api_main.py
│   ├── main.py
│   ├── config.py
│   ├── core/
│   ├── models/
│   ├── router/
│   ├── schemas/
│   ├── service/
│   ├── src/
│   │   └── agent/
│   ├── utils/
│   └── tests/
└── scripts/                      # 由 script/ 重命名
```

---

## Task 1: 创建 backend 目录并迁移入口文件

**Files:**
- Create: `backend/__init__.py`
- Move: `api_main.py` → `backend/api_main.py`
- Move: `main.py` → `backend/main.py`
- Move: `config.py` → `backend/config.py`
- Modify: `backend/api_main.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: 无
- Produces: `backend` 成为可 import 的 Python 包；`backend.api_main:create_app` 可作为 uvicorn 入口。

- [ ] **Step 1: 创建 backend 目录并添加 `__init__.py`**

```bash
mkdir -p backend
touch backend/__init__.py
```

- [ ] **Step 2: 使用 git mv 迁移入口文件**

```bash
git mv api_main.py backend/api_main.py
git mv main.py backend/main.py
git mv config.py backend/config.py
```

- [ ] **Step 3: 修正 `backend/api_main.py` 的 import 与 uvicorn 入口字符串**

修改前：

```python
from core.database import init_db, dispose_db
from router import chat_app
from models.base import Base
```

修改后：

```python
from backend.core.database import init_db, dispose_db
from backend.router import chat_app
from backend.models.base import Base
```

并将 `uvicorn.run("api_main:create_app", ...)` 改为：

```python
uvicorn.run("backend.api_main:create_app", ...)
```

完整文件关键片段应如下：

```python
from backend.core.database import init_db, dispose_db
from backend.router import chat_app
from backend.models.base import Base

# ... lifespan, create_app ...

if __name__ == '__main__':
    uvicorn.run(
        "backend.api_main:create_app",
        host="0.0.0.0",
        port=8000,
        env_file=".env"
    )
```

- [ ] **Step 4: 修正 `backend/main.py` 的 import**

修改前：

```python
from src.agent.chat.chat import chat
from src.agent.core.config import config
from src.agent.core.llm import get_embeddings
from src.agent.rag.retrieval.retriever import retrieve_query
from src.agent.rag.storage.vectorstore import embedding_data
```

修改后：

```python
from backend.src.agent.chat.chat import chat
from backend.src.agent.core.config import config
from backend.src.agent.core.llm import get_embeddings
from backend.src.agent.rag.retrieval.retriever import retrieve_query
from backend.src.agent.rag.storage.vectorstore import embedding_data
```

- [ ] **Step 5: 验证入口文件可以正确导入**

```bash
uv run python -c "from backend.api_main import create_app; from backend.main import chat, config, get_embeddings; print('Task 1 OK')"
```

Expected output:

```
Task 1 OK
```

> 注意：`create_app` 不会触发数据库连接，因此该命令不需要真实数据库即可运行。

- [ ] **Step 6: 提交**

```bash
git add backend/__init__.py backend/api_main.py backend/main.py backend/config.py
git commit -m "refactor: move backend entry files into backend/ directory

- Move api_main.py, main.py, config.py into backend/
- Update imports to use backend.* prefix
- Update uvicorn entry string to backend.api_main:create_app

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 迁移核心模块并修正 import

**Files:**
- Move: `core/` → `backend/core/`
- Move: `models/` → `backend/models/`
- Move: `router/` → `backend/router/`
- Move: `schemas/` → `backend/schemas/`
- Move: `service/` → `backend/service/`
- Move: `utils/` → `backend/utils/`
- Modify: `backend/api_main.py`（补充确认）
- Modify: `backend/router/chat.py`
- Modify: `backend/models/chat_model.py`
- Modify: `backend/service/model.py`

**Interfaces:**
- Consumes: `backend` 包（Task 1 完成）
- Produces: 后端核心模块全部位于 `backend.*` 命名空间下，路由可被 `backend.router.chat.chat_app` 导入。

- [ ] **Step 1: 使用 git mv 迁移核心模块**

```bash
git mv core backend/core
git mv models backend/models
git mv router backend/router
git mv schemas backend/schemas
git mv service backend/service
git mv utils backend/utils
```

- [ ] **Step 2: 修正 `backend/router/chat.py` 的 import**

修改前：

```python
from core.database import get_db
from schemas.response import Response
from service import call_llm
from utils.stream_manage import sm
from models.chat_model import Sessions
```

修改后：

```python
from backend.core.database import get_db
from backend.schemas.response import Response
from backend.service import call_llm
from backend.utils.stream_manage import sm
from backend.models.chat_model import Sessions
```

- [ ] **Step 3: 修正 `backend/models/chat_model.py` 的 import**

修改前：

```python
from models.base import Base
```

修改后：

```python
from backend.models.base import Base
```

- [ ] **Step 4: 修正 `backend/service/model.py` 的 import**

修改前：

```python
from config import Settings
```

修改后：

```python
from backend.config import Settings
```

- [ ] **Step 5: 验证核心模块导入无报错**

```bash
uv run python -c "from backend.router.chat import chat_app; from backend.models.chat_model import Sessions; from backend.service import call_llm; from backend.schemas.response import Response; print('Task 2 OK')"
```

Expected output:

```
Task 2 OK
```

- [ ] **Step 6: 提交**

```bash
git add backend/core backend/models backend/router backend/schemas backend/service backend/utils
git commit -m "refactor: move core backend modules into backend/ and update imports

- Move core/, models/, router/, schemas/, service/, utils/ into backend/
- Update all internal imports to backend.* prefix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 迁移 agent 模块并修正 import

**Files:**
- Move: `src/agent/` → `backend/src/agent/`
- Modify: `backend/main.py`（已在 Task 1 完成，这里验证即可）
- Modify: `backend/src/agent/chat/chat.py`
- Modify: `backend/src/agent/core/llm.py`
- Modify: `backend/src/agent/tools/builtIn.py`
- Modify: `backend/src/agent/rag/storage/vectorstore.py`

**Interfaces:**
- Consumes: `backend` 包（Task 1 完成）
- Produces: Agent / RAG 模块位于 `backend.src.agent.*` 命名空间下。

- [ ] **Step 1: 使用 git mv 迁移 agent 目录**

```bash
# 先确保 backend/src/ 存在
mkdir -p backend/src
git mv src/agent backend/src/agent
# 如果 src/ 目录已空，删除它
rmdir src 2>/dev/null || true
```

- [ ] **Step 2: 修正 `backend/src/agent/chat/chat.py` 的 import**

修改前：

```python
from src.agent.core.llm import create_llm
from src.agent.tools.builtIn import retrieve_tool, web_search_by_tavily
```

修改后：

```python
from backend.src.agent.core.llm import create_llm
from backend.src.agent.tools.builtIn import retrieve_tool, web_search_by_tavily
```

- [ ] **Step 3: 修正 `backend/src/agent/core/llm.py` 的 import**

修改前：

```python
from src.agent.core.config import config
```

修改后：

```python
from backend.src.agent.core.config import config
```

- [ ] **Step 4: 修正 `backend/src/agent/tools/builtIn.py` 的 import**

修改前：

```python
from src.agent.core.llm import get_embeddings
from src.agent.rag.retrieval.retriever import retrieve_query
from src.agent.core.config import config
```

修改后：

```python
from backend.src.agent.core.llm import get_embeddings
from backend.src.agent.rag.retrieval.retriever import retrieve_query
from backend.src.agent.core.config import config
```

- [ ] **Step 5: 修正 `backend/src/agent/rag/storage/vectorstore.py` 的 import**

修改前：

```python
from src.agent.rag.ingestion.loader import Loader
from src.agent.common.utils import chunk_add_metadata
```

修改后：

```python
from backend.src.agent.rag.ingestion.loader import Loader
from backend.src.agent.common.utils import chunk_add_metadata
```

- [ ] **Step 6: 验证 agent 模块导入无报错**

```bash
uv run python -c "from backend.src.agent.chat.chat import chat; from backend.src.agent.core.llm import create_llm, get_embeddings; from backend.src.agent.tools.builtIn import retrieve_tool, web_search_by_tavily; print('Task 3 OK')"
```

Expected output:

```
Task 3 OK
```

- [ ] **Step 7: 提交**

```bash
git add backend/src/agent
git commit -m "refactor: move agent module into backend/src/agent and update imports

- Move src/agent/ into backend/src/agent/
- Update all agent internal imports to backend.src.agent.* prefix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 迁移测试并修正 import

**Files:**
- Move: `tests/` → `backend/tests/`
- Modify: `backend/tests/test_chat_stream.py`

**Interfaces:**
- Consumes: `backend.api_main:create_app`、`backend.router.chat.ChatRequest`、`backend.router.chat.event_stream_task`、`backend.utils.stream_manage.sm`（Task 1-3 完成）
- Produces: 后端测试位于 `backend/tests/`，运行命令为 `uv run pytest backend/tests`。

- [ ] **Step 1: 使用 git mv 迁移测试目录**

```bash
git mv tests backend/tests
```

- [ ] **Step 2: 重写 `backend/tests/test_chat_stream.py`**

删除 `sys.path.insert` 逻辑，并把绝对 import 加上 `backend.` 前缀。

修改前：

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
import pytest

from api_main import create_app
from router.chat import ChatRequest, event_stream_task
from utils.stream_manage import sm
```

修改后：

```python
import asyncio
import json
from unittest.mock import patch

import httpx
import pytest

from backend.api_main import create_app
from backend.router.chat import ChatRequest, event_stream_task
from backend.utils.stream_manage import sm
```

文件最终内容应为：

```python
import asyncio
import json
from unittest.mock import patch

import httpx
import pytest

from backend.api_main import create_app
from backend.router.chat import ChatRequest, event_stream_task
from backend.utils.stream_manage import sm


class FakeChunk:
    def json(self):
        return json.dumps({"choices": [{"delta": {"content": "hi"}}]})


async def fake_call_llm(*_args, **_kwargs):
    yield FakeChunk()
    yield FakeChunk()


def test_subscript_exits_after_llm_finishes():
    """LLM 流正常结束后，subscript 生成器必须退出并发出 [DONE] 标记。"""

    async def run():
        request = ChatRequest(message="hello")
        with patch("backend.router.chat.call_llm", fake_call_llm):
            task_id = sm.create_stream_task(event_stream_task, request=request)
            chunks = []
            async for chunk in sm.subscript(task_id):
                chunks.append(chunk)
        return chunks

    chunks = asyncio.run(run())

    assert len(chunks) == 3
    assert "data: [DONE]" in chunks[-1]


@pytest.mark.anyio
async def test_http_stream_closes_when_llm_finishes():
    """通过 HTTP SSE 接口验证 LLM 流结束后响应自动关闭。"""
    with patch("backend.router.chat.call_llm", fake_call_llm):
        transport = httpx.ASGITransport(app=create_app())
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            async with client.stream("POST", "/chat/stream", json={"message": "hello"}) as response:
                response.raise_for_status()
                body = b""
                async for chunk in response.aiter_bytes():
                    body += chunk

    assert b"event: token" in body
    assert b"data: [DONE]" in body
```

> 注意：`with patch("router.chat.call_llm", ...)` 也需要改为 `with patch("backend.router.chat.call_llm", ...)`。

- [ ] **Step 3: 运行后端测试**

```bash
uv run pytest backend/tests -v
```

Expected output:

```
backend/tests/test_chat_stream.py::test_subscript_exits_after_llm_finishes PASSED
backend/tests/test_chat_stream.py::test_http_stream_closes_when_llm_finishes PASSED
```

- [ ] **Step 4: 提交**

```bash
git add backend/tests
git commit -m "refactor: move python tests into backend/tests and update imports

- Move tests/ into backend/tests/
- Remove sys.path workaround
- Update imports and patch targets to backend.* prefix

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 重命名 script 目录并更新 README

**Files:**
- Move: `script/` → `scripts/`
- Modify: `README.md`

**Interfaces:**
- Consumes: 无
- Produces: 仓库根目录使用 `scripts/` 复数命名；`README.md` 启动命令指向 `backend/api_main.py`。

- [ ] **Step 1: 使用 git mv 重命名 script 目录**

```bash
git mv script scripts
```

如果 `script/` 为空，git mv 可能不保留空目录。此时直接创建 `scripts/.gitkeep`：

```bash
mkdir -p scripts
touch scripts/.gitkeep
git add scripts/.gitkeep
```

- [ ] **Step 2: 更新 `README.md` 启动命令**

修改前：

```markdown
```Shell
uv run api_main.py
```
```

修改后：

```markdown
```Shell
uv run python backend/api_main.py
```
```

- [ ] **Step 3: 最终验证**

运行后端测试：

```bash
uv run pytest backend/tests -v
```

Expected output:

```
backend/tests/test_chat_stream.py::test_subscript_exits_after_llm_finishes PASSED
backend/tests/test_chat_stream.py::test_http_stream_closes_when_llm_finishes PASSED
```

验证前端测试不受影响（如果前端有测试）：

```bash
pnpm --dir frontend test --run
```

Expected output: 前端测试通过或无测试文件（`No test files found` 也可接受）。

验证根目录结构正确：

```bash
ls -la
```

Expected: 根目录下应存在 `backend/`、`frontend/`、`scripts/`、`docker/`、`docs/`，不应再存在 `api_main.py`、`main.py`、`config.py`、`core/`、`models/`、`router/`、`schemas/`、`service/`、`utils/`、`src/`、`tests/`、`script/`。

- [ ] **Step 4: 提交**

```bash
git add scripts/ README.md
git commit -m "docs: update README and rename script/ to scripts/

- Rename script/ to scripts/ to match common conventions
- Update README.md launch command to backend/api_main.py

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Post-Task Verification Checklist

所有任务完成后，运行以下最终检查：

- [ ] 后端模块可导入：
  ```bash
  uv run python -c "from backend.api_main import create_app; print('import ok')"
  ```
- [ ] 后端测试通过：
  ```bash
  uv run pytest backend/tests -v
  ```
- [ ] 前端测试通过：
  ```bash
  pnpm --dir frontend test --run
  ```
- [ ] Git 状态干净：
  ```bash
  git status
  ```
- [ ] 根目录下没有遗留的后端 Python 文件：
  ```bash
  ls *.py 2>/dev/null || echo "No python files in root"
  ```
  Expected: `No python files in root`

---

## Self-Review

**1. Spec coverage:**
- ✅ 创建 `backend/` 目录并迁移后端代码：Task 1-3
- ✅ 修正 import 路径：每个 Task 都包含具体修改
- ✅ 迁移测试到 `backend/tests/`：Task 4
- ✅ 重命名 `script/` → `scripts/`：Task 5
- ✅ 更新 `README.md`：Task 5
- ✅ 保留 `pyproject.toml`、`.env`、前端、Docker、文档在根目录：Global Constraints + File Structure

**2. Placeholder scan:**
- ✅ 无 TBD / TODO
- ✅ 无 "implement later" / "add appropriate error handling" 等模糊描述
- ✅ 每个步骤都包含具体命令或代码

**3. Type consistency:**
- ✅ `backend.router.chat.ChatRequest`、`backend.router.chat.event_stream_task`、`backend.utils.stream_manage.sm` 在 Task 4 中的类型/名称与 Task 2 一致
- ✅ `backend.api_main:create_app` 在 Task 1 和 Task 4 中一致
- ✅ patch 目标从 `router.chat.call_llm` 统一改为 `backend.router.chat.call_llm`

**4. Gap identified & fixed:**
- 原计划中 `backend/service/model.py` 的 `from config import Settings` 容易被遗漏，已在 Task 2 Step 4 明确列出。
- `backend/models/chat_model.py` 的 `from models.base import Base` 容易被遗漏，已在 Task 2 Step 3 明确列出。
- `backend/src/agent/rag/storage/vectorstore.py` 中的 `from src.agent...` 已在 Task 3 Step 5 明确列出。
