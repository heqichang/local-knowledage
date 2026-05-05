# 知识库 CRUD 实现计划

## 一、项目现状分析

### 后端现状
- ✅ FastAPI 框架已搭建
- ✅ SQLAlchemy 2.0 异步模型已定义（KnowledgeBase, Document, DocumentChunk）
- ✅ SQLite + aiosqlite 数据库连接已配置
- ✅ 路由框架已搭建（`/api/v1/knowledge-bases`）
- ❌ Pydantic schemas 未实现
- ❌ Service 层未实现
- ❌ 路由实现为空

### 前端现状
- ✅ React 19 + TypeScript + Vite + Tailwind CSS
- ✅ React Query + Zustand + Axios
- ✅ 路由已配置（`/knowledge-bases`, `/knowledge-bases/:id`）
- ✅ 基础页面组件已创建
- ❌ TypeScript 类型定义缺失
- ❌ API 请求函数缺失
- ❌ UI 组件和业务逻辑未实现

---

## 二、实现范围

### 后端实现

#### 1. Pydantic Schemas (`backend/app/schemas/`)
- `knowledge_base.py`: 知识库请求/响应 schema
- `document.py`: 文档请求/响应 schema

#### 2. Service 层 (`backend/app/services/`)
- `knowledge_base.py`: 知识库 CRUD 业务逻辑
- `document.py`: 文档上传、解析、删除基础逻辑
- `embedding.py`: Embedding 服务封装（待后续完善）
- `vector_store.py`: ChromaDB 向量存储封装（待后续完善）

#### 3. 路由实现 (`backend/app/api/v1/knowledge_bases.py`)
- `GET /`: 知识库列表
- `POST /`: 创建知识库
- `GET /{kb_id}`: 获取知识库详情
- `PUT /{kb_id}`: 更新知识库
- `DELETE /{kb_id}`: 删除知识库（级联清理）
- `POST /{kb_id}/documents/upload`: 文档上传
- `GET /{kb_id}/documents`: 文档列表
- `GET /{kb_id}/documents/{doc_id}`: 文档详情
- `DELETE /{kb_id}/documents/{doc_id}`: 删除文档
- `GET /{kb_id}/documents/{doc_id}/status`: 文档处理状态

#### 4. 工具层 (`backend/app/utils/`)
- `file_parser.py`: 文档解析工具（TXT/MD 优先）
- `text_splitter.py`: 文本分段工具

### 前端实现

#### 1. 类型定义 (`frontend/src/types/`)
- `knowledge-base.ts`: 知识库相关类型
- `document.ts`: 文档相关类型
- `api.ts`: API 通用类型

#### 2. API 层 (`frontend/src/api/`)
- `knowledgeBases.ts`: 知识库 API 请求函数
- `documents.ts`: 文档 API 请求函数

#### 3. 自定义 Hooks (`frontend/src/hooks/`)
- `useKnowledgeBases.ts`: 知识库数据获取/操作 hooks
- `useDocuments.ts`: 文档数据获取/操作 hooks

#### 4. UI 组件
- 列表页：知识库卡片、创建/编辑/删除弹窗
- 详情页：文档列表、上传区域、进度展示

---

## 三、详细实现步骤

### Phase 1: 后端核心实现

#### Step 1: 创建 Pydantic Schemas

**文件**: `backend/app/schemas/knowledge_base.py`
```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class KnowledgeBaseBase(BaseModel):
    name: str
    description: str | None = None

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBaseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class KnowledgeBaseResponse(KnowledgeBaseBase):
    id: int
    document_count: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class KnowledgeBaseListResponse(BaseModel):
    items: list[KnowledgeBaseResponse]
    total: int
```

**文件**: `backend/app/schemas/document.py`
```python
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from enum import Enum

class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DocumentBase(BaseModel):
    filename: str
    file_type: str
    file_size: int

class DocumentResponse(DocumentBase):
    id: int
    knowledge_base_id: int
    file_hash: str
    chunk_count: int
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DocumentUploadResponse(BaseModel):
    uploaded: list[DocumentResponse]
    skipped: list[str]
```

