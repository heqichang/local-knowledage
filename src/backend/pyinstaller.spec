# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules, collect_data_files
import os
import sys

block_cipher = None

hiddenimports = [
    'chromadb',
    'chromadb.api',
    'chromadb.api.fastapi',
    'chromadb.config',
    'chromadb.db',
    'chromadb.ingest',
    'chromadb.migrations',
    'chromadb.segment',
    'chromadb.segment.impl',
    'chromadb.segment.impl.distributed',
    'chromadb.segment.impl.metadata',
    'chromadb.segment.impl.vector',
    'chromadb.storage',
    'chromadb.utils',
    'chromadb.utils.embedding_functions',
    'sentence_transformers',
    'sentence_transformers.SentenceTransformer',
    'sentence_transformers.util',
    'langchain_text_splitters',
    'langchain_text_splitters.character',
    'langchain_text_splitters.base',
    'langchain_text_splitters.markdown',
    'fitz',
    'pymupdf',
    'docx',
    'openpyxl',
    'sqlalchemy.dialects.sqlite',
    'aiosqlite',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'pydantic',
    'pydantic.v1',
    'pydantic_core',
    'huggingface_hub',
    'transformers',
    'torch',
    'numpy',
    'tokenizers',
]

chromadb_datas, chromadb_binaries, chromadb_hiddenimports = collect_all('chromadb')
sentence_transformers_datas, sentence_transformers_binaries, sentence_transformers_hiddenimports = collect_all('sentence_transformers')
langchain_text_splitters_datas, langchain_text_splitters_binaries, langchain_text_splitters_hiddenimports = collect_all('langchain_text_splitters')

pymupdf_datas, pymupdf_binaries, pymupdf_hiddenimports = collect_all('pymupdf')
fitz_datas, fitz_binaries, fitz_hiddenimports = collect_all('fitz')

datas = [
    *chromadb_datas,
    *sentence_transformers_datas,
    *langchain_text_splitters_datas,
    *pymupdf_datas,
    *fitz_datas,
]

binaries = [
    *chromadb_binaries,
    *sentence_transformers_binaries,
    *langchain_text_splitters_binaries,
    *pymupdf_binaries,
    *fitz_binaries,
]

hiddenimports.extend([
    *chromadb_hiddenimports,
    *sentence_transformers_hiddenimports,
    *langchain_text_splitters_hiddenimports,
    *pymupdf_hiddenimports,
    *fitz_hiddenimports,
])

excludes = [
    'matplotlib',
    'PIL',
    'tkinter',
    'test',
    'unittest',
    'pytest',
    'IPython',
    'jupyter',
    'notebook',
]

a = Analysis(
    ['run_app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='local-knowledge-base',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
