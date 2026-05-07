from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ListResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int


class PaginatedResponse(ListResponse[T], Generic[T]):
    page: int = 1
    page_size: int = 20