**文件**: `backend/app/schemas/__init__.py`
```python
from .knowledge_base import (
    KnowledgeBaseBase,
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseResponse,
    KnowledgeBaseListResponse,
)
from .document import (
    DocumentBase,
    DocumentResponse,
    DocumentUploadResponse,
    DocumentStatus,
)

__all__ = [
    "KnowledgeBaseBase",
    "KnowledgeBaseCreate",
    "KnowledgeBaseUpdate",
    "KnowledgeBaseResponse",
    "KnowledgeBaseListResponse",
    "DocumentBase",
    "DocumentResponse",
    "DocumentUploadResponse",
    "DocumentStatus",
]
```

#### Step 2: 创建 Service 层

**文件**: `backend/app/services/knowledge_base.py`
```python
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KnowledgeBase
from app.schemas import KnowledgeBaseCreate, KnowledgeBaseUpdate


class KnowledgeBaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> list[KnowledgeBase]:
        result = await self.db.execute(
            select(KnowledgeBase).order_by(KnowledgeBase.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, kb_id: int) -> KnowledgeBase | None:
        result = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> KnowledgeBase | None:
        result = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, data: KnowledgeBaseCreate) -> KnowledgeBase:
        kb = KnowledgeBase(
            name=data.name,
            description=data.description,
        )
        self.db.add(kb)
        await self.db.commit()
        await self.db.refresh(kb)
        return kb

    async def update(self, kb_id: int, data: KnowledgeBaseUpdate) -> KnowledgeBase | None:
        kb = await self.get_by_id(kb_id)
        if not kb:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(kb, key, value)
        
        await self.db.commit()
        await self.db.refresh(kb)
        return kb

    async def delete(self, kb_id: int) -> bool:
        kb = await self.get_by_id(kb_id)
        if not kb:
            return False
        
        await self.db.delete(kb)
        await self.db.commit()
        return True

    async def update_document_count(self, kb_id: int) -> None:
        from app.models import Document
        
        result = await self.db.execute(
            select(func.count()).where(Document.knowledge_base_id == kb_id)
        )
        count = result.scalar() or 0
        
        kb = await self.get_by_id(kb_id)
        if kb:
            kb.document_count = count
            await self.db.commit()
```

**文件**: `backend/app/services/document.py`
```python
import hashlib
from pathlib import Path
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Document, KnowledgeBase
from app.schemas import DocumentResponse, DocumentStatus
from app.utils.file_parser import get_file_parser


class DocumentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.DATA_DIR) / "uploads"
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def get_by_kb_id(self, kb_id: int) -> list[Document]:
        result = await self.db.execute(
            select(Document)
            .where(Document.knowledge_base_id == kb_id)
            .order_by(Document.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, doc_id: int) -> Document | None:
        result = await self.db.execute(
            select(Document).where(Document.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def get_by_hash(self, kb_id: int, file_hash: str) -> Document | None:
        result = await self.db.execute(
            select(Document).where(
                Document.knowledge_base_id == kb_id,
                Document.file_hash == file_hash
            )
        )
        return result.scalar_one_or_none()

    def _calculate_file_hash(self, file_content: bytes) -> str:
        return hashlib.sha256(file_content).hexdigest()

    def _get_file_type(self, filename: str) -> str:
        ext = Path(filename).suffix.lower().lstrip(".")
        valid_types = {"txt", "md", "pdf", "docx", "doc", "xlsx", "xls"}
        return ext if ext in valid_types else "txt"

    async def upload_file(
        self,
        kb_id: int,
        filename: str,
        file_content: bytes,
    ) -> tuple[Document | None, str]:
        kb = await self.db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
        )
        if not kb.scalar_one_or_none():
            return None, "知识库不存在"

        file_hash = self._calculate_file_hash(file_content)
        
        existing_doc = await self.get_by_hash(kb_id, file_hash)
        if existing_doc:
            return None, f"文件已存在: {existing_doc.filename}"

        file_type = self._get_file_type(filename)
        file_size = len(file_content)

        saved_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        file_path = self.upload_dir / saved_filename
        file_path.write_bytes(file_content)

        doc = Document(
            knowledge_base_id=kb_id,
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            file_hash=file_hash,
            status=DocumentStatus.PENDING,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)

        return doc, ""

    async def process_document(self, doc_id: int) -> Document:
        doc = await self.get_by_id(doc_id)
        if not doc:
            raise ValueError("文档不存在")

        doc.status = DocumentStatus.PROCESSING
        await self.db.commit()

        try:
            file_path = self.upload_dir / f"{doc.id}_{doc.filename}"
            
            parser = get_file_parser(doc.file_type)
            text_content = parser.parse(file_path)

            from app.utils.text_splitter import split_text
            chunks = split_text(text_content)

            doc.chunk_count = len(chunks)
            doc.status = DocumentStatus.COMPLETED

        except Exception as e:
            doc.status = DocumentStatus.FAILED
            doc.error_message = str(e)

        await self.db.commit()
        await self.db.refresh(doc)

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(doc.knowledge_base_id)

        return doc

    async def delete(self, doc_id: int) -> bool:
        doc = await self.get_by_id(doc_id)
        if not doc:
            return False

        kb_id = doc.knowledge_base_id

        file_path = self.upload_dir / f"{doc.id}_{doc.filename}"
        if file_path.exists():
            file_path.unlink()

        await self.db.delete(doc)
        await self.db.commit()

        from app.services.knowledge_base import KnowledgeBaseService
        kb_service = KnowledgeBaseService(self.db)
        await kb_service.update_document_count(kb_id)

        return True
```

