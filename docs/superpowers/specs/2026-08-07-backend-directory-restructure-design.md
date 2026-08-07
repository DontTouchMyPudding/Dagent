# 后端目录结构重构设计文档

## 背景

当前项目是一个 Python FastAPI 后端 + Vite/React 前端的应用。后端代码（`api_main.py`、`core/`、`models/`、`router/`、`service/`、`src/agent/`、`utils/`、`tests/` 等）全部散落在仓库根目录，导致：

- 根目录职责不清，前后端文件混合。
- 新加入的开发者难以快速定位后端入口。
- 与 `frontend/` 形成不对称结构，不利于后续扩展。

本次重构目标是把所有后端相关代码统一归拢到 `backend/` 目录，同时保持对现有业务逻辑的最小侵入。

## 目标

1. 在仓库根目录下新建 `backend/` 目录，承载全部后端代码。
2. 保持 `frontend/`、`docker/`、`docs/`、`pyproject.toml`、`.env` 等文件在根目录不动。
3. 将根目录下的 Python 测试迁移到 `backend/tests/`，前端测试保留在 `frontend/tests/`。
4. 统一修正所有后端内部 import 路径，确保 `uv run python backend/api_main.py` 能正常启动。
5. 将 `script/` 重命名为 `scripts/`，与常见约定保持一致。

## 非目标

- 不拆分独立 Python 包（如 `packages/extension-api`、`packages/harness`）。
- 不对 `backend/` 内部做职责分层或 Clean Architecture 改造。
- 不修改前端代码（前端 API 路径不变）。
- 不改动业务逻辑、数据库模型、路由定义。
- 本次不处理 `example.db`（保留现状，后续单独决策）。

## 最终目录结构

```
agent_project/
├── .env                          # 保留根目录（前后端共享环境变量）
├── .gitignore                    # 补充 backend/ 相关忽略项
├── .python-version               # 保留根目录
├── pyproject.toml                # 保留根目录，描述信息可适当更新
├── uv.lock                       # 保留根目录
├── README.md                     # 更新启动命令
├── docker/                       # 保留现状
├── docs/                         # 保留现状
├── frontend/                     # 保持现状
│   ├── package.json
│   ├── src/
│   ├── tests/
│   └── ...
├── backend/                      # 新增：后端根目录
│   ├── __init__.py               # 新增空文件，使 backend 成为可 import 包
│   ├── api_main.py               # FastAPI 启动入口（从根目录移入）
│   ├── main.py                   # CLI / RAG 脚本入口（从根目录移入）
│   ├── config.py                 # Pydantic Settings（从根目录移入）
│   ├── core/                     # 数据库连接（从 core/ 移入）
│   ├── models/                   # SQLAlchemy 模型（从 models/ 移入）
│   ├── router/                   # FastAPI 路由（从 router/ 移入）
│   ├── schemas/                  # Pydantic Schema（从 schemas/ 移入）
│   ├── service/                  # 业务服务（从 service/ 移入）
│   ├── src/                      # 原 src/ 整体移入
│   │   └── agent/                # Agent / RAG 核心逻辑
│   ├── utils/                    # 工具函数（从 utils/ 移入）
│   └── tests/                    # Python 测试（从根目录 tests/ 移入）
│       └── test_chat_stream.py
└── scripts/                      # 由 script/ 重命名
```

## 文件移动清单

| 原路径 | 新路径 | 说明 |
|---|---|---|
| `api_main.py` | `backend/api_main.py` | FastAPI 启动入口 |
| `main.py` | `backend/main.py` | CLI / RAG 脚本入口 |
| `config.py` | `backend/config.py` | 根级 Pydantic Settings |
| `core/` | `backend/core/` | 数据库连接池 |
| `models/` | `backend/models/` | SQLAlchemy 模型 |
| `router/` | `backend/router/` | FastAPI 路由 |
| `schemas/` | `backend/schemas/` | 数据校验模型 |
| `service/` | `backend/service/` | 业务服务层 |
| `src/agent/` | `backend/src/agent/` | Agent / RAG 核心 |
| `utils/` | `backend/utils/` | 工具函数 |
| `tests/` | `backend/tests/` | Python 测试 |
| `script/` | `scripts/` | 空目录重命名 |
| `pyproject.toml` | 保留根目录 | 更新描述即可 |
| `uv.lock` | 保留根目录 | 路径不变 |
| `frontend/tests/` | 保持现状 | 前端测试不动 |

## Import 路径调整

### 新增 `__init__.py`

在 `backend/__init__.py` 创建空文件，使 `backend` 成为可 import 的 Python 包。

### 主要文件变更示例

**`backend/api_main.py`**

