"""ChromaDB 数据查看工具"""
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.config import settings
from app.services.chroma import get_chroma_service


def main():
    chroma = get_chroma_service()

    print("=" * 60)
    print("ChromaDB 数据概览")
    print("=" * 60)
    print(f"存储路径: {settings.CHROMA_PERSIST_DIR}\n")

    # 列出所有 collection
    collections = chroma.client.list_collections()
    print(f"总 Collection 数: {len(collections)}\n")

    for coll in collections:
        print(f"📚 Collection: {coll.name}")
        print(f"   ID: {coll.id}")

        # 获取统计信息
        count = coll.count()
        print(f"   向量数量: {count}")

        if count > 0:
            # 查看前 3 条数据
            result = coll.get(limit=3, include=["documents", "metadatas"])

            print(f"\n   前 3 条数据预览:")
            for i, (doc_id, doc, meta) in enumerate(zip(
                result["ids"],
                result["documents"],
                result["metadatas"]
            ), 1):
                print(f"\n   [{i}] ID: {doc_id}")
                print(f"       文档: {doc[:100]}..." if len(doc) > 100 else f"       文档: {doc}")
                print(f"       元数据: {meta}")

        print("\n" + "-" * 60 + "\n")


if __name__ == "__main__":
    main()