**文件**: `backend/app/services/__init__.py`
```python
from .knowledge_base import KnowledgeBaseService
from .document import DocumentService

__all__ = ["KnowledgeBaseService", "DocumentService"]
```

#### Step 3: 创建工具层

**文件**: `backend/app/utils/file_parser.py`
```python
from abc import ABC, abstractmethod
from pathlib import Path


class BaseParser(ABC):
    @abstractmethod
    def parse(self, file_path: Path) -> str:
        pass


class TextParser(BaseParser):
    def parse(self, file_path: Path) -> str:
        try:
            return file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return file_path.read_text(encoding="gbk", errors="ignore")


class MarkdownParser(TextParser):
    pass


class PDFParser(BaseParser):
    def parse(self, file_path: Path) -> str:
        try:
            import fitz
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            return text
        except ImportError:
            return ""


class DocxParser(BaseParser):
    def parse(self, file_path: Path) -> str:
        try:
            from docx import Document
            doc = Document(file_path)
            text = ""
            for para in doc.paragraphs:
                text += para.text + "\n"
            for table in doc.tables:
                for row in table.rows:
                    row_text = " ".join(cell.text for cell in row.cells)
                    text += row_text + "\n"
            return text
        except ImportError:
            return ""


class ExcelParser(BaseParser):
    def parse(self, file_path: Path) -> str:
        try:
            from openpyxl import load_workbook
            wb = load_workbook(file_path, read_only=True, data_only=True)
            text = ""
            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                text += f"=== 工作表: {sheet_name} ===\n"
                for row in sheet.iter_rows(values_only=True):
                    row_text = " ".join(str(cell) if cell is not None else "" for cell in row)
                    text += row_text + "\n"
            return text
        except ImportError:
            return ""


_parsers: dict[str, type[BaseParser]] = {
    "txt": TextParser,
    "md": MarkdownParser,
    "pdf": PDFParser,
    "docx": DocxParser,
    "doc": DocxParser,
    "xlsx": ExcelParser,
    "xls": ExcelParser,
}


def get_file_parser(file_type: str) -> BaseParser:
    parser_class = _parsers.get(file_type.lower(), TextParser)
    return parser_class()
```

**文件**: `backend/app/utils/text_splitter.py`
```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings


def split_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[str]:
    size = chunk_size or settings.CHUNK_SIZE
    overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=[
            "\n\n",
            "\n",
            "。",
            "！",
            "？",
            ".",
            "!",
            "?",
            " ",
            "",
        ],
    )

    return splitter.split_text(text)
```

**文件**: `backend/app/utils/__init__.py`
```python
from .file_parser import get_file_parser
from .text_splitter import split_text

__all__ = ["get_file_parser", "split_text"]
```

#### Step 4: 实现路由接口

修改 `backend/app/api/v1/knowledge_bases.py`：

