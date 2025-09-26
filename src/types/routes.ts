/**
 * Route Type Definitions for better type safety
 */
import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
    gmailAddress: string;
  };
}

export interface RouteHandler {
  (req: AuthenticatedRequest, res: Response, next?: NextFunction): Promise<void> | void;
}

export interface RouteConfig {
  path: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  handler: RouteHandler;
  middleware?: any[];
  description?: string;
}

export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
  success: boolean;
  timestamp?: string;
}

export interface PaginationParams {
  limit?: string | number;
  offset?: string | number;
  page?: string | number;
}

export interface FilterParams {
  status?: string;
  category?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

// Common response helpers
export function successResponse<T>(message: string, data?: T): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(message: string, error?: string): ApiResponse {
  return {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString()
  };
}