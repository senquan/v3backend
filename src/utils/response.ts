import { Response } from 'express';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

export const successResponse = <T>(res: Response, data: T, message = '操作成功', code = 0): Response => {
  const response: ApiResponse<T> = {
    code,
    message,
    data
  };
  return res.status(200).json(response);
};

export const errorResponse = (res: Response, code = 500, message = '服务器内部错误', data: any = null): Response => {
  const response: ApiResponse<null> = {
    code,
    message,
    data
  };
  return res.status(code).json(response);
};