```python
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.schemas import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseResponse,
    DocumentResponse,
    DocumentUploadResponse,
    DocumentStatus,
)
from app.services import KnowledgeBaseService, DocumentService

router = APIRouter()


@router.get("/", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    service = KnowledgeBaseService(db)
    return await service.get_all()


@router.post("/", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    
    existing = await service.get_by_name(payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"知识库名称 '{payload.name}' 已存在",
        )
    
    return await service.create(payload)


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    kb = await service.get_by_id(kb_id)
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )
    return kb


@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: int,
    payload: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    
    if payload.name:
        existing = await service.get_by_name(payload.name)
        if existing and existing.id != kb_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"知识库名称 '{payload.name}' 已存在",
            )
    
    kb = await service.update(kb_id, payload)
    if not kb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )
    return kb


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeBaseService(db)
    success = await service.delete(kb_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="知识库不存在",
        )


@router.post("/{kb_id}/documents/upload", response_model=DocumentUploadResponse)
async def upload_documents(
    kb_id: int,
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    uploaded: list[DocumentResponse] = []
    skipped: list[str] = []

    for file in files:
        content = await file.read()
        filename = file.filename or "unknown.txt"
        
        doc, error = await service.upload_file(kb_id, filename, content)
        
        if doc:
            uploaded.append(DocumentResponse.model_validate(doc))
        else:
            skipped.append(f"{filename}: {error}")

    return DocumentUploadResponse(uploaded=uploaded, skipped=skipped)


@router.get("/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    kb_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    return await service.get_by_kb_id(kb_id)


@router.get("/{kb_id}/documents/{doc_id}", response_model=DocumentResponse)
async def get_document(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)
    
    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )
    
    return doc


@router.delete("/{kb_id}/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)
    
    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )
    
    await service.delete(doc_id)


@router.get("/{kb_id}/documents/{doc_id}/status", response_model=dict)
async def get_document_status(
    kb_id: int,
    doc_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = DocumentService(db)
    doc = await service.get_by_id(doc_id)
    
    if not doc or doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在",
        )
    
    return {
        "id": doc.id,
        "status": doc.status,
        "error_message": doc.error_message,
    }
```

---

### Phase 2: 前端实现

#### Step 1: 创建类型定义

**文件**: `frontend/src/types/knowledge-base.ts`
```typescript
export interface KnowledgeBase {
  id: number
  name: string
  description: string | null
  document_count: number
  created_at: string
  updated_at: string
}

export interface CreateKnowledgeBaseRequest {
  name: string
  description?: string
}

export interface UpdateKnowledgeBaseRequest {
  name?: string
  description?: string
}
```

**文件**: `frontend/src/types/document.ts`
```typescript
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Document {
  id: number
  knowledge_base_id: number
  filename: string
  file_type: string
  file_size: number
  file_hash: string
  chunk_count: number
  status: DocumentStatus
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DocumentUploadResponse {
  uploaded: Document[]
  skipped: string[]
}
```

**文件**: `frontend/src/types/api.ts`
```typescript
export interface ApiError {
  detail: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
}
```

**文件**: `frontend/src/types/index.ts`
```typescript
export * from './knowledge-base'
export * from './document'
export * from './api'
```

#### Step 2: 创建 API 请求函数

**文件**: `frontend/src/api/knowledgeBases.ts`
```typescript
import { apiClient } from './client'
import type {
  KnowledgeBase,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
} from '@/types'

export const knowledgeBasesApi = {
  getAll: async (): Promise<KnowledgeBase[]> => {
    const response = await apiClient.get<KnowledgeBase[]>('/knowledge-bases')
    return response.data
  },

  getById: async (id: number): Promise<KnowledgeBase> => {
    const response = await apiClient.get<KnowledgeBase>(`/knowledge-bases/${id}`)
    return response.data
  },

  create: async (data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> => {
    const response = await apiClient.post<KnowledgeBase>('/knowledge-bases', data)
    return response.data
  },

  update: async (id: number, data: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> => {
    const response = await apiClient.put<KnowledgeBase>(`/knowledge-bases/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/knowledge-bases/${id}`)
  },
}
```

