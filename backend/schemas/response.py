from typing import Generic, TypeVar

from pydantic import Field, BaseModel

T = TypeVar("T")


class Response(BaseModel, Generic[T]):
    code: int = Field(..., description="状态码，0 表示成功，非 0 表示错误")
    data: T = Field(None, description="响应数据")
    msg: str = Field(..., description="提示信息")

    @classmethod
    def success(cls, data: T = None):
        return cls(code=0, data=data, msg="")

    @classmethod
    def error(cls, code: int, msg: str):
        return cls(code=code, data=None, msg=msg or "error")