```python
# 调整前
from core.database import init_db, dispose_db
from router import chat_app
from models.base import Base

# 调整后
from backend.core.database import init_db, dispose_db
from backend.router import chat_app
from backend.models.base import Base

# uvicorn 启动字符串同步调整
uvicorn.run("backend.api_main:create_app", ...)
```

**`backend/main.py`**

```python
# 调整前
from src.agent.chat.chat import chat
from src.agent.core.config import config

# 调整后
from backend.src.agent.chat.chat import chat
from backend.src.agent.core.config import config
```

**`backend/router/chat.py`**

```python
# 调整前
from core.database import get_db
from schemas.response import Response
from service import call_llm
from utils.stream_manage import sm
from models.chat_model import Sessions

# 调整后
from backend.core.database import get_db
from backend.schemas.response import Response
from backend.service import call_llm
from backend.utils.stream_manage import sm
from backend.models.chat_model import Sessions
```

**`backend/src/agent/` 内部**

如果当前使用相对 import（如 `from ..core.llm import create_llm`），则不需要改动；如果使用绝对 import（如 `from src.agent.core.llm import create_llm`），需要统一改为 `from backend.src.agent.core.llm import create_llm`。

### `pyproject.toml` 调整

`pyproject.toml` 保留在根目录。由于 `backend/` 下已有 `__init__.py`，uv 会自动将其识别为可导入包，无需额外声明 `packages`。建议仅更新项目描述：

```toml
[project]
name = "agent-project"
version = "0.1.0"
description = "Agent chat backend (FastAPI + LangChain)"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [ ... ]
```

## 测试调整

### 后端测试迁移

当前 `tests/test_chat_stream.py` 使用 `sys.path.insert` 将父目录加入路径后进行绝对 import。迁移到 `backend/tests/` 后，可以删除 `sys.path` 操作，直接使用 `backend.` 前缀导入：

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

### 测试运行命令

```bash
uv run pytest backend/tests
```

### 前端测试

前端测试保留在 `frontend/tests/`，不需要改动。运行方式不变：

```bash
pnpm --dir frontend test
```

## 脚本与启动命令

### `scripts/` 目录

将现有空目录 `script/` 重命名为 `scripts/`。由于目录为空，迁移时直接重命名即可，无需处理内部文件。

### `README.md` 更新

将启动命令更新为：

```bash
uv run python backend/api_main.py
```

### 前端是否需要改动？

不需要。前端调用的是相对路径 API（如 `/chat/list`、`/chat/stream`），后端路由前缀保持 `/api/chat/*` 不变，因此前端代码无需任何调整。

## 迁移步骤

1. 创建 `backend/` 目录并添加 `backend/__init__.py`。
2. 使用 `git mv` 将后端文件和目录移入 `backend/`：
   - `api_main.py`、`main.py`、`config.py`
   - `core/`、`models/`、`router/`、`schemas/`、`service/`、`src/`、`utils/`、`tests/`
3. 使用 `git mv script/ scripts/` 重命名脚本目录。
4. 批量修正后端内部 import，统一加上 `backend.` 前缀。
5. 修正 `api_main.py` 中的 `uvicorn.run` 字符串为 `"backend.api_main:create_app"`。
6. 删除 `backend/tests/test_chat_stream.py` 中的 `sys.path.insert` 逻辑。
7. 更新 `README.md` 中的启动命令。
8. 运行 `uv run python backend/api_main.py` 验证后端启动。
9. 运行 `uv run pytest backend/tests` 验证测试通过。
10. 运行 `pnpm --dir frontend test` 验证前端测试不受影响。

## 风险控制

| 风险点 | 应对措施 |
|---|---|
| Git 历史丢失 | 所有目录/文件移动使用 `git mv`，保留历史记录。 |
| Import 遗漏 | 使用 `grep` 扫描 `from (core\|models\|router\|schemas\|service\|utils\|src\|agent)\b` 等模式，确保全部修正。 |
| 迁移中途运行中断 | 在独立分支或 git worktree 中完成迁移，验证通过后再合并到主分支。 |
| 前端联调异常 | API 路径不变，但迁移完成后仍应手动验证 `/api/chat/list` 等接口。 |
| 测试环境异常 | 同时验证 `uv run pytest backend/tests` 与 `pnpm --dir frontend test`。 |

## 回滚策略

如果迁移后出现问题，可以直接回滚到迁移前的提交：

```bash
git checkout <迁移前-commit>
```

由于所有移动都使用 `git mv`，回滚不会导致文件丢失或历史断裂。

## 后续可扩展

- 当后端规模扩大后，可以考虑将 `backend/src/agent/` 提升为 `backend/agent/`，消除多余的 `src` 层级。
- 当需要引入根级编排脚本时，可以直接放入 `scripts/` 目录。
- `example.db` 的处理可以后续单独决策（删除、迁移到 `backend/data/` 或加入 `.gitignore`）。