**文件**: `frontend/src/api/documents.ts`
```typescript
import { apiClient } from './client'
import type { Document, DocumentUploadResponse } from '@/types'

export const documentsApi = {
  getByKnowledgeBase: async (kbId: number): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(`/knowledge-bases/${kbId}/documents`)
    return response.data
  },

  getById: async (kbId: number, docId: number): Promise<Document> => {
    const response = await apiClient.get<Document>(`/knowledge-bases/${kbId}/documents/${docId}`)
    return response.data
  },

  upload: async (kbId: number, files: File[]): Promise<DocumentUploadResponse> => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await apiClient.post<DocumentUploadResponse>(
      `/knowledge-bases/${kbId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  delete: async (kbId: number, docId: number): Promise<void> => {
    await apiClient.delete(`/knowledge-bases/${kbId}/documents/${docId}`)
  },

  getStatus: async (kbId: number, docId: number): Promise<{ status: string; error_message: string | null }> => {
    const response = await apiClient.get(`/knowledge-bases/${kbId}/documents/${docId}/status`)
    return response.data
  },
}
```

**文件**: `frontend/src/api/index.ts`
```typescript
export { apiClient } from './client'
export { knowledgeBasesApi } from './knowledgeBases'
export { documentsApi } from './documents'
```

#### Step 3: 创建自定义 Hooks

**文件**: `frontend/src/hooks/useKnowledgeBases.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { knowledgeBasesApi } from '@/api'
import type { CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest } from '@/types'

export const useKnowledgeBases = () => {
  return useQuery({
    queryKey: ['knowledgeBases'],
    queryFn: knowledgeBasesApi.getAll,
  })
}

export const useKnowledgeBase = (id: number | undefined) => {
  return useQuery({
    queryKey: ['knowledgeBase', id],
    queryFn: () => id ? knowledgeBasesApi.getById(id) : null,
    enabled: !!id,
  })
}

export const useCreateKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateKnowledgeBaseRequest) => knowledgeBasesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
    },
  })
}

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateKnowledgeBaseRequest }) =>
      knowledgeBasesApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', data.id] })
    },
  })
}

export const useDeleteKnowledgeBase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => knowledgeBasesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledgeBases'] })
    },
  })
}
```

**文件**: `frontend/src/hooks/useDocuments.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api'

export const useDocuments = (kbId: number | undefined) => {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () => kbId ? documentsApi.getByKnowledgeBase(kbId) : [],
    enabled: !!kbId,
  })
}

export const useUploadDocuments = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, files }: { kbId: number; files: File[] }) =>
      documentsApi.upload(kbId, files),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', variables.kbId] })
    },
  })
}

export const useDeleteDocument = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, docId }: { kbId: number; docId: number }) =>
      documentsApi.delete(kbId, docId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
      queryClient.invalidateQueries({ queryKey: ['knowledgeBase', variables.kbId] })
    },
  })
}
```

**文件**: `frontend/src/hooks/index.ts`
```typescript
export * from './useKnowledgeBases'
export * from './useDocuments'
```

#### Step 4: 创建 UI 组件和页面

首先更新 Vite 配置以支持路径别名：

**文件**: `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

**文件**: `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

现在创建页面组件：

**文件**: `frontend/src/pages/KnowledgeBasesPage.tsx`
```typescript
import { type FC, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useKnowledgeBases,
  useCreateKnowledgeBase,
  useUpdateKnowledgeBase,
  useDeleteKnowledgeBase,
  useDocuments,
  useUploadDocuments,
  useDeleteDocument,
} from '@/hooks'
import type { DocumentStatus } from '@/types'

const getStatusColor = (status: DocumentStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'processing':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusText = (status: DocumentStatus): string => {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'processing':
      return '处理中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return status
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const KnowledgeBasesPage: FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const kbId = id ? parseInt(id, 10) : undefined

  const { data: knowledgeBases, isLoading: kbLoading } = useKnowledgeBases()
  const { data: documents, isLoading: docsLoading } = useDocuments(kbId)

  const createMutation = useCreateKnowledgeBase()
  const updateMutation = useUpdateKnowledgeBase()
  const deleteMutation = useDeleteKnowledgeBase()
  const uploadMutation = useUploadDocuments()
  const deleteDocMutation = useDeleteDocument()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false)
  const [selectedKb, setSelectedKb] = useState<{ id: number; name: string } | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<{ id: number; kbId: number; name: string } | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const currentKb = knowledgeBases?.find((kb) => kb.id === kbId)

  const handleCreateKb = () => {
    setFormName('')
    setFormDescription('')
    setShowCreateModal(true)
  }

  const handleEditKb = (kb: { id: number; name: string; description: string | null }) => {
    setSelectedKb({ id: kb.id, name: kb.name })
    setFormName(kb.name)
    setFormDescription(kb.description || '')
    setShowEditModal(true)
  }

  const handleDeleteKb = (kb: { id: number; name: string }) => {
    setSelectedKb(kb)
    setShowDeleteModal(true)
  }

  const handleDeleteDoc = (docId: number, kbId: number, filename: string) => {
    setSelectedDoc({ id: docId, kbId, name: filename })
    setShowDeleteDocModal(true)
  }

  const submitCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate(
      { name: formName.trim(), description: formDescription.trim() || undefined },
      {
        onSuccess: () => setShowCreateModal(false),
      }
    )
  }

  const submitEdit = () => {
    if (!selectedKb || !formName.trim()) return
    updateMutation.mutate(
      {
        id: selectedKb.id,
        data: { name: formName.trim(), description: formDescription.trim() || undefined },
      },
      {
        onSuccess: () => setShowEditModal(false),
      }
    )
  }

  const submitDelete = () => {
    if (!selectedKb) return
    deleteMutation.mutate(selectedKb.id, {
      onSuccess: () => {
        setShowDeleteModal(false)
        if (kbId === selectedKb.id) {
          navigate('/knowledge-bases')
        }
      },
    })
  }

  const submitDeleteDoc = () => {
    if (!selectedDoc) return
    deleteDocMutation.mutate(
      { kbId: selectedDoc.kbId, docId: selectedDoc.id },
      {
        onSuccess: () => setShowDeleteDocModal(false),
      }
    )
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0 || !kbId) return
    const fileArray = Array.from(files)
    uploadMutation.mutate({ kbId, files: fileArray })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  if (kbLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (!kbId) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">知识库</h2>
            <p className="mt-2 text-gray-500">管理你的知识库和文档</p>
          </div>
          <button
            onClick={handleCreateKb}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新建知识库
          </button>
        </div>

        {knowledgeBases && knowledgeBases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeBases.map((kb) => (
              <div
                key={kb.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/knowledge-bases/${kb.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{kb.name}</h3>
                    {kb.description && (
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{kb.description}</p>
                    )}
                    <p className="mt-2 text-sm text-gray-400">
                      {kb.document_count} 个文档
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() =>
                        handleEditKb({ id: kb.id, name: kb.name, description: kb.description })
                      }
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteKb({ id: kb.id, name: kb.name })}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg">暂无知识库</div>
            <p className="mt-2 text-gray-400">点击上方按钮创建第一个知识库</p>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">新建知识库</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="输入知识库名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="输入知识库描述"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitCreate}
                  disabled={!formName.trim() || createMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createMutation.isPending ? '创建中...' : '创建'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑知识库</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="输入知识库名称"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    placeholder="输入知识库描述"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitEdit}
                  disabled={!formName.trim() || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {updateMutation.isPending ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && selectedKb && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
              <p className="text-gray-600">
                确定要删除知识库 <span className="font-medium text-gray-900">"{selectedKb.name}"</span> 吗？
                此操作将删除该知识库下的所有文档和数据，且无法恢复。
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={submitDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMutation.isPending ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/knowledge-bases')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← 返回
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{currentKb?.name}</h2>
          {currentKb?.description && (
            <p className="mt-1 text-gray-500">{currentKb.description}</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() =>
              currentKb &&
              handleEditKb({
                id: currentKb.id,
                name: currentKb.name,
                description: currentKb.description,
              })
            }
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            编辑
          </button>
          <button
            onClick={() =>
              currentKb && handleDeleteKb({ id: currentKb.id, name: currentKb.name })
            }
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-gray-500 mb-4">
          <p className="text-lg">拖拽文件到此处或</p>
          <label className="inline-block mt-2">
            <input
              type="file"
              multiple
              accept=".txt,.md,.pdf,.docx,.doc,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
              选择文件
            </span>
          </label>
        </div>
        <p className="text-sm text-gray-400">
          支持 TXT、MD、PDF、DOCX、XLSX 格式，单文件最大 50MB
        </p>
        {uploadMutation.isPending && (
          <p className="mt-2 text-blue-600">上传中...</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">
            文档列表 ({documents?.length || 0})
          </h3>
        </div>
        {docsLoading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : !documents || documents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">暂无文档，上传第一个文档开始使用</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <div key={doc.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-500 uppercase">{doc.file_type}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{doc.filename}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.file_size)} · {doc.chunk_count} 个分段 ·{' '}
                      {new Date(doc.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(doc.status)}`}
                  >
                    {getStatusText(doc.status)}
                  </span>
                  <button
                    onClick={() => handleDeleteDoc(doc.id, kbId, doc.filename)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">编辑知识库</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="输入知识库名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="输入知识库描述"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitEdit}
                disabled={!formName.trim() || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedKb && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600">
              确定要删除知识库 <span className="font-medium text-gray-900">"{selectedKb.name}"</span> 吗？
              此操作将删除该知识库下的所有文档和数据，且无法恢复。
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDocModal && selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600">
              确定要删除文档 <span className="font-medium text-gray-900">"{selectedDoc.name}"</span> 吗？
              此操作无法恢复。
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDeleteDocModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={submitDeleteDoc}
                disabled={deleteDocMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteDocMutation.isPending ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBasesPage
```

最后更新 `main.tsx` 以添加 React Query Provider：

**文件**: `frontend/src/main.tsx`
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './routes'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
```

---

## 四、文件变更清单

### 新增文件
#### 后端
- `backend/app/schemas/knowledge_base.py`
- `backend/app/schemas/document.py`
- `backend/app/schemas/__init__.py` (更新)
- `backend/app/services/knowledge_base.py`
- `backend/app/services/document.py`
- `backend/app/services/__init__.py` (更新)
- `backend/app/utils/file_parser.py`
- `backend/app/utils/text_splitter.py`
- `backend/app/utils/__init__.py` (更新)

#### 前端
- `frontend/src/types/knowledge-base.ts`
- `frontend/src/types/document.ts`
- `frontend/src/types/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/api/knowledgeBases.ts`
- `frontend/src/api/documents.ts`
- `frontend/src/api/index.ts` (更新)
- `frontend/src/hooks/useKnowledgeBases.ts`
- `frontend/src/hooks/useDocuments.ts`
- `frontend/src/hooks/index.ts`

### 修改文件
#### 后端
- `backend/app/api/v1/knowledge_bases.py` (完整重写)

#### 前端
- `frontend/vite.config.ts` (添加路径别名和代理)
- `frontend/tsconfig.json` (添加路径别名)
- `frontend/src/pages/KnowledgeBasesPage.tsx` (完整重写)
- `frontend/src/main.tsx` (添加 React Query Provider)

---

## 五、验证步骤

### 后端验证
1. 启动后端服务：`cd backend && uv run uvicorn app.main:app --reload --port 8000`
2. 访问 `http://localhost:8000/docs` 查看 OpenAPI 文档
3. 测试各接口：
   - `POST /api/v1/knowledge-bases` 创建知识库
   - `GET /api/v1/knowledge-bases` 列表
   - `PUT /api/v1/knowledge-bases/{id}` 更新
   - `DELETE /api/v1/knowledge-bases/{id}` 删除
   - `POST /api/v1/knowledge-bases/{id}/documents/upload` 上传文档

### 前端验证
1. 启动前端服务：`cd frontend && pnpm dev`
2. 访问 `http://localhost:3000/knowledge-bases`
3. 测试功能：
   - 创建知识库
   - 查看知识库列表
   - 编辑知识库
   - 进入知识库详情
   - 上传文档
   - 删除文档
   - 删除知识库

---

## 六、风险与注意事项

1. **文档解析依赖**：PDF、Word、Excel 解析需要额外的 Python 库（pymupdf, python-docx, openpyxl），这些已在 pyproject.toml 中定义。

2. **异步处理**：当前文档上传后状态直接设为 completed，实际处理应异步执行。后续可引入后台任务队列。

3. **文件大小限制**：需确保 FastAPI 的上传大小限制配置正确。

4. **错误处理**：当前实现包含基础错误处理，可后续增强。

5. **ChromaDB 集成**：向量存储部分当前为占位，后续需要完整实现。
